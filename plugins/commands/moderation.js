const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "moderation",
    aliases: ["mod", "modpanel"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 1,
    description: "Moderation dashboard and statistics",
    category: "moderation",
    guide: "{pn} - Show moderation dashboard\n{pn} stats - Show moderation statistics"
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
      
      if (action === "stats") {
        // Show moderation statistics
        const allUsers = await db.getAllUsers();
        const allThreads = await db.getAllThreads();
        
        let totalWarnings = 0;
        let bannedUsers = 0;
        let activeUsers = 0;
        let bannedThreads = 0;
        let threadsWithWelcome = 0;
        let threadsWithAntispam = 0;
        let threadsAdminOnly = 0;
        
        // Calculate user statistics
        for (const [key, userData] of Object.entries(allUsers)) {
          totalWarnings += userData.warnings || 0;
          if (userData.banned) bannedUsers++;
          if (userData.lastSeen > Date.now() - (7 * 24 * 60 * 60 * 1000)) activeUsers++; // Active in last 7 days
        }
        
        // Calculate thread statistics
        for (const [key, threadData] of Object.entries(allThreads)) {
          if (threadData.banned) bannedThreads++;
          if (threadData.settings.welcomeMessage) threadsWithWelcome++;
          if (threadData.settings.antiSpam) threadsWithAntispam++;
          if (threadData.settings.adminOnly) threadsAdminOnly++;
        }
        
        const statsMessage = `📊 *Moderation Statistics*\n\n` +
                           `👥 *Users:*\n` +
                           `• Total Users: ${Object.keys(allUsers).length}\n` +
                           `• Active Users (7d): ${activeUsers}\n` +
                           `• Banned Users: ${bannedUsers}\n` +
                           `• Total Warnings: ${totalWarnings}\n\n` +
                           
                           `💬 *Threads:*\n` +
                           `• Total Threads: ${Object.keys(allThreads).length}\n` +
                           `• Banned Threads: ${bannedThreads}\n` +
                           `• Welcome Enabled: ${threadsWithWelcome}\n` +
                           `• Anti-spam Enabled: ${threadsWithAntispam}\n` +
                           `• Admin-only Mode: ${threadsAdminOnly}\n\n` +
                           
                           `🤖 *Bot Stats:*\n` +
                           `• Commands: ${global.GoatBot.commands.size}\n` +
                           `• Admins: ${config.admins.length}\n` +
                           `• Uptime: ${formatUptime(Date.now() - global.GoatBot.startTime)}`;
        
        return reply(statsMessage);
      }
      
      // Show moderation dashboard
      const threadData = isGroup ? await DataUtils.getThread(threadId) : null;
      
      let dashboardMessage = `🛡️ *Moderation Dashboard*\n\n`;
      
      if (isGroup) {
        dashboardMessage += `📋 *Current Thread:*\n` +
                           `• Name: ${threadData.name || "Unknown"}\n` +
                           `• Participants: ${threadData.participants.length}\n` +
                           `• Warnings: ${threadData.warnings || 0}\n` +
                           `• Status: ${threadData.banned ? "🚫 Banned" : "✅ Active"}\n\n` +
                           
                           `⚙️ *Settings:*\n` +
                           `• Welcome: ${threadData.settings.welcomeMessage ? "✅" : "❌"}\n` +
                           `• Anti-spam: ${threadData.settings.antiSpam ? "✅" : "❌"}\n` +
                           `• Admin-only: ${threadData.settings.adminOnly ? "✅" : "❌"}\n` +
                           `• Language: ${threadData.settings.language || "en"}\n\n`;
      }
      
      dashboardMessage += `🔧 *Available Commands:*\n` +
                         `• \`.kick @user\` - Kick user from group\n` +
                         `• \`.ban @user [reason]\` - Ban user from bot\n` +
                         `• \`.warn @user [reason]\` - Warn user (3 = kick)\n` +
                         `• \`.add [number/@user]\` - Add user to group\n` +
                         `• \`.promote @user\` - Promote to admin\n` +
                         `• \`.demote @user\` - Demote from admin\n` +
                         `• \`.threadinfo\` - Thread information\n` +
                         `• \`.cleanup\` - Database cleanup\n\n` +
                         
                         `📊 *Quick Stats:*\n` +
                         `• Use \`.moderation stats\` for detailed statistics\n` +
                         `• Use \`.ban list\` to see banned users\n` +
                         `• Use \`.warn list @user\` to see warnings\n\n` +
                         
                         `💡 *Tips:*\n` +
                         `• Warning system: 3 warnings = auto-kick\n` +
                         `• Banned users cannot use any bot commands\n` +
                         `• Admin-only mode restricts all commands to admins\n` +
                         `• Use cleanup commands to maintain database`;
      
      await reply(dashboardMessage);
      
    } catch (error) {
      logger.error("Error in moderation command:", error);
      await reply("❌ An error occurred while processing the moderation command.");
    }
  }
};

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
