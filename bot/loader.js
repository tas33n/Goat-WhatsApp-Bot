const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ModuleManager = require("../libs/moduleManager");

async function loadCommand(filePath, logger) {
  try {
    // Check and install dependencies for this command
    const moduleManager = new ModuleManager();
    const dependenciesOk = await moduleManager.checkCommandDependencies(filePath);
    
    if (!dependenciesOk) {
      logger.warn(`⚠️ Some dependencies failed to install for ${path.basename(filePath)}, loading anyway...`);
    }
    
    // Clear cache first to ensure we get the latest version
    const absolutePath = require.resolve(filePath);
    delete require.cache[absolutePath];
    
    const command = require(filePath);
    
    if (!command) {
      throw new Error("Command module exported undefined or null");
    }
    
    if (!command.config) {
      throw new Error("Missing 'config' object in command file");
    }
    
    if (!command.config.name) {
      throw new Error("Missing 'config.name' in command file");
    }
    
    if (!command.onCmd && !command.onStart) {
      throw new Error("Missing 'onCmd' or 'onStart' function in command file");
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
    // Get the absolute path for cache lookup
    const absolutePath = require.resolve(filePath);
    
    // Try to get the command from cache first
    let command;
    if (require.cache[absolutePath]) {
      command = require.cache[absolutePath].exports;
    } else {
      // If not in cache, try to require it
      command = require(filePath);
    }
    
    if (command && command.config && command.config.name) {
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
      logger.info(`🗑️ Unloaded command: ${cmdName}`);
    }
    
    // Clear the cache
    delete require.cache[absolutePath];
    return true;
  } catch (error) {
    logger.error(`❌ Failed to unload command ${path.basename(filePath)}: ${error.message}`);
    // Still clear the cache even if there was an error
    try {
      delete require.cache[require.resolve(filePath)];
    } catch (e) {
      // Ignore cache clearing errors
    }
    return false;
  }
}

async function loadEvent(filePath, logger) {
  try {
    // Check and install dependencies for this event
    const moduleManager = new ModuleManager();
    const dependenciesOk = await moduleManager.checkCommandDependencies(filePath);
    
    if (!dependenciesOk) {
      logger.warn(`⚠️ Some dependencies failed to install for ${path.basename(filePath)}, loading anyway...`);
    }
    
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

async function loadPlugins(logger) {
  const commandsPath = path.join(__dirname, "..", "plugins", "commands");
  const eventsPath = path.join(__dirname, "..", "plugins", "events");

  // Initialize module manager and scan for all dependencies first
  const moduleManager = new ModuleManager();
  logger.info(chalk.cyan.bold(`--- Checking Dependencies ---`));
  const dependencySuccess = await moduleManager.scanAndInstallAllDependencies();
  
  if (!dependencySuccess) {
    logger.warn("⚠️ Some dependencies failed to install, but continuing with plugin loading...");
  }
  
  const stats = moduleManager.getStats();
  if (stats.installedCount > 0) {
    logger.info(`✅ Auto-installed ${stats.installedCount} missing modules: ${stats.installed.join(", ")}`);
  }
  if (stats.failedCount > 0) {
    logger.warn(`⚠️ Failed to install ${stats.failedCount} modules: ${stats.failed.join(", ")}`);
  }

  // Load Commands
  logger.info(chalk.cyan.bold(`--- Commands ---`));
  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
      await loadCommand(path.join(commandsPath, file), logger);
    }
  } else {
    logger.warn(`⚠️ Commands directory not found: ${commandsPath}`);
  }
  logger.info(chalk.white(`- Commands:     ${chalk.green(global.GoatBot.commands.size)} loaded`));

  // Load Events
  logger.info(chalk.cyan.bold(`--- Events ---`));
  if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));
    for (const file of eventFiles) {
      await loadEvent(path.join(eventsPath, file), logger);
    }
  } else {
    logger.warn(`⚠️ Events directory not found: ${eventsPath}`);
  }
  logger.info(chalk.white(`- Events:       ${chalk.green(global.GoatBot.events.size)} loaded`));

  logger.info("-------------------------");
}

module.exports = {
  loadPlugins,
  loadCommand,
  unloadCommand,
  loadEvent,
  unloadEvent,
};
