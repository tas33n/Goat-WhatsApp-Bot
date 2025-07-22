const fs = require("fs-extra");
const path = require("path");
const {
  isAdmin,
  getUserId,
  getThreadId,
  isGroupMessage,
  getMentions,
  getUserName,
  formatTime,
  isURL,
} = require("../libs/utils");
const DataUtils = require("../libs/dataUtils");
const MessageWrapper = require("../libs/messageWrapper");
const APIWrapper = require("../libs/apiWrapper");
const jsonDB = require("../database/json");

// Simple in-memory cooldown map per command
const cooldowns = new Map();

/**
 * Unified handler for incoming Baileys events (messages upsert, group updates).
 */
module.exports = async function handleMessage({ sock, event, msg, config, db, logger }) {
  try {
    // Determine raw message payload for messages.upsert
    let rawMsg = msg;
    if (event?.messages) rawMsg = event.messages[0];
    if (!rawMsg || !rawMsg.message) {
      logger.debug("No message payload in event, skipping");
      return;
    }

    // Extract common fields
    const sender = getUserId(rawMsg);
    const threadId = getThreadId(rawMsg);
    const isGroup = isGroupMessage(rawMsg);
    const body =
      rawMsg.message?.conversation ||
      rawMsg.message?.extendedTextMessage?.text ||
      rawMsg.message?.imageMessage?.caption ||
      rawMsg.message?.videoMessage?.caption ||
      "";
    const timestamp = rawMsg.messageTimestamp;

    // Persist metadata
    await Promise.all([
      storeUserData(db, sender, rawMsg, isGroup),
      storeThreadData(db, threadId, rawMsg, isGroup),
      storeMessageData(db, rawMsg.key.id, rawMsg, body, sender, threadId, timestamp),
      addExperienceForMessage(sender, db),
    ]);

    logger.info(`📨 Received from ${sender}${isGroup ? " (group)" : ""}: "${body}"`);

    // Prepare helpers
    const user = makeUserHelpers(sender, threadId, rawMsg, sock, db, config, logger);
    const thread = makeThreadHelpers(threadId, rawMsg, sock, isGroup, logger);
    const role = makeRoleHelpers(sender, threadId, isGroup, sock, db, config, logger);
    const message = new MessageWrapper(sock, rawMsg, config, logger);
    const api = new APIWrapper(sock, config, logger);
    const utils = {
      formatTime,
      isURL,
      getMentions: () => getMentions(rawMsg),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
      formatNumber: (num) => num.toLocaleString(),
      formatMoney: (amt) => `$${amt.toLocaleString()}`,
      getPrefix: () => config.prefix,
      isOwner: (uid) => config.admins.includes(uid || sender),
    };
    const reply = (txt, opts) => message.reply(txt, opts);
    const react = (emj) => message.react(emj);
    const edit = (key, txt) => message.edit(txt, key);

    // Build event object for commands
    const eventData = {
      senderName: rawMsg.pushName || rawMsg.verifiedBizName || "Unknown",
      senderID: sender,
      threadID: threadId,
      messageID: rawMsg.key.id,
      isGroup,
      body,
      timestamp,
      mentions: getMentions(rawMsg),
      mentionedJid: rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
      quotedMessage: rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null,
      quotedMessageId: rawMsg.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
      quotedParticipant: rawMsg.message?.extendedTextMessage?.contextInfo?.participant || null,
      raw: event,
    };

    // Non-command: onChat / onReply handlers
    if (!body.startsWith(config.prefix)) {
      for (const [ename, handler] of global.GoatBot.events) {
        if (handler.onChat)
          await safeInvoke(() =>
            handler.onChat({
              sock,
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
            })
          );
      }
      for (const [cname, cmd] of global.GoatBot.commands) {
        if (cmd.onChat)
          await safeInvoke(() =>
            cmd.onChat({
              sock,
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
            })
          );
      }
      const ctx = rawMsg.message.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;
      if (quoted && ctx.participant) {
        const botId = sock.user?.id?.split(":")[0];
        if (ctx.participant === botId) {
          for (const [cname, cmd] of global.GoatBot.commands) {
            if (cmd.onReply)
              await safeInvoke(() =>
                cmd.onReply({
                  sock,
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
                  quotedMessage: quoted,
                  quotedMessageId: ctx.stanzaId,
                  quotedParticipant: ctx.participant,
                })
              );
          }
        }
      }
      return;
    }

    // Check ban
    const udata = await DataUtils.getUser(sender);
    if (udata.banned) {
      return sock.sendMessage(
        threadId,
        { text: `🚫 You are banned. Reason: ${udata.banReason || "None"}` },
        { quoted: rawMsg }
      );
    }

    // Parse command
    const parts = body.slice(config.prefix.length).trim().split(/ +/);
    const cmdName = parts.shift().toLowerCase();
    const args = parts;
    const command =
      global.GoatBot.commands.get(cmdName) ||
      global.GoatBot.commands.get(global.GoatBot.aliases.get(cmdName));
    if (!command) return reply(`❌ Command "${cmdName}" not found.`);

    // Admin-only group
    if (isGroup) {
      const tdata = await db.get(`thread_${threadId}`);
      if (tdata?.settings?.adminOnly && !isAdmin(sender, config))
        return reply("🔒 Only admins can use commands in this group.");
    }

    // Permission
    if (!(await role.hasPermission(command.config.role))) return reply("❌ You lack permissions.");

    // Cooldown per command
    const cd = command.config.countDown || 0;
    if (cd > 0) {
      if (!cooldowns.has(command.config.name)) cooldowns.set(command.config.name, new Map());
      const map = cooldowns.get(command.config.name);
      const last = map.get(sender) || 0;
      const now = Date.now();
      if (now - last < cd * 1000) {
        const timeLeft = ((cd * 1000 - (now - last)) / 1000).toFixed(1);
        return reply(`⏰ Wait ${timeLeft}s before using this command again.`);
      }
      map.set(sender, now);
    }

    // Execute
    global.GoatBot.stats.commandsExecuted++;
    logger.info(`⚡ ${cmdName} by ${sender}`);
    const fn = command.onCmd || command.onStart || command.execute;
    const params = {
      sock,
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
      logger,
      event: eventData,
    };
    await fn.call(command, params);
  } catch (err) {
    logger.error("❌ Handler error:", err);
  }
};

