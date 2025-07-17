const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "promote",
    aliases: ["admin"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 1,
    description: "Promote a user to admin",
    category: "moderation",
    guide: "{pn} @user - Promote user to admin"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply }) {
    try {
      const senderJid = message.key.participant || message.key.remoteJid;
      const threadId = message.key.remoteJid;
      const isGroup = threadId.endsWith("@g.us");
      const isAdmin = config.admins.includes(senderJid);
      
      if (!isGroup) {
        return reply("❌ This command can only be used in groups.");
      }
      
      if (!isAdmin) {
        return reply("❌ You don't have permission to use this command.");
      }
      
      // Get mentioned user
      const mentionedUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!mentionedUser) {
        return reply("❌ Please mention a user to promote.\nUsage: .promote @user");
      }
      
      // Check if user is in the group
      const threadData = await DataUtils.getThread(threadId);
      if (!threadData.participants.includes(mentionedUser)) {
        return reply("❌ User is not in this group.");
      }
      
      try {
        // Promote user to admin
        await api.groupParticipantsUpdate(threadId, [mentionedUser], "promote");
        
        // Update thread data
        const updatedAdmins = [...(threadData.admins || []), mentionedUser];
        await DataUtils.updateThread(threadId, {
          admins: updatedAdmins,
          lastActivity: Date.now()
        });
        
        // Get user data
        const userData = await DataUtils.getUser(mentionedUser);
        
        const promoteMessage = `👑 *User Promoted*\n\n` +
                              `👤 User: ${userData.name || "Unknown"}\n` +
                              `🆔 ID: ${mentionedUser}\n` +
                              `👮 By: ${message.pushName || "Admin"}\n` +
                              `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                              `✅ User is now a group admin!`;
        
        await reply(promoteMessage);
        
        logger.info(`User promoted: ${userData.name} (${mentionedUser}) in group ${threadId} by ${senderJid}`);
        
      } catch (error) {
        logger.error("Error promoting user:", error);
        await reply("❌ Failed to promote user. Make sure the bot has admin permissions.");
      }
      
    } catch (error) {
      logger.error("Error in promote command:", error);
      await reply("❌ An error occurred while processing the promote command.");
    }
  }
};
