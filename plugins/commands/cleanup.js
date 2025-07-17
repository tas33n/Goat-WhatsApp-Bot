const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "cleanup",
    aliases: ["clean", "purge"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 30,
    role: 1,
    description: "Clean up old data and manage database",
    category: "admin",
    guide: "{pn} [messages/users/threads] [days] - Clean data older than specified days\n{pn} backup - Create data backup\n{pn} stats - Show cleanup statistics"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply }) {
    try {
      const senderJid = message.key.participant || message.key.remoteJid;
      const isAdmin = config.admins.includes(senderJid);
      
      if (!isAdmin) {
        return reply("❌ This command requires admin privileges.");
      }
      
      if (args.length === 0) {
        return reply("❌ Please specify an action: messages, users, threads, backup, or stats");
      }
      
      const action = args[0].toLowerCase();
      
      switch (action) {
        case "messages":
          const days = parseInt(args[1]) || 30;
          await reply(`🔄 Cleaning messages older than ${days} days...`);
          
          const success = await DataUtils.cleanOldMessages(days);
          if (success) {
            await reply(`✅ Successfully cleaned old messages (${days} days retention)`);
          } else {
            await reply("❌ Failed to clean old messages");
          }
          break;
          
        case "backup":
          await reply("🔄 Creating data backup...");
          
          const backupData = await DataUtils.backupUserData();
          if (backupData) {
            const fs = require('fs');
            const backupFileName = `backup_${Date.now()}.json`;
            const backupPath = `./database/${backupFileName}`;
            
            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            await reply(`✅ Backup created successfully: ${backupFileName}`);
            logger.info(`Database backup created: ${backupFileName}`);
          } else {
            await reply("❌ Failed to create backup");
          }
          break;
          
        case "stats":
          await reply("📊 Calculating cleanup statistics...");
          
          const allData = await db.getAllData();
          const keys = Object.keys(allData);
          
          let userCount = 0;
          let threadCount = 0;
          let messageCount = 0;
          let globalCount = 0;
          
          keys.forEach(key => {
            if (key.startsWith('user_')) userCount++;
            else if (key.startsWith('thread_')) threadCount++;
            else if (key.startsWith('message_')) messageCount++;
            else if (key.startsWith('global_')) globalCount++;
          });
          
          const statsInfo = `📊 *Database Statistics*\n\n` +
                           `👥 Users: ${userCount}\n` +
                           `💬 Threads: ${threadCount}\n` +
                           `📝 Messages: ${messageCount}\n` +
                           `🌐 Global Keys: ${globalCount}\n` +
                           `🔑 Total Keys: ${keys.length}\n\n` +
                           `💾 Database Size: ${JSON.stringify(allData).length} bytes`;
          
          await reply(statsInfo);
          break;
          
        case "users":
          const inactiveDays = parseInt(args[1]) || 90;
          await reply(`🔄 Cleaning inactive users (${inactiveDays} days)...`);
          
          const cutoffTime = Date.now() - (inactiveDays * 24 * 60 * 60 * 1000);
          const allUsers = await db.getAllUsers();
          let deletedUsers = 0;
          
          for (const [key, userData] of Object.entries(allUsers)) {
            if (userData.lastSeen < cutoffTime) {
              await db.delete(key);
              deletedUsers++;
            }
          }
          
          await reply(`✅ Cleaned ${deletedUsers} inactive users (${inactiveDays} days)`);
          break;
          
        case "threads":
          const inactiveThreadDays = parseInt(args[1]) || 60;
          await reply(`🔄 Cleaning inactive threads (${inactiveThreadDays} days)...`);
          
          const threadCutoffTime = Date.now() - (inactiveThreadDays * 24 * 60 * 60 * 1000);
          const allThreads = await db.getAllThreads();
          let deletedThreads = 0;
          
          for (const [key, threadData] of Object.entries(allThreads)) {
            if (threadData.lastActivity < threadCutoffTime) {
              await db.delete(key);
              deletedThreads++;
            }
          }
          
          await reply(`✅ Cleaned ${deletedThreads} inactive threads (${inactiveThreadDays} days)`);
          break;
          
        default:
          await reply("❌ Invalid action. Use: messages, users, threads, backup, or stats");
      }
      
    } catch (error) {
      logger.error("Error in cleanup command:", error);
      await reply("❌ An error occurred during cleanup operation.");
    }
  }
};
