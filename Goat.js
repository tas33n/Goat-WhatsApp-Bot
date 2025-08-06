require("module-alias/register");
const chalk = require("chalk");
const { logger } = require("./libs/logger");
const config = require("./config.json");
const db = require("./database/manager");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs-extra");
const chokidar = require("chokidar");
const os = require("os");
const { connect, AUTH_ERROR } = require("./bot/connect");
const { startServer, stopServer } = require("./dashboard/server");
const {
  loadPlugins,
  loadCommand,
  unloadCommand,
  loadEvent,
  unloadEvent,
} = require("./bot/loader");

// Initialize global configuration system
const GoatConfig = require("./libs/goatConfig");

// Track restart attempts to prevent infinite loops
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;

const gradient = require("gradient-string");

const bannerLines = [
  " ██████╗  █████╗  █████╗ ████████╗ ██╗   ██╗  ███╗",
  "██╔════╝ ██╔══██╗██╔══██╗╚══██╔══╝ ██║   ██║ ████║",
  "██║  ██╗ ██║  ██║███████║   ██║    ╚██╗ ██╔╝██╔██║",
  "██║  ╚██╗██║  ██║██╔══██║   ██║     ╚████╔╝ ╚═╝██║",
  "╚██████╔╝╚█████╔╝██║  ██║   ██║      ╚██╔╝  ███████╗",
  "╚═════╝  ╚════╝ ╚═╝  ╚═╝   ╚═╝       ╚═╝   ╚══════╝",
  "    Created by @anbuinfosec & @tas33n"
];

const compactBannerLines = [
  "█▀▀ █▀█ ▄▀█ ▀█▀   █▄▄ █▀█ ▀█▀   █ █ ▄█",
  "█▄█ █▄█ █▀█  █    █▄█ █▄█  █    ▀▄▀  █",
  "Created by @anbuinfosec & @tas33n"
];

function centerText(text, length) {
  const width = process.stdout.columns || 80;
  const leftPadding = Math.floor((width - (length || text.length)) / 2);
  const rightPadding = width - leftPadding - (length || text.length);
  const paddedString =
    " ".repeat(leftPadding > 0 ? leftPadding : 0) +
    text +
    " ".repeat(rightPadding > 0 ? rightPadding : 0);
  console.log(paddedString);
}

function createLine(content, isMaxWidth = false) {
  const widthConsole =
    process.stdout.columns > 50 ? 50 : process.stdout.columns || 50;
  if (!content) {
    return Array(isMaxWidth ? (process.stdout.columns || 50) : widthConsole)
      .fill("─")
      .join("");
  } else {
    content = ` ${content.trim()} `;
    const lengthContent = content.length;
    const lengthLine = isMaxWidth
      ? (process.stdout.columns || 50) - lengthContent
      : widthConsole - lengthContent;
    let left = Math.floor(lengthLine / 2);
    if (left < 0 || isNaN(left)) left = 0;
    const lineOne = Array(left).fill("─").join("");
    return lineOne + content + lineOne;
  }
}

function printBanner() {
  console.clear();

  // Print top line
  console.log(gradient("#f5af19", "#f12711")(createLine(null, true)));
  console.log();

  // Choose banner based on console width
  const maxWidth = process.stdout.columns || 80;
  const selectedBanner = maxWidth > 60 ? bannerLines : compactBannerLines;

  // Print main banner line by line with gradient
  for (const line of selectedBanner) {
    const textColor = gradient("#FA8BFF", "#2BD2FF", "#2BFF88")(line);
    centerText(textColor, line.length);
  }

  // Print subtitle lines with wrapping
  const currentVersion = require("./package.json").version;
  const vvv = currentVersion.charAt(0);

  const subtitle = `GoatBot V${vvv}@${currentVersion} - A simple WhatsApp bot with advanced features`;
  const subTitleArray = [];

  let subTitle = subtitle;
  if (subTitle.length > maxWidth) {
    while (subTitle.length > maxWidth) {
      let lastSpace = subTitle.slice(0, maxWidth).lastIndexOf(" ");
      lastSpace = lastSpace === -1 ? maxWidth : lastSpace;
      subTitleArray.push(subTitle.slice(0, lastSpace).trim());
      subTitle = subTitle.slice(lastSpace).trim();
    }
    if (subTitle) subTitleArray.push(subTitle);
  } else {
    subTitleArray.push(subTitle);
  }

  const author = "Created by @anbuinfosec & @tas33n with ♡";
  const srcUrl = "Source code: https://github.com/anbuinfosec/Goat-WhatsApp-Bot";
  const supportMsg = "FOR EDUCATIONAL PURPOSES ONLY";

  for (const t of subTitleArray) {
    const textColor2 = gradient("#9F98E8", "#AFF6CF")(t);
    centerText(textColor2, t.length);
  }

  centerText(gradient("#9F98E8", "#AFF6CF")(author), author.length);
  centerText(gradient("#9F98E8", "#AFF6CF")(srcUrl), srcUrl.length);
  centerText(gradient("#f5af19", "#f12711")(supportMsg), supportMsg.length);

  console.log();
  console.log(gradient("#f5af19", "#f12711")(createLine(null, true)));
}

