module.exports = {
  config: {
    name: "welcome",
    author: "anbuinfosec",
    version: "1.0.0",
    category: "events",
  },

  onEvent: async ({ api, event, db, logger, user, thread, utils }) => {
    const { id, action, participants } = event
    if (action !== "add" || !participants) return

    try {
      // Import required utilities
      const DataUtils = require("../../libs/dataUtils");
      const { getUserName } = require("../../libs/utils");
      
      // Get thread data - handle cases where thread parameter might be missing
      const threadData = thread?.getThread ? await thread.getThread() : await DataUtils.getThread(id);
      
      // Check if welcome messages are enabled for this group
      if (!threadData.settings.welcomeMessage) return;

      for (const participantId of participants) {
        try {
          // Get user data - handle cases where user parameter might be missing
          const userData = user?.getUser ? await user.getUser(participantId) : await DataUtils.getUser(participantId);
          const userName = utils?.getUserName ? await utils.getUserName(participantId, null, api) : await getUserName(participantId);
          
          // Update user data - handle cases where user parameter might be missing
          if (user?.updateUser) {
            await user.updateUser(participantId, {
              name: userName,
              lastSeen: Date.now(),
              messageCount: userData.messageCount || 0
            });
          } else {
            await DataUtils.updateUser(participantId, {
              name: userName,
              lastSeen: Date.now(),
              messageCount: userData.messageCount || 0
            });
          }
          
          // Update thread data - handle cases where thread parameter might be missing
          if (thread?.updateThread) {
            await thread.updateThread({
              participants: [...new Set([...threadData.participants, participantId])],
              lastActivity: Date.now()
            });
          } else {
            await DataUtils.updateThread(id, {
              participants: [...new Set([...threadData.participants, participantId])],
              lastActivity: Date.now()
            });
          }
          
          // Add experience for joining - handle cases where user parameter might be missing
          if (user?.addExperience) {
            await user.addExperience(participantId, 10);
          } else {
            const currentUser = await DataUtils.getUser(participantId);
            await DataUtils.updateUser(participantId, {
              experience: (currentUser.experience || 0) + 10
            });
          }
          
          // Send welcome message
          const welcomeMessage = `🎉 *Welcome to the group!*\n\n` +
                                `👋 Hello ${userName}!\n` +
                                `📝 Please read the group rules and enjoy your stay!\n` +
                                `🎁 You've received 10 experience points for joining!\n\n` +
                                `ℹ️ Type \`.help\` to see available commands.`;
          
          await api.sendMessage(id, {
            text: welcomeMessage,
            mentions: [participantId],
          });
          
          if (logger) {
            logger.info(`👋 Welcomed new member: ${userData.name || participantId} to group ${id}`);
          }
        } catch (e) {
          console.log("Error welcoming user:", e);
        }
      }
    } catch (error) {
      console.log("Error in welcome event:", error);
    }
  },
}
