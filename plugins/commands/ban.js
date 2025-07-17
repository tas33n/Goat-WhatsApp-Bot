const DataUtils = require("../../libs/dataUtils");
const { getUserName } = require("../../libs/utils");

module.exports = {
  config: {
    name: "ban",
    aliases: ["block"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 1,
    description: "Ban a user from using the bot",
    category: "moderation",
    guide: "{pn} @user [reason] - Ban a user\n{pn} unban @user - Unban a user\n{pn} list - List banned users"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply }) {
    try {
      const senderJid = message.key.participant || message.key.remoteJid;
      const threadId = message.key.remoteJid;
      const isAdmin = config.admins.includes(senderJid);
      
      if (!isAdmin) {
        return reply("❌ You don't have permission to use this command.");
      }
      
      const action = args[0]?.toLowerCase();
      
      if (action === "list") {
        // List banned users
        const allUsers = await db.getAllUsers();
        const bannedUsers = [];
        
        for (const [key, userData] of Object.entries(allUsers)) {
          if (userData.banned) {
            bannedUsers.push({
              name: userData.name || "Unknown",
              id: userData.id,
              banReason: userData.banReason || "No reason provided",
              banDate: userData.banDate ? new Date(userData.banDate).toLocaleString() : "Unknown"
            });
          }
        }
        
        if (bannedUsers.length === 0) {
          return reply("✅ No users are currently banned.");
        }
        
        let banList = `🚫 *Banned Users List*\n\n`;
        bannedUsers.forEach((user, index) => {
          banList += `${index + 1}. ${user.name}\n`;
          banList += `   ID: ${user.id}\n`;
          banList += `   Reason: ${user.banReason}\n`;
          banList += `   Date: ${user.banDate}\n\n`;
        });
        
        return reply(banList);
      }
      
      if (action === "unban") {
        // Unban user
        const mentionedUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedUser) {
          return reply("❌ Please mention a user to unban.\nUsage: .ban unban @user");
        }
        
        const userData = await DataUtils.getUser(mentionedUser);
        const userName = await getUserName(mentionedUser, message, api);
        
        if (!userData.banned) {
          return reply("❌ User is not banned.");
        }
        
        await DataUtils.updateUser(mentionedUser, {
          banned: false,
          banReason: null,
          banDate: null
        });
        
        const unbanMessage = `✅ *User Unbanned*\n\n` +
                            `👤 User: ${userName}\n` +
                            `🆔 ID: ${mentionedUser}\n` +
                            `👮 By: ${message.pushName || "Admin"}\n` +
                            `🕐 Time: ${new Date().toLocaleString()}`;
        
        await reply(unbanMessage);
        logger.info(`User unbanned: ${userData.name} (${mentionedUser}) by ${senderJid}`);
        return;
      }
      
      // Ban user
      const mentionedUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!mentionedUser) {
        return reply("❌ Please mention a user to ban.\nUsage: .ban @user [reason]");
      }
      
      // Check if trying to ban an admin
      if (config.admins.includes(mentionedUser)) {
        return reply("❌ Cannot ban an admin.");
      }
      
      const reason = args.slice(1).join(" ") || "No reason provided";
      const userData = await DataUtils.getUser(mentionedUser);
      const userName = await getUserName(mentionedUser, message, api);
      
      if (userData.banned) {
        return reply("❌ User is already banned.");
      }
      
      await DataUtils.updateUser(mentionedUser, {
        banned: true,
        banReason: reason,
        banDate: Date.now()
      });
      
      const banMessage = `🚫 *User Banned*\n\n` +
                        `👤 User: ${userName}\n` +
                        `🆔 ID: ${mentionedUser}\n` +
                        `👮 By: ${message.pushName || "Admin"}\n` +
                        `📝 Reason: ${reason}\n` +
                        `🕐 Time: ${new Date().toLocaleString()}`;
      
      await reply(banMessage);
      logger.info(`User banned: ${userName} (${mentionedUser}) by ${senderJid} - Reason: ${reason}`);
      
    } catch (error) {
      logger.error("Error in ban command:", error);
      await reply("❌ An error occurred while processing the ban command.");
    }
  }
};
