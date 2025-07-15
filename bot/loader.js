const fs = require("fs")
const path = require("path")

function loadPlugins(logger) {
  const commandsPath = path.join(__dirname, "..", "plugins", "commands")
  const eventsPath = path.join(__dirname, "..", "plugins", "events")

  // Load Commands
  fs.readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"))
    .forEach((file) => {
      try {
        const command = require(path.join(commandsPath, file))
        global.GoatBot.commands.set(command.config.name.toLowerCase(), command)
        if (command.config.aliases) {
          command.config.aliases.forEach((alias) => {
            global.GoatBot.aliases.set(alias.toLowerCase(), command.config.name)
          })
        }
        logger.info(`Loaded Command: ${command.config.name}`)
      } catch (error) {
        logger.error(`Failed to load command ${file}:`, error)
      }
    })

  // Load Events
  fs.readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"))
    .forEach((file) => {
      try {
        const event = require(path.join(eventsPath, file))
        global.GoatBot.events.set(event.config.name.toLowerCase(), event)
        logger.info(`Loaded Event: ${event.config.name}`)
      } catch (error) {
        logger.error(`Failed to load event ${file}:`, error)
      }
    })
}

module.exports = loadPlugins
