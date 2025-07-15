const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const chalk = require("chalk");
const config = require("../config.json");
const { logger } = require("../libs/logger");
const loadPlugins = require("./loader");
const messageHandler = require("./handler");
const AuthManager = require("./auth");
const fs = require("fs-extra");
const path = require("path");

let sock;
let authManager;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// Export AUTH_ERROR for use in Goat.js
module.exports.AUTH_ERROR = new Boom("AUTH", { statusCode: 401 });

async function connect({ method } = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      authManager = new AuthManager();

      // Check and create session folder silently
      const sessionPath = path.join(process.cwd(), "session");
      if (!(await fs.pathExists(sessionPath))) {
        await fs.mkdir(sessionPath);
      }

      // Check for existing session
      const hasValidSession = await authManager.checkSession();

      if (!hasValidSession || method) {
        global.GoatBot.connectionStatus = "waiting_for_auth";
        global.GoatBot.waitingForAuth = true;

        // Use provided method or show auth menu
        const authMethod = method || (await authManager.showAuthMenu());

        // Process user selection
        switch (authMethod) {
          case "pairing":
            const phoneNumber = await authManager.handlePairingCode();
            await startConnection(phoneNumber, resolve, reject);
            break;
          case "qr":
            await authManager.handleQRCode();
            await startConnection(null, resolve, reject);
            break;
          case "clear":
            await authManager.handleClearSession();
            return connect().then(resolve).catch(reject);
          case "exit":
            console.log(chalk.yellow("👋 Goodbye!"));
            process.exit(0);
            break;
          default:
            await startConnection(null, resolve, reject);
        }
      } else {
        global.GoatBot.authMethod = "existing_session";
        global.GoatBot.sessionValid = true;
        global.GoatBot.waitingForAuth = false;
        await startConnection(null, resolve, reject);
      }
    } catch (error) {
      authManager?.showError("Failed to initialize authentication", error);
      global.GoatBot.stats.errors++;
      reject(error);
    }
  });
}

