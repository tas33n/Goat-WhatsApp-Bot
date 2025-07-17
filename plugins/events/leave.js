const DataUtils = require("../../libs/dataUtils");
const { getUserName } = require("../../libs/utils");

module.exports = {
  config: {
    name: "leave",
    author: "anbuinfosec",
    version: "1.0.0",
    category: "events",
  },

  onEvent: async ({ api, event, db, logger }) => {
    const { id, action, participants } = event;
    if (action !== "remove" || !participants) return;

    try {
      const threadData = await DataUtils.getThread(id);
      
      for (const user of participants) {
        try {
          const userName = await getUserName(user, null, api);
          
          await DataUtils.updateThread(id, {
            participants: threadData.participants.filter(p => p !== user),
            lastActivity: Date.now()
          });
          
          const leaveMessage = `👋 *Member Left*\n\n` +
                              `👤 User: ${userName}\n` +
                              `🆔 ID: ${user}\n` +
                              `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                              `😢 We'll miss you!`;
          
          await api.sendMessage(id, {
            text: leaveMessage
          });
          
          logger.info(`👋 ${userName} left group ${id}`);
          
        } catch (error) {
          logger.error(`Error processing leave for user ${user}:`, error);
        }
      }
    } catch (error) {
      logger.error("Error in leave event:", error);
    }
  }
};