// ---------- Data & Helper Functions ----------

async function storeUserData(db, userId, msg, isGroup) {
  const key = `user_${userId}`;
  const userData = (await db.get(key)) || {};
  let name = userData.name || msg.pushName || msg.verifiedBizName || "Unknown";
  Object.assign(userData, {
    id: userId,
    name,
    firstSeen: userData.firstSeen || Date.now(),
    lastSeen: Date.now(),
    messageCount: (userData.messageCount || 0) + 1,
    isGroup,
  });
  await db.set(key, userData);
}

async function storeThreadData(db, threadId, msg, isGroup) {
  const key = `thread_${threadId}`;
  const t = (await db.get(key)) || {};
  Object.assign(t, {
    id: threadId,
    isGroup,
    firstActivity: t.firstActivity || Date.now(),
    lastActivity: Date.now(),
    messageCount: (t.messageCount || 0) + 1,
  });
  if (isGroup) {
    t.groupName = t.groupName || msg.pushName;
    t.participants = t.participants || [];
    if (!t.participants.includes(msg.key.participant)) t.participants.push(msg.key.participant);
  }
  await db.set(key, t);
}

async function storeMessageData(db, messageId, msg, body, sender, threadId, timestamp) {
  const key = `message_${messageId}`;
  const m = {
    id: messageId,
    body,
    sender,
    threadId,
    timestamp,
    type: getMessageType(msg),
    raw: msg,
  };
  await db.set(key, m);
  const arr = (await db.get(`thread_messages_${threadId}`)) || [];
  arr.push(messageId);
  if (arr.length > 100) arr.shift();
  await db.set(`thread_messages_${threadId}`, arr);
}

function getMessageType(msg) {
  if (msg.message?.conversation) return "text";
  if (msg.message?.extendedTextMessage) return "extendedText";
  if (msg.message?.imageMessage) return "image";
  if (msg.message?.videoMessage) return "video";
  if (msg.message?.audioMessage) return "audio";
  if (msg.message?.documentMessage) return "document";
  if (msg.message?.stickerMessage) return "sticker";
  if (msg.message?.contactMessage) return "contact";
  if (msg.message?.locationMessage) return "location";
  return "unknown";
}

