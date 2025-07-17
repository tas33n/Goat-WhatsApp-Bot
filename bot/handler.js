const json = require("../database/json");

module.exports = async ({ sock, msg, config, db, logger }) => {
  const { isAdmin, getUserId, getThreadId, isGroupMessage, getMentions, getUserName, formatTime, isURL } = require("../libs/utils");
  const DataUtils = require("../libs/dataUtils");
  const MessageWrapper = require("../libs/messageWrapper");
  const APIWrapper = require("../libs/apiWrapper");
  // Extract message body from various message types
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";
  
  // Extract message information
  const senderJid = getThreadId(msg);
  const isGroup = isGroupMessage(msg);
  const sender = getUserId(msg);
  const messageId = msg.key.id;
  const timestamp = msg.messageTimestamp;
  
  // Store/update user data
  await storeUserData(db, sender, msg, isGroup);
  
  // Store/update thread data
  await storeThreadData(db, senderJid, msg, isGroup);
  
  // Store message data
  await storeMessageData(db, messageId, msg, body, sender, senderJid, timestamp);
  
  // Add experience for sending messages (1 exp per message, max 1 per minute)
  await addExperienceForMessage(sender, db);
  
  // Log all incoming messages with details
  logger.info(`📨 Received message from ${sender} ${isGroup ? "(group)" : ""}: "${body}"`);

  // Create utility objects for commands
  const user = {
    getUser: async (userId) => await DataUtils.getUser(userId || sender),
    getAllUsers: async () => await DataUtils.getAllUsers(),
    updateUser: async (userId, data) => await DataUtils.updateUser(userId || sender, data),
    getUserName: async (userId) => await getUserName(userId || sender),
    isAdmin: (userId) => isAdmin(userId || sender),
    getId: () => sender,
    getJid: () => senderJid,
    getData: async () => await DataUtils.getUser(sender),
    ban: async (userId, reason) => await DataUtils.updateUser(userId || sender, { banned: true, banReason: reason, banDate: Date.now() }),
    unban: async (userId) => await DataUtils.updateUser(userId || sender, { banned: false, banReason: null, banDate: null }),
    addExp: async (amount) => await DataUtils.updateUser(sender, { exp: (await DataUtils.getUser(sender)).exp + amount }),
    addMoney: async (amount) => await DataUtils.updateUser(sender, { money: (await DataUtils.getUser(sender)).money + amount }),
    warn: async (userId, reason) => {
      const userData = await DataUtils.getUser(userId || sender);
      const warnings = userData.warnings || [];
      warnings.push({ reason, date: Date.now() });
      await DataUtils.updateUser(userId || sender, { warnings });
      return warnings.length;
    }
  };

  const thread = {
    getThread: async (threadId) => await DataUtils.getThread(threadId || senderJid),
    getThreadData: async (threadId) => await DataUtils.getThread(threadId || senderJid), // Alias for backward compatibility
    updateThread: async (threadId, data) => await DataUtils.updateThread(threadId || senderJid, data),
    getId: () => senderJid,
    isGroup: () => isGroup,
    getMembers: async () => {
      if (!isGroup) return [];
      try {
        const groupMetadata = await sock.groupMetadata(senderJid);
        return groupMetadata.participants.map(p => p.id);
      } catch (error) {
        logger.error("Error getting group members:", error);
        return [];
      }
    },
    getAdmins: async () => {
      if (!isGroup) return [];
      try {
        const groupMetadata = await sock.groupMetadata(senderJid);
        return groupMetadata.participants.filter(p => p.admin).map(p => p.id);
      } catch (error) {
        logger.error("Error getting group admins:", error);
        return [];
      }
    },
    kick: async (userId) => {
      if (!isGroup) return false;
      try {
        await sock.groupParticipantsUpdate(senderJid, [userId], "remove");
        return true;
      } catch (error) {
        logger.error("Error kicking user:", error);
        return false;
      }
    },
    add: async (userId) => {
      if (!isGroup) return false;
      try {
        await sock.groupParticipantsUpdate(senderJid, [userId], "add");
        return true;
      } catch (error) {
        logger.error("Error adding user:", error);
        return false;
      }
    }
  };

  const role = {
    getRole: async (userId) => {
      // Check if user is bot admin first (highest priority)
      if (isAdmin(userId || sender, config)) return 2; // Bot admin
      
      // Check if user is group admin (only in groups)
      if (isGroup) {
        try {
          const groupMetadata = await sock.groupMetadata(senderJid);
          const participant = groupMetadata.participants.find(p => p.id === (userId || sender));
          if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
            return 1; // Group admin
          }
        } catch (error) {
          logger.error("Error checking group admin status:", error);
        }
      }
      
      // Check database for moderator status (fallback)
      const userData = await DataUtils.getUser(userId || sender);
      if (userData.moderator) return 1; // Moderator
      
      return 0; // Regular user
    },
    isAdmin: (userId) => isAdmin(userId || sender, config),
    isModerator: async (userId) => {
      const userData = await DataUtils.getUser(userId || sender);
      return userData.moderator || false;
    },
    promote: async (userId) => await DataUtils.updateUser(userId, { moderator: true }),
    demote: async (userId) => await DataUtils.updateUser(userId, { moderator: false }),
    hasPermission: async (userId, requiredRole) => {
      const userRole = await role.getRole(userId);
      
      // Bot admins (role 2) can access all commands (role 0, 1, 2, 3)
      if (userRole === 2) return true;
      
      // Group admins (role 1) can access role 0 and 1 commands
      if (userRole === 1 && requiredRole <= 1) return true;
      
      // Regular users (role 0) can only access role 0 commands
      if (userRole === 0 && requiredRole === 0) return true;
      
      return false;
    }
  };

  // Create GoatBot V2 style message object
  const message = new MessageWrapper(sock, msg, config, logger);
  
  // Create GoatBot V2 style API object
  const api = new APIWrapper(sock, config, logger);

  const reply = async (text, options = {}) => {
    return await message.reply(text, options);
  };

  const react = async (emoji) => {
    return await message.react(emoji);
  };

  const edit = async (messageKey, newText) => {
    return await message.edit(newText, messageKey);
  };

  const utils = {
    formatTime,
    isURL,
    getMentions: () => getMentions(msg),
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    formatNumber: (num) => num.toLocaleString(),
    formatMoney: (amount) => `$${amount.toLocaleString()}`,
    getPrefix: () => config.prefix,
    isOwner: (userId) => config.admins.includes(userId || sender)
  };

  // Handle non-command messages for events
  if (!body || !body.startsWith(config.prefix)) {
    // Handle onChat events
    for (const [eventName, eventHandler] of global.GoatBot.events) {
      if (eventHandler.config?.type === "chat" || eventHandler.onChat) {
        try {
          const eventParams = {
            api,
            message,
            body,
            user,
            thread,
            role,
            reply,
            react,
            edit,
            utils,
            config,
            db,
            logger
          };
          
          if (eventHandler.onChat) {
            await eventHandler.onChat(eventParams);
          }
        } catch (error) {
          logger.error(`Error in event ${eventName}:`, error);
        }
      }
    }
    
    // Handle onChat for commands (non-prefix messages)
    for (const [commandName, command] of global.GoatBot.commands) {
      if (command.onChat) {
        try {
          const commandParams = {
            api,
            message,
            body,
            user,
            thread,
            role,
            reply,
            react,
            edit,
            utils,
            config,
            db,
            logger
          };
          
          await command.onChat(commandParams);
        } catch (error) {
          logger.error(`Error in command ${commandName} onChat:`, error);
        }
      }
    }
    
    // Handle onReply for commands (when someone replies to bot's message)
    const hasReply = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || 
                     msg.message?.conversation?.contextInfo?.quotedMessage;
    
    if (hasReply) {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.conversation?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;
      const quotedMessageId = contextInfo?.stanzaId;
      const quotedParticipant = contextInfo?.participant;
      
      logger.info(`📝 Reply detected - quotedParticipant: ${quotedParticipant}, botId: ${sock.user?.id}`);
      
      // Check if the quoted message is from the bot
      // The bot's ID should be in the format: bot_number@s.whatsapp.net
      const botId = sock.user?.id?.replace(/:\d+/, '') || sock.user?.id;
      const isReplyToBot = quotedParticipant === botId || 
                           quotedParticipant === sock.user?.id ||
                           (!quotedParticipant && !isGroup); // Direct message reply
      
      logger.info(`📝 Reply check - isReplyToBot: ${isReplyToBot}, quotedParticipant: ${quotedParticipant}, botId: ${botId}`);
      
      if (isReplyToBot) {
        logger.info(`📝 Reply to bot detected from ${sender}`);
        
        // Look for commands that have onReply handlers
        for (const [commandName, command] of global.GoatBot.commands) {
          if (command.onReply) {
            try {
              const replyParams = {
                api,
                message,
                body,
                user,
                thread,
                role,
                reply,
                react,
                edit,
                utils,
                config,
                db,
                logger,
                quotedMessage,
                quotedMessageId,
                quotedParticipant
              };
              
              await command.onReply(replyParams);
            } catch (error) {
              logger.error(`Error in command ${commandName} onReply:`, error);
            }
          }
        }
      }
    } else {
      logger.info(`📝 No reply detected - message type: ${Object.keys(msg.message || {}).join(', ')}`);
    }
    
    logger.debug(`ℹ️ Message ignored: ${body ? "Not a command" : "Empty message"}`);
    return;
  }

  // Check if user is banned
  const userData = await DataUtils.getUser(sender);
  if (userData.banned) {
    logger.warn(`🚫 Banned user tried to use command: ${sender}`);
    return sock.sendMessage(
      senderJid,
      { text: `🚫 You are banned from using this bot.\n\nReason: ${userData.banReason || "No reason provided"}\nBan Date: ${userData.banDate ? new Date(userData.banDate).toLocaleString() : "Unknown"}` },
      { quoted: msg }
    );
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

  // Check thread admin-only mode
  if (isGroup) {
    const threadData = await DataUtils.getThread(senderJid);
    if (threadData && threadData.settings && threadData.settings.adminOnly && !isAdmin(sender, config)) {
      logger.warn(`🔒 Non-admin tried to use command in admin-only thread: ${sender}`);
      return sock.sendMessage(
        senderJid,
        { text: "🔒 This group is in admin-only mode. Only admins can use bot commands." },
        { quoted: msg }
      );
    }
  }

  // Permission & Role Check
  const userRole = await role.getRole(sender);
  const hasPermission = await role.hasPermission(sender, command.config.role);
  
  logger.debug(`👤 User ${sender} role: ${userRole} (required: ${command.config.role}) - Permission: ${hasPermission}`);

  if (!hasPermission) {
    logger.warn(`🚫 Permission denied for ${sender} on command "${command.config.name}"`);
    return sock.sendMessage(
      senderJid,
      { text: "❌ You lack the required permissions to use this command." },
      { quoted: msg },
    );
  }

  // Construct event object for commandParams
  
  const event = {
    senderName: msg.pushName || msg.verifiedBizName || "Unknown",
    senderID: sender || msg.key?.participant || "",
    threadID: senderJid || msg.key?.remoteJid || "",
    messageID: messageId || "",
    isGroup,
    body,
    timestamp,
    mentions: utils.getMentions(),
    mentionedJid: msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
    quotedMessage: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null,
    quotedMessageId: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
    quotedParticipant: msg.message?.extendedTextMessage?.contextInfo?.participant || null,
    replyData: {
      message: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.message?.conversation || null,
      participant: msg.message?.extendedTextMessage?.contextInfo?.participant || null,
      messageId: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
      body: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.message?.conversation || null
    },
    raw: json.stringify(msg, null, 2),
  };
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

    // Create comprehensive command parameters
    const commandParams = {
      event,
      api,
      message,
      args,
      user,
      thread,
      role,
      reply,
      react,
      edit,
      utils,
      config,
      db,
      logger
    };

    // Execute the appropriate handler
    if (command.onCmd) {
      await command.onCmd(commandParams);
    } else if (command.onStart) {
      await command.onStart(commandParams);
    } else if (command.execute) {
      // Legacy support
      await command.execute(commandParams);
    }
    
  } catch (error) {
    logger.error(`❌ Error in command ${command.config.name}:`, error);
    global.GoatBot.stats.errors++;
    await sock.sendMessage(senderJid, { text: `❌ An error occurred: ${error.message}` }, { quoted: msg });
  }
};

