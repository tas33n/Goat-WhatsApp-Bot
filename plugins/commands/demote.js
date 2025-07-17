const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "demote",
    aliases: ["unadmin"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 1,
    description: "Demote a user from admin",
    category: "moderation",
    guide: "{pn} @user - Demote user from admin"
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
        return reply("❌ Please mention a user to demote.\nUsage: .demote @user");
      }
      
      // Check if trying to demote a bot admin
      if (config.admins.includes(mentionedUser)) {
        return reply("❌ Cannot demote a bot admin.");
      }
      
      // Check if user is in the group
      const threadData = await DataUtils.getThread(threadId);
      if (!threadData.participants.includes(mentionedUser)) {
        return reply("❌ User is not in this group.");
      }
      
      try {
        // Demote user from admin
        await api.groupParticipantsUpdate(threadId, [mentionedUser], "demote");
        
        // Update thread data
        const updatedAdmins = (threadData.admins || []).filter(admin => admin !== mentionedUser);
        await DataUtils.updateThread(threadId, {
          admins: updatedAdmins,
          lastActivity: Date.now()
        });
        
        // Get user data
        const userData = await DataUtils.getUser(mentionedUser);
        
        const demoteMessage = `👤 *User Demoted*\n\n` +
                             `👤 User: ${userData.name || "Unknown"}\n` +
                             `🆔 ID: ${mentionedUser}\n` +
                             `👮 By: ${message.pushName || "Admin"}\n` +
                             `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                             `❌ User is no longer a group admin.`;
        
        await reply(demoteMessage);
        
        logger.info(`User demoted: ${userData.name} (${mentionedUser}) in group ${threadId} by ${senderJid}`);
        
      } catch (error) {
        logger.error("Error demoting user:", error);
        await reply("❌ Failed to demote user. Make sure the bot has admin permissions.");
      }
      
    } catch (error) {
      logger.error("Error in demote command:", error);
      await reply("❌ An error occurred while processing the demote command.");
    }
  }
};