printBanner();


// Global runtime state
global.GoatBot = {
  commands: new Map(),
  aliases: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  startTime: Date.now(),
  stats: {
    messagesProcessed: 0,
    commandsExecuted: 0,
    errors: 0,
  },
  isConnected: false,
  connectionStatus: "initializing",
  authMethod: null,
  sessionValid: false,
  initialized: false,
  qrCode: null,
  pairingCode: null,
  lastError: null,
  startAuthentication: async function () {
    try {
      this.connectionStatus = "connecting";
      this.qrCode = null;
      this.pairingCode = null;
      this.lastError = null;

      // Import the connect function
      const { connect } = require("./bot/connect");

      // Start the connection process
      await connect();

      return true;
    } catch (error) {
      this.lastError = error.message;
      this.connectionStatus = "error";
      logger.error("Error starting authentication:", error);
      return false;
    }
  },
};

// Initialize global utils
global.utils = require("./utils/utils");

// Temporarily silence logger during authentication
const originalLoggerLevel = logger.level;
logger.setLevel("debug");

async function promptLoginMethod() {
  printBanner();
  console.log(chalk.cyan("\n" + "=".repeat(50)));
  console.log(chalk.cyan.bold("           🔐 AUTHENTICATION REQUIRED"));
  console.log(chalk.cyan("=".repeat(50)));
  console.log(chalk.yellow("Please select a login method:\n"));

  const choices = [
    { name: "📷 QR code (recommended)", value: "qr" },
    { name: "📱 Pair-code login", value: "paircode" },
    { name: "📂 Re-import legacy session file", value: "session-file" },
    { name: "❌ Exit", value: "exit" },
  ];

  try {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "method",
        message: "Select authentication method:",
        choices,
        pageSize: 4,
        prefix: "🐐",
      },
    ]);

    if (answer.method === "exit") {
      console.log(chalk.yellow("👋 Exiting as requested by user."));
      process.exit(0);
    }
    return answer.method;
  } catch (error) {
    // Log error to console (bypassing silent mode) for debugging
    console.error(chalk.red("❌ Error in promptLoginMethod:"), error.message);
    global.GoatBot.stats.errors++;
    throw error; // Re-throw to handle in ensureAuthenticated
  }
}

// Database
async function connectDatabase() {
  try {
    await db.connect(config.database);
    // logger.info("✅ Database connected successfully.");
    return true;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    global.GoatBot.stats.errors++;
    return false;
  }
}

// Auth-aware connection logic

async function ensureAuthenticated() {
  const sessionPath = path.join(__dirname, "session");

  // Check and create session folder silently
  try {
    if (!(await fs.pathExists(sessionPath))) {
      await fs.mkdir(sessionPath);
      global.GoatBot.sessionValid = false;
      global.GoatBot.connectionStatus = "awaiting-login";
      global.GoatBot.authMethod = await promptLoginMethod();
    }
  } catch (error) {
    // Log to console for debugging, bypassing silent mode
    console.error(
      chalk.red("❌ Failed to create session folder:"),
      error.message
    );
    global.GoatBot.stats.errors++;
    // Instead of restarting, retry authentication
    global.GoatBot.connectionStatus = "awaiting-login";
    global.GoatBot.authMethod = await promptLoginMethod();
  }

  while (true) {
    try {
      global.GoatBot.connectionStatus = "connecting";
      await connect({ method: global.GoatBot.authMethod });
      global.GoatBot.isConnected = true;
      global.GoatBot.sessionValid = true;
      global.GoatBot.connectionStatus = "connected";
      restartAttempts = 0; // Reset restart attempts on success
      return;
    } catch (err) {
      // Log error to console for debugging, bypassing silent mode
      console.error(chalk.red("❌ Connection error:"), err.message);
      global.GoatBot.stats.errors++;
      if (err === AUTH_ERROR || err.message === "Session expired") {
        global.GoatBot.isConnected = false;
        global.GoatBot.sessionValid = false;
        global.GoatBot.connectionStatus = "awaiting-login";
        global.GoatBot.authMethod = await promptLoginMethod();
      } else {
        if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
          console.error(
            chalk.red(
              `❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`
            )
          );
          process.exit(1);
        }
        restartAttempts++;
        console.error(
          chalk.yellow(
            `⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`
          )
        );
        gracefulRestart();
      }
    }
  }
}

