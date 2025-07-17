const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "stats",
    aliases: ["statistics", "botstats"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 0,
    description: "Show bot statistics and information",
    category: "info",
    guide: "{pn}"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply }) {
    try {
      // Get global statistics
      const globalStats = await DataUtils.getGlobalStats();
      const botStats = global.GoatBot.stats;
      
      if (!globalStats) {
        return reply("❌ Unable to retrieve bot statistics.");
      }
      
      // Format uptime
      const uptimeMs = globalStats.uptime;
      const uptimeSeconds = Math.floor(uptimeMs / 1000);
      const uptimeMinutes = Math.floor(uptimeSeconds / 60);
      const uptimeHours = Math.floor(uptimeMinutes / 60);
      const uptimeDays = Math.floor(uptimeHours / 24);
      
      const uptimeString = `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`;
      
      // Format statistics
      const statsInfo = `📊 *Bot Statistics*\n\n` +
                       `🤖 *Bot Name:* ${global.GoatBot.user?.name || config.botName || "GoatBot"}\n` +
                       `⏱️ *Uptime:* ${uptimeString}\n` +
                       `📱 *Status:* ${global.GoatBot.isConnected ? "🟢 Online" : "🔴 Offline"}\n\n` +
                       
                       `👥 *Users & Chats:*\n` +
                       `• Total Users: ${globalStats.userCount}\n` +
                       `• Total Chats: ${globalStats.threadCount}\n` +
                       `• Group Chats: ${globalStats.groupCount}\n` +
                       `• Private Chats: ${globalStats.privateChats}\n\n` +
                       
                       `📈 *Activity:*\n` +
                       `• Total Messages: ${globalStats.totalMessages}\n` +
                       `• Messages Processed: ${botStats.messagesProcessed}\n` +
                       `• Commands Executed: ${botStats.commandsExecuted}\n` +
                       `• Errors: ${botStats.errors}\n\n` +
                       
                       `🔧 *System:*\n` +
                       `• Commands Loaded: ${global.GoatBot.commands.size}\n` +
                       `• Events Loaded: ${global.GoatBot.events.size}\n` +
                       `• Prefix: ${config.prefix}\n` +
                       `• Database: ${config.database.type}`;
      
      await reply(statsInfo);
      
    } catch (error) {
      logger.error("Error in stats command:", error);
      await reply("❌ An error occurred while retrieving bot statistics.");
    }
  }
};
