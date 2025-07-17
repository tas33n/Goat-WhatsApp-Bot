const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const chalk = require("chalk");
const config = require("../config.json");
const { logger } = require("../libs/logger");
const { loadPlugins } = require("./loader");
const messageHandler = require("./handler");
const AuthManager = require("./auth");
const fs = require("fs-extra");
const path = require("path");

let sock;
let authManager;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
let decryptionErrors = new Map(); // Track decryption errors per contact

// Export AUTH_ERROR for use in Goat.js
module.exports.AUTH_ERROR = new Boom("AUTH", { statusCode: 401 });

// Handle decryption errors
async function handleDecryptionError(remoteJid, error) {
  try {
    const errorCount = decryptionErrors.get(remoteJid) || 0;
    decryptionErrors.set(remoteJid, errorCount + 1);
    
    logger.warn(`🔑 Decryption error for ${remoteJid} (count: ${errorCount + 1}): ${error.message}`);
    
    // If we have too many decryption errors for this contact, clear their session
    if (errorCount > 5) {
      logger.warn(`🔑 Too many decryption errors for ${remoteJid}, clearing session data`);
      
      // Clear session files for this specific contact
      const sessionPath = path.join(process.cwd(), "session");
      const sessionFiles = await fs.readdir(sessionPath);
      
      for (const file of sessionFiles) {
        if (file.includes(remoteJid.replace("@", "").replace(".", ""))) {
          const filePath = path.join(sessionPath, file);
          await fs.remove(filePath);
          logger.info(`🗑️ Removed session file: ${file}`);
        }
      }
      
      // Reset error count
      decryptionErrors.delete(remoteJid);
    }
  } catch (err) {
    logger.error("❌ Error handling decryption error:", err);
  }
}

// Clean up old decryption errors (reset every hour)
setInterval(() => {
  decryptionErrors.clear();
  logger.debug("🔄 Cleared decryption error cache");
}, 3600000); // 1 hour

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
        global.GoatBot.authMethod;
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

    // Validate session state and clean up if needed
    if (state.creds && state.creds.me) {
      const sessionPath = path.join(process.cwd(), "session");
      const sessionFiles = await fs.readdir(sessionPath);
      
      // Check for corrupted session files
      const corruptedFiles = [];
      for (const file of sessionFiles) {
        if (file.startsWith("session-") && file.endsWith(".json")) {
          try {
            const filePath = path.join(sessionPath, file);
            const content = await fs.readFile(filePath, "utf8");
            JSON.parse(content); // Validate JSON
          } catch (error) {
            corruptedFiles.push(file);
          }
        }
      }
      
      // Remove corrupted session files
      if (corruptedFiles.length > 0) {
        logger.warn(`🔧 Found ${corruptedFiles.length} corrupted session files, removing...`);
        for (const file of corruptedFiles) {
          await fs.remove(path.join(sessionPath, file));
          logger.info(`🗑️ Removed corrupted file: ${file}`);
        }
      }
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
      // Enhanced options to prevent "Bad MAC" errors
      getMessage: async (key) => {
        try {
          return { conversation: "This message was deleted" };
        } catch (error) {
          logger.warn("⚠️ Failed to get message:", error.message);
          return { conversation: "Message unavailable" };
        }
      },
      shouldIgnoreJid: (jid) => {
        // Ignore problematic JIDs that cause decryption errors
        const errorCount = decryptionErrors.get(jid) || 0;
        return errorCount > 10;
      },
      // Additional options to handle session errors
      syncFullHistory: false,
      emitOwnEvents: false,
      markOnlineOnConnect: false,
      msgRetryCounterMap: {},
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
        
        // Generate QR code for dashboard
        try {
          const qrDataURL = await QRCode.toDataURL(qr, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          global.GoatBot.qrCode = qrDataURL;
        } catch (error) {
          logger.error("Error generating QR code:", error);
          global.GoatBot.qrCode = null;
        }
        
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
        global.GoatBot.qrCode = null; // Clear QR code after connection
        global.GoatBot.sock = sock; // Store socket for later use

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

    // Add session monitoring
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === "close") {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          logger.info("🔄 Connection lost, attempting to reconnect...");
          setTimeout(() => {
            process.exit(2); // Exit with restart code
          }, 2000);
        } else {
          logger.error("❌ Logged out from WhatsApp, please re-authenticate");
          process.exit(1);
        }
      }
    });

    sock.ev.on("messages.upsert", async (m) => {
      try {
        if (!global.GoatBot.isConnected) return;

        const msg = m.messages[0];
        if (!msg?.message || msg.key.fromMe) return;
        if (config.antiInbox && !msg.key.remoteJid.endsWith("@g.us")) return;

        global.GoatBot.stats.messagesProcessed++;
        
        try {
          await messageHandler({ sock, msg, config, db: require("../database/manager"), logger });
        } catch (messageError) {
          // Handle specific decryption errors
          if (messageError.message?.includes("Bad MAC") || 
              messageError.message?.includes("decrypt") ||
              messageError.message?.includes("Failed to decrypt")) {
            
            logger.warn(`🔑 Message decryption failed for ${msg.key.remoteJid}: ${messageError.message}`);
            
            // Handle the decryption error
            await handleDecryptionError(msg.key.remoteJid, messageError);
            
            // Don't crash, just continue
            return;
          }
          
          // For other errors, log and continue
          logger.error(`❌ Message processing error: ${messageError.message}`);
          global.GoatBot.stats.errors++;
        }
      } catch (error) {
        // Handle session-related errors
        if (error.message?.includes("Bad MAC") || error.message?.includes("session")) {
          logger.error("❌ Session error detected:", error.message);
          logger.info("🔄 Attempting to restart connection...");
          
          // Mark as disconnected
          global.GoatBot.isConnected = false;
          global.GoatBot.sessionValid = false;
          
          // Restart the process
          setTimeout(() => {
            process.exit(2); // Exit with restart code
          }, 1000);
        } else {
          logger.error("❌ Error processing message:", error);
          global.GoatBot.stats.errors++;
        }
      }
    });

    sock.ev.on("group-participants.update", async (update) => {
      try {
        if (!global.GoatBot.isConnected) return;

        const welcomeEvent = global.GoatBot.events.get("welcome");
        if (welcomeEvent) {
          const DataUtils = require("../libs/dataUtils");
          const { getUserName } = require("../libs/utils");
          
          // Create utility objects similar to command handler
          const user = {
            getUser: async (userId) => await DataUtils.getUser(userId),
            updateUser: async (userId, data) => await DataUtils.updateUser(userId, data),
            addExperience: async (userId, amount) => {
              const userData = await DataUtils.getUser(userId);
              await DataUtils.updateUser(userId, {
                experience: (userData.experience || 0) + amount
              });
            }
          };
          
          const thread = {
            getThread: async (threadId) => await DataUtils.getThread(threadId || update.id),
            updateThread: async (data) => await DataUtils.updateThread(update.id, data)
          };
          
          const utils = {
            getUserName: async (userId) => await getUserName(userId)
          };
          
          await welcomeEvent.onEvent({
            api: sock,
            event: update,
            db: require("../database/manager"),
            logger,
            user,
            thread,
            utils
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