function invalidateSessionAndRestart() {
  global.GoatBot.sessionValid = false;
  global.GoatBot.authMethod = null;
  global.GoatBot.connectionStatus = "awaiting-login";
  logger.warn("🔄 Session invalidated by request – restarting auth flow…");
  ensureAuthenticated().catch((e) => {
    console.error(
      chalk.red("❌ ensureAuthenticated failed after manual restart:"),
      e.message
    );
    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
      console.error(
        chalk.red(
          `❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`
        )
      );
      process.exit(1);
    }
    restartAttempts++;
    console.error(
      chalk.yellow(
        `⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`
      )
    );
    gracefulRestart();
  });
}

function gracefulRestart() {
  console.log(
    chalk.yellow(
      `🔄 Initiating graceful restart (attempt ${
        restartAttempts + 1
      }/${MAX_RESTART_ATTEMPTS}) …`
    )
  );
  stopServer(() => console.log(chalk.yellow("🔌 Server closed.")));
  process.exit(2);
}

function watchPlugins() {
  const pluginPath = path.join(__dirname, "plugins");
  const watcher = chokidar.watch(pluginPath, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on("add", (filePath) => {
    // Only process .js files
    if (!filePath.endsWith(".js")) return;

    logger.info(`➕ New file detected: ${path.basename(filePath)}`);
    if (filePath.includes("commands")) {
      loadCommand(filePath, logger);
    } else if (filePath.includes("events")) {
      loadEvent(filePath, logger);
    }
  });

  watcher.on("change", (filePath) => {
    // Only process .js files
    if (!filePath.endsWith(".js")) return;

    logger.info(`✏️ File changed: ${path.basename(filePath)}`);
    if (filePath.includes("commands")) {
      unloadCommand(filePath, logger);
      loadCommand(filePath, logger);
    } else if (filePath.includes("events")) {
      unloadEvent(filePath, logger);
      loadEvent(filePath, logger);
    }
  });

  watcher.on("unlink", (filePath) => {
    // Only process .js files
    if (!filePath.endsWith(".js")) return;

    logger.info(`🗑️ File deleted: ${path.basename(filePath)}`);
    if (filePath.includes("commands")) {
      unloadCommand(filePath, logger);
    } else if (filePath.includes("events")) {
      unloadEvent(filePath, logger);
    }
  });

  logger.info("👀 Watching for plugin changes...");
}

async function start() {
  // Run session cleanup before starting
  // try {
  //   const { SessionCleaner } = require("./utils/sessionCleaner");
  //   const sessionCleaner = new SessionCleaner();
  //   await sessionCleaner.cleanCorruptedSessions();
  // } catch (error) {
  //   logger.warn("⚠️ Session cleanup failed:", error.message);
  // }

  // Defer database connection and dashboard start until after authentication
  await ensureAuthenticated();

  // Connect database
  if (!(await connectDatabase())) process.exit(1);

  // Store database in global object for access from other modules
  global.GoatBot.db = db;

  // Socket is already set in connect function, don't override it

  // Restore logger level after authentication
  logger.setLevel(originalLoggerLevel);

  // Load plugins first, then print summary
  await loadPlugins(logger);

  await printStartupSummary();

  // Auto-sync data after everything is initialized
  if (global.GoatBot.isConnected) {
    const SyncManager = require("./libs/syncManager");
    logger.info("🔄 Starting data sync...");

    try {
      // We need to get the socket from somewhere - let's store it in global
      if (global.GoatBot.sock) {
        const syncResult = await SyncManager.syncAllGroups(
          global.GoatBot.sock,
          global.GoatBot.db,
          logger
        );
        logger.info(
          `✅ Sync completed: ${syncResult.syncedGroups} groups, ${syncResult.syncedUsers} users`
        );
      }
    } catch (error) {
      logger.error("❌ Sync failed:", error);
    }
  }

  watchPlugins();

  // Start dashboard
  startServer();

  // Flag ready
  global.GoatBot.initialized = true;

  logger.info(chalk.yellow("" + "=".repeat(50)));
  logger.info(chalk.green("🎉 Bot is now online and ready to use!"));
  logger.info(chalk.yellow("=".repeat(50)));
}

async function printStartupSummary() {
  const { user, commands, events } = global.GoatBot;
  const botName = user.name || config.botName || "GoatBot";
  const botNumber = user.id?.split(":")[0] || "Not available";
  const dbStats = await db.getStats();

  logger.info(chalk.yellow("" + "=".repeat(50)));
  logger.info(chalk.cyan.bold(`           🐐 GOAT BOT INITIALIZED 🐐`));
  logger.info(chalk.yellow("=".repeat(50)));

  logger.info(chalk.white(`- Bot Name:     ${chalk.green(botName)}`));
  logger.info(chalk.white(`- Bot Number:   ${chalk.green(botNumber)}`));
  logger.info(chalk.white(`- Prefix:       ${chalk.green(config.prefix)}`));
  logger.info(
    chalk.white(`- Database:     ${chalk.green(config.database.type)}`)
  );
  logger.info(
    chalk.white(
      `- DB Entries:   ${chalk.green(dbStats.total || dbStats.entries || 0)}`
    )
  );

  logger.info(chalk.yellow("=".repeat(50)));
}

start().catch((err) => {
  console.error(chalk.red("❌ Unexpected top-level failure:"), err.message);
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(
      chalk.red(
        `❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`
      )
    );
    process.exit(1);
  }
  restartAttempts++;
  console.error(
    chalk.yellow(
      `⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`
    )
  );
  gracefulRestart();
});

