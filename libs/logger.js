const winston = require('winston');

// Define the custom format for the console.
const customFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
  winston.format.splat(), // Necessary to correctly format error objects
  winston.format.printf((info) => {
    // Check if the message is an error object
    if (info instanceof Error) {
      return `[${info.timestamp}] ${info.level}: ${info.message}\n${info.stack}`;
    }
    // Check for error objects in the splat
    const splat = info[Symbol.for('splat')];
    if (splat && splat.length > 0 && splat[0] instanceof Error) {
        const error = splat[0];
        return `[${info.timestamp}] ${info.level}: ${info.message}\n${error.stack}`;
    }
    return `[${info.timestamp}] ${info.level}: ${info.message}`;
  })
);

// Create the logger instance.
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: customFormat,
    }),
  ],
});

// Method to set log level dynamically if needed
logger.setLevel = (level) => {
  logger.level = level;
};


module.exports = { logger };