async function addExperienceForMessage(userId, db) {
  try {
    const lastKey = `lastExp_${userId}`;
    const last = await db.get(lastKey);
    const now = Date.now();
    if (last && now - last < 60000) return;
    await DataUtils.addExperience(userId, 1);
    await db.set(lastKey, now);
  } catch (e) {
    console.error("Error adding experience for message:", e);
  }
}

function makeUserHelpers(sender, senderJid, msg, sock, db, config, logger) {
  return {
    getUser: async (userId) => await DataUtils.getUser(userId || sender),
    getAllUsers: async () => await DataUtils.getAllUsers(),
    updateUser: async (userId, data) => await DataUtils.updateUser(userId || sender, data),
    getUserName: async (userId) => await getUserName(userId || sender),
    isAdmin: (userId) => isAdmin(userId || sender, config),
    getId: () => sender,
    getJid: () => senderJid,
    getData: async () => await DataUtils.getUser(sender),
    ban: async (userId, reason) =>
      await DataUtils.updateUser(userId || sender, {
        banned: true,
        banReason: reason,
        banDate: Date.now(),
      }),
    unban: async (userId) =>
      await DataUtils.updateUser(userId || sender, {
        banned: false,
        banReason: null,
        banDate: null,
      }),
    addExp: async (amount = 1) => await DataUtils.addExperience(sender, amount),
    addMoney: async (amount) => {
      const u = await DataUtils.getUser(sender);
      return await DataUtils.updateUser(sender, { money: (u.money || 0) + amount });
    },
    warn: async (userId, reason) => {
      const uid = userId || sender;
      const u = await DataUtils.getUser(uid);
      const warnings = u.warnings || [];
      warnings.push({ reason, date: Date.now() });
      await DataUtils.updateUser(uid, { warnings });
      return warnings.length;
    },
  };
}

function makeThreadHelpers(threadId, msg, sock, isGroup, logger) {
  return {
    getThread: async (id) => await DataUtils.getThread(id || threadId),
    getThreadData: async (id) => await DataUtils.getThread(id || threadId),
    updateThread: async (id, data) => await DataUtils.updateThread(id || threadId, data),
    getId: () => threadId,
    isGroup: () => isGroup,
    getMembers: async () => {
      if (!isGroup) return [];
      try {
        const md = await sock.groupMetadata(threadId);
        return md.participants.map((p) => p.id);
      } catch (e) {
        logger.error(e);
        return [];
      }
    },
    getAdmins: async () => {
      if (!isGroup) return [];
      try {
        const md = await sock.groupMetadata(threadId);
        return md.participants.filter((p) => p.admin).map((p) => p.id);
      } catch (e) {
        logger.error(e);
        return [];
      }
    },
    kick: async (userId) => {
      if (!isGroup) return false;
      try {
        await sock.groupParticipantsUpdate(threadId, [userId], "remove");
        return true;
      } catch (e) {
        logger.error(e);
        return false;
      }
    },
    add: async (userId) => {
      if (!isGroup) return false;
      try {
        await sock.groupParticipantsUpdate(threadId, [userId], "add");
        return true;
      } catch (e) {
        logger.error(e);
        return false;
      }
    },
  };
}

function makeRoleHelpers(sender, threadId, isGroup, sock, db, config, logger) {
  const getRole = async (userId) => {
    const uid = userId || sender;
    if (isAdmin(uid, config)) return 2;
    if (isGroup) {
      try {
        const md = await sock.groupMetadata(threadId);
        const p = md.participants.find((x) => x.id === uid);
        if (p && (p.admin === "admin" || p.admin === "superadmin")) return 1;
      } catch (e) {
        logger.error(e);
      }
    }
    const d = await DataUtils.getUser(uid);
    return d.moderator ? 1 : 0;
  };
  const hasPermission = async (requiredRole) => {
    const r = await getRole();
    if (r === 2) return true;
    if (r === 1 && requiredRole <= 1) return true;
    if (r === 0 && requiredRole === 0) return true;
    return false;
  };
  return {
    getRole,
    hasPermission,
    promote: async (uid) => await DataUtils.updateUser(uid || sender, { moderator: true }),
    demote: async (uid) => await DataUtils.updateUser(uid || sender, { moderator: false }),
    isAdmin: (uid) => isAdmin(uid || sender, config),
    isModerator: async (uid) => {
      const d = await DataUtils.getUser(uid || sender);
      return d.moderator || false;
    },
  };
}

async function safeInvoke(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error("SafeInvoke error:", err);
  }
}
