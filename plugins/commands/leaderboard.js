const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "leaderboard",
    aliases: ["top", "rank", "lb"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 0,
    description: "Show top users by level, experience, or messages",
    category: "info",
    guide: "{pn} [level/exp/messages] [global/group]"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply }) {
    try {
      const type = args[0]?.toLowerCase() || "level";
      const scope = args[1]?.toLowerCase() || "global";
      const threadId = message.key.remoteJid;
      const isGroup = threadId.endsWith("@g.us");
      
      if (!["level", "exp", "messages"].includes(type)) {
        return reply("❌ Invalid type. Use: level, exp, or messages");
      }
      
      if (!["global", "group"].includes(scope)) {
        return reply("❌ Invalid scope. Use: global or group");
      }
      
      if (scope === "group" && !isGroup) {
        return reply("❌ Group leaderboard can only be used in groups.");
      }
      
      // Get all users
      const allUsers = await db.getAllUsers();
      let users = [];
      
      // Filter users based on scope
      if (scope === "group") {
        const threadData = await DataUtils.getThread(threadId);
        for (const userId of threadData.participants) {
          const userData = allUsers[`user_${userId}`];
          if (userData) {
            users.push(userData);
          }
        }
      } else {
        users = Object.values(allUsers);
      }
      
      // Sort users based on type
      let sortField = "level";
      let emoji = "⭐";
      let typeLabel = "Level";
      
      switch (type) {
        case "exp":
          sortField = "experience";
          emoji = "📊";
          typeLabel = "Experience";
          break;
        case "messages":
          sortField = "messageCount";
          emoji = "💬";
          typeLabel = "Messages";
          break;
      }
      
      users.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
      
      // Take top 10
      const top10 = users.slice(0, 10);
      
      if (top10.length === 0) {
        return reply("❌ No users found for the leaderboard.");
      }
      
      // Format leaderboard
      let leaderboard = `🏆 *Top ${typeLabel} ${scope === "group" ? "in Group" : "Global"}*\n\n`;
      
      for (let i = 0; i < top10.length; i++) {
        const user = top10[i];
        const position = i + 1;
        const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : `${position}.`;
        
        leaderboard += `${medal} ${user.name || "Unknown"}\n`;
        leaderboard += `   ${emoji} ${user[sortField] || 0}`;
        
        if (type === "level") {
          leaderboard += ` (${user.experience || 0} exp)`;
        }
        
        leaderboard += "\n";
      }
      
      // Add user's position if not in top 10
      const senderJid = message.key.participant || message.key.remoteJid;
      const senderData = await DataUtils.getUser(senderJid);
      const senderPosition = users.findIndex(u => u.id === senderJid) + 1;
      
      if (senderPosition > 10) {
        leaderboard += `\n📍 *Your Position:* #${senderPosition}\n`;
        leaderboard += `   ${emoji} ${senderData[sortField] || 0}`;
        if (type === "level") {
          leaderboard += ` (${senderData.experience || 0} exp)`;
        }
      }
      
      await reply(leaderboard);
      
    } catch (error) {
      logger.error("Error in leaderboard command:", error);
      await reply("❌ An error occurred while generating the leaderboard.");
    }
  }
};