process.on("SIGINT", () => {
  logger.info("📴 Received SIGINT – shutting down gracefully …");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("📴 Received SIGTERM – shutting down gracefully …");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error(chalk.red("💥 Uncaught Exception:"), error.message);
  global.GoatBot.stats.errors++;

  // Handle YouTube download errors
  if (
    error.message?.includes("youtube-dl-exec") ||
    error.message?.includes("yt-dlp")
  ) {
    console.error(
      chalk.yellow("🎬 YouTube download error detected, continuing...")
    );
    return; // Don't restart for YouTube errors
  }

  // Handle session-related errors
  if (
    error.message?.includes("Bad MAC") ||
    error.message?.includes("session") ||
    error.message?.includes("decrypt")
  ) {
    console.error(
      chalk.red("🔑 Session error detected, clearing session and restarting...")
    );

    // Clear session files
    const fs = require("fs-extra");
    const path = require("path");
    const sessionPath = path.join(__dirname, "session");

    fs.remove(sessionPath)
      .then(() => {
        console.log(chalk.yellow("✅ Session files cleared"));
        process.exit(2); // Exit with restart code
      })
      .catch(() => {
        process.exit(2); // Exit with restart code anyway
      });

    return;
  }

  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(
      chalk.red(
        `❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`
      )
    );
    process.exit(1);
  }
  restartAttempts++;
  console.error(
    chalk.yellow(
      `⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`
    )
  );
  gracefulRestart();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    chalk.red("💥 Unhandled Rejection at:"),
    promise,
    "reason:",
    reason.message || reason
  );
  global.GoatBot.stats.errors++;

  // Handle session-related errors
  if (
    reason.message?.includes("Bad MAC") ||
    reason.message?.includes("session") ||
    reason.message?.includes("decrypt")
  ) {
    console.error(
      chalk.red("🔑 Session error detected, clearing session and restarting...")
    );

    // Clear session files
    const fs = require("fs-extra");
    const path = require("path");
    const sessionPath = path.join(__dirname, "session");

    fs.remove(sessionPath)
      .then(() => {
        console.log(chalk.yellow("✅ Session files cleared"));
        process.exit(2); // Exit with restart code
      })
      .catch(() => {
        process.exit(2); // Exit with restart code anyway
      });

    return;
  }

  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(
      chalk.red(
        `❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`
      )
    );
    process.exit(1);
  }
  restartAttempts++;
  console.error(
    chalk.yellow(
      `⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`
    )
  );
  gracefulRestart();
});
