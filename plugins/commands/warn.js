const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "warn",
    aliases: ["warning"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 1,
    description: "Warning system - 3 warnings = kick",
    category: "moderation",
    guide: "{pn} @user [reason] - Warn a user\n{pn} remove @user - Remove a warning\n{pn} list @user - List user warnings\n{pn} clear @user - Clear all warnings"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply }) {
    try {
      const senderJid = message.key.participant || message.key.remoteJid;
      const threadId = message.key.remoteJid;
      const isGroup = threadId.endsWith("@g.us");
      const isAdmin = config.admins.includes(senderJid);
      
      if (!isAdmin) {
        return reply("❌ You don't have permission to use this command.");
      }
      
      const action = args[0]?.toLowerCase();
      const mentionedUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      
      if (!mentionedUser) {
        return reply("❌ Please mention a user.\nUsage: .warn @user [reason]");
      }
      
      // Check if trying to warn an admin
      if (config.admins.includes(mentionedUser)) {
        return reply("❌ Cannot warn an admin.");
      }
      
      const userData = await DataUtils.getUser(mentionedUser);
      
      if (action === "remove") {
        // Remove one warning
        if (userData.warnings <= 0) {
          return reply("❌ User has no warnings to remove.");
        }
        
        const newWarnings = Math.max(0, userData.warnings - 1);
        await DataUtils.updateUser(mentionedUser, { warnings: newWarnings });
        
        const removeMessage = `✅ *Warning Removed*\n\n` +
                             `👤 User: ${userData.name || "Unknown"}\n` +
                             `⚠️ Warnings: ${newWarnings}/3\n` +
                             `👮 By: ${message.pushName || "Admin"}\n` +
                             `🕐 Time: ${new Date().toLocaleString()}`;
        
        await reply(removeMessage);
        logger.info(`Warning removed from ${userData.name} (${mentionedUser}) by ${senderJid}`);
        return;
      }
      
      if (action === "list") {
        // List user warnings
        const warningHistory = userData.warningHistory || [];
        
        if (userData.warnings === 0) {
          return reply(`✅ ${userData.name || "User"} has no warnings.`);
        }
        
        let warningList = `⚠️ *Warning History for ${userData.name || "Unknown"}*\n\n`;
        warningList += `📊 Total Warnings: ${userData.warnings}/3\n\n`;
        
        if (warningHistory.length > 0) {
          warningHistory.forEach((warning, index) => {
            warningList += `${index + 1}. ${warning.reason}\n`;
            warningList += `   By: ${warning.adminName || "Admin"}\n`;
            warningList += `   Date: ${new Date(warning.date).toLocaleString()}\n\n`;
          });
        }
        
        return reply(warningList);
      }
      
      if (action === "clear") {
        // Clear all warnings
        await DataUtils.updateUser(mentionedUser, { 
          warnings: 0,
          warningHistory: []
        });
        
        const clearMessage = `✅ *All Warnings Cleared*\n\n` +
                            `👤 User: ${userData.name || "Unknown"}\n` +
                            `👮 By: ${message.pushName || "Admin"}\n` +
                            `🕐 Time: ${new Date().toLocaleString()}`;
        
        await reply(clearMessage);
        logger.info(`All warnings cleared for ${userData.name} (${mentionedUser}) by ${senderJid}`);
        return;
      }
      
      // Add warning
      const reason = args.join(" ") || "No reason provided";
      const newWarnings = (userData.warnings || 0) + 1;
      const warningHistory = userData.warningHistory || [];
      
      // Add to warning history
      warningHistory.push({
        reason: reason,
        adminName: message.pushName || "Admin",
        adminId: senderJid,
        date: Date.now()
      });
      
      await DataUtils.updateUser(mentionedUser, { 
        warnings: newWarnings,
        warningHistory: warningHistory
      });
      
      let warningMessage = `⚠️ *Warning Issued*\n\n` +
                          `👤 User: ${userData.name || "Unknown"}\n` +
                          `📝 Reason: ${reason}\n` +
                          `⚠️ Warnings: ${newWarnings}/3\n` +
                          `👮 By: ${message.pushName || "Admin"}\n` +
                          `🕐 Time: ${new Date().toLocaleString()}`;
      
      // Check if user should be kicked (3 warnings)
      if (newWarnings >= 3 && isGroup) {
        try {
          // Kick user from group
          await api.groupParticipantsUpdate(threadId, [mentionedUser], "remove");
          
          // Update thread data
          const threadData = await DataUtils.getThread(threadId);
          const updatedParticipants = threadData.participants.filter(p => p !== mentionedUser);
          await DataUtils.updateThread(threadId, {
            participants: updatedParticipants,
            lastActivity: Date.now()
          });
          
          // Reset warnings after kick
          await DataUtils.updateUser(mentionedUser, { warnings: 0 });
          
          warningMessage += `\n\n🚨 *AUTO-KICK TRIGGERED*\n`;
          warningMessage += `👢 User has been kicked for reaching 3 warnings!`;
          
          logger.info(`User auto-kicked: ${userData.name} (${mentionedUser}) for 3 warnings`);
          
        } catch (error) {
          logger.error("Error auto-kicking user:", error);
          warningMessage += `\n\n❌ Auto-kick failed. Please kick manually.`;
        }
      } else if (newWarnings === 2) {
        warningMessage += `\n\n🚨 *FINAL WARNING*\n`;
        warningMessage += `⚠️ Next warning will result in an automatic kick!`;
      }
      
      await reply(warningMessage);
      logger.info(`Warning issued to ${userData.name} (${mentionedUser}) by ${senderJid} - Reason: ${reason}`);
      
    } catch (error) {
      logger.error("Error in warn command:", error);
      await reply("❌ An error occurred while processing the warn command.");
    }
  }
};