async function startConnection(phoneNumber = null, resolve, reject) {
  try {
    connectionAttempts++;

    if (connectionAttempts > MAX_CONNECTION_ATTEMPTS) {
      const error = new Error(`Max connection attempts (${MAX_CONNECTION_ATTEMPTS}) exceeded`);
      authManager?.showError("Connection failed after multiple attempts", error);
      return reject(error);
    }

    const { state, saveCreds } = await useMultiFileAuthState("session");
    const { version } = await fetchLatestBaileysVersion();

    logger.info(`Using Baileys version: ${version.join(".")}`);

    if (!global.GoatBot.waitingForAuth) {
      // authManager?.showConnectionStatus("connecting");
    }

    const connectionOptions = {
      auth: state,
      logger: pino({ level: "silent" }),
      version,
      printQRInTerminal: false,
      connectTimeoutMs: 30000,
      qrTimeout: 45000,
      retryRequestDelayMs: 1000,
      maxMsgRetryCount: 5,
      browser: ["GoatBot", "Chrome", "1.0.0"],
      generateHighQualityLinkPreview: true,
    };

    if (phoneNumber) {
      connectionOptions.mobile = true;
    }

    sock = makeWASocket(connectionOptions);

    const connectionTimeout = setTimeout(() => {
      if (!global.GoatBot.isConnected) {
        authManager?.showConnectionStatus("timeout");
        authManager?.showError("Connection timeout. Please try again.");
        reject(new Error("Connection timeout"));
      }
    }, 60000);

    if (phoneNumber) {
      sock.ev.on("connection.update", async (update) => {
        if (update.qr) {
          try {
            const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ""));
            console.log(chalk.green.bold(`\n🔑 Your pairing code: ${code}`));
            console.log(chalk.yellow("⏰ Code expires in 60 seconds"));
            console.log(chalk.cyan("📱 Enter this code in WhatsApp > Settings > Linked Devices\n"));
            authManager?.showConnectionStatus("pairing_ready");
          } catch (error) {
            authManager?.showError("Failed to generate pairing code", error);
            reject(error);
          }
        }
      });
    }

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !phoneNumber) {
        authManager?.showConnectionStatus("qr_ready");
        // Dynamically adjust QR code size based on console width
        const consoleWidth = process.stdout.columns || 80; // Default to 80 if undefined
        const qrSize = Math.min(Math.floor(consoleWidth / 2), 30); // Limit to half console width or 20 chars
        qrcode.generate(qr, {
          small: true,
          // Custom size adjustment (reduce module size for compactness)
          size: qrSize,
        });
        console.log(chalk.cyan("👆 Scan the QR code above with WhatsApp"));
        console.log(chalk.yellow("📱 WhatsApp > Settings > Linked Devices > Link a Device\n"));
      }

      if (connection === "close") {
        clearTimeout(connectionTimeout);
        const shouldReconnect =
          new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

          switch (statusCode) {
            case DisconnectReason.badSession:
              authManager?.showError("Bad session file. Clearing session...");
              await authManager?.clearSession();
              break;
            case DisconnectReason.connectionClosed:
              authManager?.showConnectionStatus("disconnected");
              logger.info("🔄 Connection closed. Attempting to reconnect...");
              break;
            case DisconnectReason.connectionLost:
              authManager?.showConnectionStatus("disconnected");
              logger.info("📡 Connection lost. Attempting to reconnect...");
              break;
            case DisconnectReason.connectionReplaced:
              authManager?.showError("Connection replaced by another session");
              await authManager?.clearSession();
              break;
            case DisconnectReason.timedOut:
              authManager?.showError("Connection timed out");
              break;
            default:
              authManager?.showError("Unknown disconnection reason");
          }

          global.GoatBot.isConnected = false;
          global.GoatBot.connectionStatus = "reconnecting";

          const retryDelay = Math.min(1000 * Math.pow(2, connectionAttempts - 1), 10000);
          setTimeout(() => {
            startConnection(phoneNumber, resolve, reject);
          }, retryDelay);
        } else {
          authManager?.showError("Session expired or logged out");
          await authManager?.clearSession();
          global.GoatBot.isConnected = false;
          global.GoatBot.sessionValid = false;
          reject(new Error("Session expired"));
        }
      } else if (connection === "connecting") {
        authManager?.showConnectionStatus("connecting");
        global.GoatBot.connectionStatus = "connecting";
      } else if (connection === "open") {
        clearTimeout(connectionTimeout);
        connectionAttempts = 0;

        authManager?.showConnectionStatus("connected");
        // authManager?.showSuccess();

        global.GoatBot.user = sock.user;
        global.GoatBot.isConnected = true;
        global.GoatBot.sessionValid = true;
        global.GoatBot.connectionStatus = "connected";
        global.GoatBot.waitingForAuth = false;

      /*  logger.info("📦 Loading plugins...");
        try {
          loadPlugins(logger);
          logger.info("✅ All plugins loaded successfully");
        } catch (error) {
          logger.error("❌ Failed to load some plugins:", error);
        }

        logger.info("🎉 Bot is ready to use!"); */

        await sendWelcomeMessage();

        resolve(sock);
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
      try {
        if (!global.GoatBot.isConnected) return;

        const msg = m.messages[0];
        if (!msg?.message || msg.key.fromMe) return;
        if (config.antiInbox && !msg.key.remoteJid.endsWith("@g.us")) return;

        global.GoatBot.stats.messagesProcessed++;
        await messageHandler({ sock, msg, config, db: require("../database/manager"), logger });
      } catch (error) {
        logger.error("❌ Error processing message:", error);
        global.GoatBot.stats.errors++;
      }
    });

    sock.ev.on("group-participants.update", async (update) => {
      try {
        if (!global.GoatBot.isConnected) return;

        const welcomeEvent = global.GoatBot.events.get("welcome");
        if (welcomeEvent) {
          await welcomeEvent.onEvent({
            api: sock,
            event: update,
            db: require("../database/manager"),
            logger,
          });
        }
      } catch (error) {
        logger.error("❌ Error processing group event:", error);
        global.GoatBot.stats.errors++;
      }
    });

    sock.ev.on("call", async (callInfo) => {
      try {
        for (const call of callInfo) {
          if (call.status === "offer") {
            await sock.rejectCall(call.id, call.from);
            logger.info(`📞 Rejected call from ${call.from}`);
          }
        }
      } catch (error) {
        logger.error("❌ Error handling call:", error);
      }
    });

    sock.ev.on("presence.update", async (presenceUpdate) => {
      try {
        // Handle presence updates if needed
      } catch (error) {
        logger.error("❌ Error handling presence update:", error);
      }
    });
  } catch (error) {
    authManager?.showError("Connection failed", error);
    global.GoatBot.stats.errors++;
    reject(error);
  }
}

async function sendWelcomeMessage() {
  try {
    if (config.admins && config.admins.length > 0) {
      const welcomeText = `🐐 *GOAT Bot Connected!*\n\n✅ Authentication: ${
        global.GoatBot.authMethod
      }\n⏰ Started: ${new Date().toLocaleString()}\n📊 Dashboard: http://localhost:${
        process.env.PORT || 3000
      }\n\n🚀 Bot is ready to receive commands!`;

      await sock.sendMessage(config.admins[0], {
        text: welcomeText,
      });

      logger.info("📨 Welcome message sent to admin");
    }
  } catch (error) {
    logger.warn("⚠️ Could not send welcome message to admin:", error.message);
  }
}

// Export additional utilities
module.exports = {
  connect,
  getSock: () => sock,
  getConnectionStatus: () => global.GoatBot.connectionStatus,
  isConnected: () => global.GoatBot.isConnected,
  getAuthManager: () => authManager,
  restart: async () => {
    if (sock) {
      sock.end();
    }
    connectionAttempts = 0;
    return connect();
  },
};
