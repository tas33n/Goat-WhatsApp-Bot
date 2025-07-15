const fs = require("fs");
const path = require("path");

function loadPlugins(logger) {
  const commandsPath = path.join(__dirname, "..", "plugins", "commands");
  const eventsPath = path.join(__dirname, "..", "plugins", "events");
  const loadedCommands = [];
  const loadedEvents = [];
  const failedCommands = [];
  const failedEvents = [];

  // Load Commands
  logger.info("--- LOADING COMMANDS ---");
  if (fs.existsSync(commandsPath)) {
    fs.readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"))
      .forEach((file) => {
        try {
          const command = require(path.join(commandsPath, file));
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
          loadedCommands.push(cmdName);
        } catch (error) {
          failedCommands.push({ file, error: error.message });
          logger.error(`❌ Failed to load command ${file}: ${error.message}`);
        }
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
        try {
          const event = require(path.join(eventsPath, file));
           if (!event.config?.name) {
            throw new Error("Missing 'config.name' in event file.");
          }
          const eventName = event.config.name.toLowerCase();
          global.GoatBot.events.set(eventName, event);
          loadedEvents.push(eventName);
        } catch (error) {
          failedEvents.push({ file, error: error.message });
          logger.error(`❌ Failed to load event ${file}: ${error.message}`);
        }
      });
  } else {
    logger.warn(`⚠️ Events directory not found: ${eventsPath}`);
  }

  // --- Load Summary ---
  logger.info("--- PLUGIN LOAD SUMMARY ---");
  logger.info(`✅ Commands Loaded: ${loadedCommands.length} (${loadedCommands.join(", ")})`);
  logger.info(`✅ Events Loaded: ${loadedEvents.length} (${loadedEvents.join(", ")})`);

  if (failedCommands.length > 0) {
    logger.error(`❌ Failed Commands (${failedCommands.length}): ${failedCommands.map(f => f.file).join(", ")}`);
  }
  if (failedEvents.length > 0) {
    logger.error(`❌ Failed Events (${failedEvents.length}): ${failedEvents.map(f => f.file).join(", ")}`);
  }
  logger.info("-------------------------");
}

module.exports = loadPlugins;