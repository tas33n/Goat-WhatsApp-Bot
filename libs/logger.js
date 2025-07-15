const pino = require("pino");

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info", // Default to 'info', can be set to 'silent'
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:dd-mm-yyyy HH:mm:ss", // Fixed MM to mm for minutes
      // Ensure Unicode support for emojis
      sync: true, // Ensures immediate output to handle emojis correctly
      colorizeObjects: true, // Helps with formatting complex objects
    },
  },
});

// Custom logger wrapper to respect silent mode and ensure emoji compatibility
const logger = {
  level: "info", // Default level, can be changed dynamically
  info: (msg, ...args) => {
    if (logger.level !== "silent") {
      pinoLogger.info(msg, ...args);
    }
  },
  error: (msg, ...args) => {
    if (logger.level !== "silent") {
      pinoLogger.error(msg, ...args);
    }
  },
  warn: (msg, ...args) => {
    if (logger.level !== "silent") {
      pinoLogger.warn(msg, ...args);
    }
  },
  // Method to set log level dynamically
  setLevel: (level) => {
    logger.level = level;
    pinoLogger.level = level; // Sync with pino's level
  },
};

module.exports = { logger };