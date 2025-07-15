const fs = require("fs");
const path = require("path");

function loadCommand(filePath, logger) {
  try {
    const command = require(filePath);
    if (!command.config?.name) {
      throw new Error("Missing 'config.name' in command file.");
    }
    const cmdName = command.config.name.toLowerCase();
    global.GoatBot.commands.set(cmdName, command);
    if (command.config.aliases) {
      command.config.aliases.forEach((alias) => {
        global.GoatBot.aliases.set(alias.toLowerCase(), cmdName);
      });
    }
    logger.info(`✅ Loaded command: ${cmdName}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to load command ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

function unloadCommand(filePath, logger) {
  try {
    const command = require(filePath);
    const cmdName = command.config.name.toLowerCase();
    if (global.GoatBot.commands.has(cmdName)) {
      global.GoatBot.commands.delete(cmdName);
    }
    if (command.config.aliases) {
      command.config.aliases.forEach((alias) => {
        if (global.GoatBot.aliases.get(alias.toLowerCase()) === cmdName) {
          global.GoatBot.aliases.delete(alias.toLowerCase());
        }
      });
    }
    delete require.cache[require.resolve(filePath)];
    logger.info(`🗑️ Unloaded command: ${cmdName}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to unload command ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

function loadEvent(filePath, logger) {
  try {
    const event = require(filePath);
    if (!event.config?.name) {
      throw new Error("Missing 'config.name' in event file.");
    }
    const eventName = event.config.name.toLowerCase();
    global.GoatBot.events.set(eventName, event);
    logger.info(`✅ Loaded event: ${eventName}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to load event ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

function unloadEvent(filePath, logger) {
  try {
    const event = require(filePath);
    const eventName = event.config.name.toLowerCase();
    if (global.GoatBot.events.has(eventName)) {
      global.GoatBot.events.delete(eventName);
    }
    delete require.cache[require.resolve(filePath)];
    logger.info(`🗑️ Unloaded event: ${eventName}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to unload event ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

function loadPlugins(logger) {
  const commandsPath = path.join(__dirname, "..", "plugins", "commands");
  const eventsPath = path.join(__dirname, "..", "plugins", "events");

  // Load Commands
  logger.info("--- LOADING COMMANDS ---");
  if (fs.existsSync(commandsPath)) {
    fs.readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"))
      .forEach((file) => {
        loadCommand(path.join(commandsPath, file), logger);
      });
  } else {
    logger.warn(`⚠️ Commands directory not found: ${commandsPath}`);
  }

  // Load Events
  logger.info("--- LOADING EVENTS ---");
  if (fs.existsSync(eventsPath)) {
    fs.readdirSync(eventsPath)
      .filter((file) => file.endsWith(".js"))
      .forEach((file) => {
        loadEvent(path.join(eventsPath, file), logger);
      });
  } else {
    logger.warn(`⚠️ Events directory not found: ${eventsPath}`);
  }
  logger.info("-------------------------");
}

module.exports = {
  loadPlugins,
  loadCommand,
  unloadCommand,
  loadEvent,
  unloadEvent,
};