// Helper functions for data management
async function storeUserData(db, userId, msg, isGroup) {
  try {
    const userData = await db.get(`user_${userId}`) || {};
    
    // Try to get a better name from various sources
    let userName = userData.name || 'Unknown';
    
    // Check for pushName (WhatsApp display name)
    if (msg.pushName && msg.pushName !== userName && msg.pushName.trim()) {
      userName = msg.pushName.trim();
    }
    
    // Check for verifiedName (business accounts)
    if (msg.verifiedBizName && msg.verifiedBizName !== userName && msg.verifiedBizName.trim()) {
      userName = msg.verifiedBizName.trim();
    }
    
    // Try to get name from contact info if available
    if (userName === 'Unknown' && global.GoatBot.sock) {
      try {
        const contactInfo = await global.GoatBot.sock.onWhatsApp(userId);
        if (contactInfo && contactInfo.length > 0 && contactInfo[0].name) {
          userName = contactInfo[0].name.trim();
        }
      } catch (error) {
        // Silently ignore contact fetch errors
      }
    }
    
    // Check for notify name (participant name in groups)
    if (msg.key && msg.key.participant && msg.key.participant === userId) {
      if (msg.pushName && msg.pushName.trim()) {
        userName = msg.pushName.trim();
      }
    }
    
    // If we still have a generic name pattern, update it with actual name
    if (userName.startsWith('User ') && msg.pushName && msg.pushName.trim()) {
      userName = msg.pushName.trim();
    }
    
    // Update user information
    userData.id = userId;
    userData.name = userName;
    userData.lastSeen = Date.now();
    userData.messageCount = (userData.messageCount || 0) + 1;
    userData.isGroup = isGroup;
    
    // Track user activity
    if (!userData.firstSeen) {
      userData.firstSeen = Date.now();
    }
    
    // Store additional user info if available
    if (msg.verifiedBizName) {
      userData.businessName = msg.verifiedBizName;
    }
    
    await db.set(`user_${userId}`, userData);
  } catch (error) {
    console.error('Error storing user data:', error);
  }
}

