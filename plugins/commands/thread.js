const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "thread",
    aliases: ["group", "chat"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 5,
    role: 1,
    description: "Manage thread/group settings",
    category: "admin",
    guide: "{pn} [setting] [value]\n\nSettings:\n• welcome [on/off] - Toggle welcome messages\n• antispam [on/off] - Toggle anti-spam\n• adminonly [on/off] - Admin only mode\n• info - Show thread information"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply, event }) {
    try {
      const threadId = event.threadID;
      const isGroup = threadId.endsWith("@g.us");
      
      if (!isGroup) {
        return reply("❌ This command can only be used in groups.");
      }
      
      const threadData = await DataUtils.getThread(threadId);

      console.log(threadData)
      
      if (args.length === 0 || args[0] === "info") {
        // Show thread information
        const threadInfo = `📋 *Thread Information*\n\n` +
                          `🆔 *ID:* ${threadData.id}\n` +
                          `📝 *Name:* ${threadData.name}\n` +
                          `👥 *Participants:* ${threadData.participants.length}\n` +
                          `💬 *Messages:* ${threadData.messageCount}\n` +
                          `📅 *Created:* ${new Date(threadData.firstActivity).toLocaleString()}\n` +
                          `🕐 *Last Activity:* ${new Date(threadData.lastActivity).toLocaleString()}\n\n` +
                          
                          `⚙️ *Settings:*\n` +
                          `• Welcome Messages: ${threadData.settings.welcomeMessage ? "✅ On" : "❌ Off"}\n` +
                          `• Anti-Spam: ${threadData.settings.antiSpam ? "✅ On" : "❌ Off"}\n` +
                          `• Admin Only: ${threadData.settings.adminOnly ? "✅ On" : "❌ Off"}\n` +
                          `• Language: ${threadData.settings.language}\n\n` +
                          
                          `⚠️ *Moderation:*\n` +
                          `• Warnings: ${threadData.warnings}\n` +
                          `• Banned: ${threadData.banned ? "Yes" : "No"}`;
        
        return reply(threadInfo);
      }
      
      const setting = args[0].toLowerCase();
      const value = args[1]?.toLowerCase();
      
      if (!value) {
        return reply("❌ Please provide a value (on/off) for the setting.");
      }
      
      const isEnabled = value === "on" || value === "true" || value === "1";
      const isDisabled = value === "off" || value === "false" || value === "0";
      
      if (!isEnabled && !isDisabled) {
        return reply("❌ Invalid value. Use 'on' or 'off'.");
      }
      
      let updated = false;
      let settingName = "";
      
      switch (setting) {
        case "welcome":
          threadData.settings.welcomeMessage = isEnabled;
          settingName = "Welcome Messages";
          updated = true;
          break;
        case "antispam":
          threadData.settings.antiSpam = isEnabled;
          settingName = "Anti-Spam";
          updated = true;
          break;
        case "adminonly":
          threadData.settings.adminOnly = isEnabled;
          settingName = "Admin Only Mode";
          updated = true;
          break;
        default:
          return reply("❌ Invalid setting. Available settings: welcome, antispam, adminonly");
      }
      
      if (updated) {
        await DataUtils.updateThread(threadId, threadData);
        const status = isEnabled ? "✅ Enabled" : "❌ Disabled";
        await reply(`✅ ${settingName} has been ${status} for this group.`);
        logger.info(`Thread setting updated: ${settingName} = ${isEnabled} for ${threadId}`);
      }
      
    } catch (error) {
      logger.error("Error in thread command:", error);
      await reply("❌ An error occurred while managing thread settings.");
    }
  }
};
