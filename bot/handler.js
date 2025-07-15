module.exports = async ({ sock, msg, config, db, logger }) => {
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""
  if (!body || !body.startsWith(config.prefix)) return

  const args = body.slice(config.prefix.length).trim().split(/ +/)
  const commandName = args.shift().toLowerCase()
  const command =
    global.GoatBot.commands.get(commandName) || global.GoatBot.commands.get(global.GoatBot.aliases.get(commandName))

  if (!command) return

  const senderJid = msg.key.remoteJid

  // --- Permission & Role Check ---
  const userRole = config.admins.includes(msg.key.participant || senderJid) ? 1 : 0

  if (command.config.role > userRole) {
    return sock.sendMessage(
      senderJid,
      { text: "❌ You lack the required permissions to use this command." },
      { quoted: msg },
    )
  }

  // --- Cooldown Check ---
  const now = Date.now()
  const timestamps = global.GoatBot.cooldowns.get(command.config.name) || new Map()
  const cooldownAmount = (command.config.countDown || 3) * 1000

  if (timestamps.has(senderJid)) {
    const expirationTime = timestamps.get(senderJid) + cooldownAmount
    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000
      return sock.sendMessage(
        senderJid,
        { text: `⏰ Please wait ${timeLeft.toFixed(1)}s before reusing this command.` },
        { quoted: msg },
      )
    }
  }
  timestamps.set(senderJid, now)
  global.GoatBot.cooldowns.set(command.config.name, timestamps)

  try {
    if (config.logCommands) {
      logger.info(`⚡ Executing: ${command.config.name} by ${senderJid}`)
    }

    global.GoatBot.stats.commandsExecuted++

    await command.onCmd({
      api: sock,
      message: msg,
      args,
      db,
      logger,
      config,
      reply: (text) => sock.sendMessage(senderJid, { text }, { quoted: msg }),
    })
  } catch (error) {
    logger.error(`❌ Error in command ${command.config.name}:`, error)
    global.GoatBot.stats.errors++
    sock.sendMessage(senderJid, { text: "❌ An unexpected error occurred." }, { quoted: msg })
  }
}
