require('module-alias/register');
const chalk = require("chalk");
const { logger } = require("./libs/logger");
const config = require("./config.json");
const db = require("./database/manager");
const express = require("express");
const cors = require("cors");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs-extra");
const { connect, AUTH_ERROR } = require("./bot/connect");


// Track restart attempts to prevent infinite loops
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;

const banner = `
 ██████╗  ██████╗  █████╗ ████████╗
██╔════╝ ██╔═══██╗██╔══██╗╚══██╔══╝
██║  ███╗██║   ██║███████║   ██║   
██║   ██║██║   ██║██╔══██║   ██║   
╚██████╔╝╚██████╔╝██║  ██║   ██║   
 ╚═════╝  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   
        Made by Anonymous
`;

function printBanner() {
  console.clear();
  console.log(chalk.cyan(banner));
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
};

// Temporarily silence logger during authentication
const originalLoggerLevel = logger.level;
logger.setLevel("silent");

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

// Express dashboard
let app, server;

function initializeApp() {
  if (app) return app;
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "dashboard")));

  app.get("/api/status", (_, res) => {
    res.json({
      status: global.GoatBot.connectionStatus,
      isConnected: global.GoatBot.isConnected,
      uptime: Date.now() - global.GoatBot.startTime,
      stats: global.GoatBot.stats,
      commands: Array.from(global.GoatBot.commands.keys()),
      events: Array.from(global.GoatBot.events.keys()),
      authMethod: global.GoatBot.authMethod,
      sessionValid: global.GoatBot.sessionValid,
      initialized: global.GoatBot.initialized,
    });
  });

  app.get("/api/auth/restart", (_, res) => {
    res.json({ message: "Forcing auth re-initialisation…" });
    invalidateSessionAndRestart();
  });

  app.get("/", (_, res) => res.sendFile(path.join(__dirname, "dashboard", "index.html")));
  return app;
}

function startServer() {
  if (server) return;
  const PORT = process.env.PORT || 3000;
  const app = initializeApp();
  server = app.listen(PORT, () => logger.info(`📊 Dashboard available at http://localhost:${PORT}`));

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      logger.error(`❌ Port ${PORT} is already in use.`);
      process.exit(1);
    }
    logger.error("❌ Server error:", error);
  });
}

// Database
async function connectDatabase() {
  try {
    await db.connect(config.database);
    logger.info("✅ Database connected successfully.");
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
    console.error(chalk.red("❌ Failed to create session folder:"), error.message);
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
          console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
          process.exit(1);
        }
        restartAttempts++;
        console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
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
    console.error(chalk.red("❌ ensureAuthenticated failed after manual restart:"), e.message);
    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
      console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
      process.exit(1);
    }
    restartAttempts++;
    console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
    gracefulRestart();
  });
}

function gracefulRestart() {
  console.log(chalk.yellow(`🔄 Initiating graceful restart (attempt ${restartAttempts + 1}/${MAX_RESTART_ATTEMPTS}) …`));
  if (server) {
    server.close(() => console.log(chalk.yellow("🔌 Server closed.")));
  }
  process.exit(2);
}

async function start() {
  // Defer database connection and dashboard start until after authentication
  await ensureAuthenticated();

  // Restore logger level after authentication
  logger.setLevel(originalLoggerLevel);
  logger.info("🚀 Initialising GOAT WhatsApp Bot …");

  // Connect database
  if (!(await connectDatabase())) process.exit(1);

  // Start dashboard
  startServer();

  // Flag ready
  global.GoatBot.initialized = true;
  logger.info("🎉 GOAT Bot is now online and ready! Enjoy! ✨");
}

start().catch((err) => {
  console.error(chalk.red("❌ Unexpected top-level failure:"), err.message);
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
    process.exit(1);
  }
  restartAttempts++;
  console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
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
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
    process.exit(1);
  }
  restartAttempts++;
  console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
  gracefulRestart();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(chalk.red("💥 Unhandled Rejection at:"), promise, "reason:", reason.message || reason);
  global.GoatBot.stats.errors++;
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
    process.exit(1);
  }
  restartAttempts++;
  console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
  gracefulRestart();
});