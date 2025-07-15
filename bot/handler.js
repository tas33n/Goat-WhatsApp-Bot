module.exports = async ({ sock, msg, config, db, logger }) => {
  // Extract message body from various message types
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";
  
  // Log all incoming messages with details
  const senderJid = msg.key.remoteJid;
  const isGroup = senderJid.endsWith("@g.us");
  const sender = msg.key.participant || senderJid;
  logger.info(`📨 Received message from ${sender} ${isGroup ? "(group)" : ""}: "${body}"`);

  // Skip if no body or not a command
  if (!body || !body.startsWith(config.prefix)) {
    logger.debug(`ℹ️ Message ignored: ${body ? "Not a command" : "Empty message"}`);
    return;
  }

  // Parse command and arguments
  const args = body.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  logger.debug(`🔍 Parsing command: "${commandName}" with args: [${args.join(", ")}]`);

  // Find command or alias
  const command =
    global.GoatBot.commands.get(commandName) ||
    global.GoatBot.commands.get(global.GoatBot.aliases.get(commandName));

  if (!command) {
    logger.warn(`⚠️ Command not found: "${commandName}"`);
    return sock.sendMessage(
      senderJid,
      { text: `❌ Command "${commandName}" not found.` },
      { quoted: msg },
    );
  }

  // Permission & Role Check
  const userRole = config.admins.includes(sender) ? 1 : 0;
  logger.debug(`👤 User ${sender} role: ${userRole} (required: ${command.config.role})`);

  if (command.config.role > userRole) {
    logger.warn(`🚫 Permission denied for ${sender} on command "${command.config.name}"`);
    return sock.sendMessage(
      senderJid,
      { text: "❌ You lack the required permissions to use this command." },
      { quoted: msg },
    );
  }

  // Cooldown Check
  const now = Date.now();
  const timestamps = global.GoatBot.cooldowns.get(command.config.name) || new Map();
  const cooldownAmount = (command.config.countDown || 3) * 1000;

  if (timestamps.has(sender)) {
    const expirationTime = timestamps.get(sender) + cooldownAmount;
    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      logger.info(`⏰ Cooldown active for ${sender} on "${command.config.name}": ${timeLeft.toFixed(1)}s remaining`);
      return sock.sendMessage(
        senderJid,
        { text: `⏰ Please wait ${timeLeft.toFixed(1)}s before reusing this command.` },
        { quoted: msg },
      );
    }
  }
  timestamps.set(sender, now);
  global.GoatBot.cooldowns.set(command.config.name, timestamps);

  try {
    if (config.logCommands) {
      logger.info(`⚡ Executing: ${command.config.name} by ${sender} with args: [${args.join(", ")}]`);
    }

    global.GoatBot.stats.commandsExecuted++;

    await command.onCmd({
      api: sock,
      message: msg,
      args,
      db,
      logger,
      config,
      reply: (text) => sock.sendMessage(senderJid, { text }, { quoted: msg }),
    });
  } catch (error) {
    logger.error(`❌ Error in command ${command.config.name}:`, error);
    global.GoatBot.stats.errors++;
    await sock.sendMessage(senderJid, { text: `❌ An error occurred: ${error.message}` }, { quoted: msg });
  }
};