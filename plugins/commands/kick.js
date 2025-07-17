const DataUtils = require("../../libs/dataUtils");
const { getUserName } = require("../../libs/utils");

module.exports = {
  config: {
    name: "kick",
    aliases: ["remove"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 1,
    description: "Kick a user from the group",
    category: "moderation",
    guide: "{pn} @user [reason] - Kick a user from the group"
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
        return reply("❌ Please mention a user to kick.\nUsage: .kick @user [reason]");
      }
      
      // Check if trying to kick an admin
      if (config.admins.includes(mentionedUser)) {
        return reply("❌ Cannot kick an admin.");
      }
      
      // Get reason
      const reason = args.slice(1).join(" ") || "No reason provided";
      
      // Get user data and name
      const userData = await DataUtils.getUser(mentionedUser);
      const userName = await getUserName(mentionedUser, message, api);
      const threadData = await DataUtils.getThread(threadId);
      
      // Check if user is in the group
      if (!threadData.participants.includes(mentionedUser)) {
        return reply("❌ User is not in this group.");
      }
      
      try {
        // Remove user from group
        await api.groupParticipantsUpdate(threadId, [mentionedUser], "remove");
        
        // Update thread data
        const updatedParticipants = threadData.participants.filter(p => p !== mentionedUser);
        await DataUtils.updateThread(threadId, {
          participants: updatedParticipants,
          lastActivity: Date.now()
        });
        
        // Log the action
        const kickMessage = `👢 *User Kicked*\n\n` +
                           `👤 User: ${userName}\n` +
                           `🆔 ID: ${mentionedUser}\n` +
                           `👮 By: ${message.pushName || "Admin"}\n` +
                           `📝 Reason: ${reason}\n` +
                           `🕐 Time: ${new Date().toLocaleString()}`;
        
        await reply(kickMessage);
        
        logger.info(`User kicked: ${userName} (${mentionedUser}) from group ${threadId} by ${senderJid}`);
        
      } catch (error) {
        logger.error("Error kicking user:", error);
        await reply("❌ Failed to kick user. Make sure the bot has admin permissions.");
      }
      
    } catch (error) {
      logger.error("Error in kick command:", error);
      await reply("❌ An error occurred while processing the kick command.");
    }
  }
};