async function storeThreadData(db, threadId, msg, isGroup) {
  try {
    const threadData = await db.get(`thread_${threadId}`) || {};
    
    // Update thread information
    threadData.id = threadId;
    threadData.isGroup = isGroup;
    threadData.lastActivity = Date.now();
    threadData.messageCount = (threadData.messageCount || 0) + 1;
    
    // For groups, store additional info
    if (isGroup) {
      threadData.groupName = msg.pushName || threadData.groupName || 'Unknown Group';
      threadData.participants = threadData.participants || [];
      
      // Add participant if not already in list
      const senderId = msg.key.participant || msg.key.remoteJid;
      if (!threadData.participants.includes(senderId)) {
        threadData.participants.push(senderId);
      }
    }
    
    // Track thread activity
    if (!threadData.firstActivity) {
      threadData.firstActivity = Date.now();
    }
    
    await db.set(`thread_${threadId}`, threadData);
  } catch (error) {
    console.error('Error storing thread data:', error);
  }
}

async function storeMessageData(db, messageId, msg, body, sender, threadId, timestamp) {
  try {
    const messageData = {
      id: messageId,
      body: body,
      sender: sender,
      threadId: threadId,
      timestamp: timestamp || Date.now(),
      type: getMessageType(msg),
      quoted: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ? true : false,
      mentions: msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
      isGroup: threadId.endsWith("@g.us"),
      raw: msg // Store raw message for debugging
    };
    
    // Store message data
    await db.set(`message_${messageId}`, messageData);
    
    // Update thread's recent messages
    const threadMessages = await db.get(`thread_messages_${threadId}`) || [];
    threadMessages.push(messageId);
    
    // Keep only last 100 messages per thread
    if (threadMessages.length > 100) {
      threadMessages.shift();
    }
    
    await db.set(`thread_messages_${threadId}`, threadMessages);
  } catch (error) {
    console.error('Error storing message data:', error);
  }
}

function getMessageType(msg) {
  if (msg.message?.conversation) return 'text';
  if (msg.message?.extendedTextMessage) return 'extendedText';
  if (msg.message?.imageMessage) return 'image';
  if (msg.message?.videoMessage) return 'video';
  if (msg.message?.audioMessage) return 'audio';
  if (msg.message?.documentMessage) return 'document';
  if (msg.message?.stickerMessage) return 'sticker';
  if (msg.message?.contactMessage) return 'contact';
  if (msg.message?.locationMessage) return 'location';
  return 'unknown';
}

async function addExperienceForMessage(userId, db) {
  try {
    // Check if user has gained experience in the last minute
    const lastExpKey = `lastExp_${userId}`;
    const lastExp = await db.get(lastExpKey);
    const now = Date.now();
    
    if (lastExp && (now - lastExp) < 60000) {
      // User gained experience less than a minute ago, skip
      return;
    }
    
    // Add experience using DataUtils
    const DataUtils = require("../libs/dataUtils");
    await DataUtils.addExperience(userId, 1);
    
    // Update last experience time
    await db.set(lastExpKey, now);
  } catch (error) {
    console.error('Error adding experience for message:', error);
  }
}
