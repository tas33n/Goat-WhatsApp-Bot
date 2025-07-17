const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "add",
    aliases: ["invite"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 1,
    description: "Add a user to the group",
    category: "moderation",
    guide: "{pn} [phone_number] - Add user by phone number\n{pn} @user - Add user by mention (if they're in bot's contacts)"
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
      
      if (args.length === 0) {
        return reply("❌ Please provide a phone number or mention a user.\nUsage: .add [phone_number] or .add @user");
      }
      
      let userToAdd;
      
      // Check if user mentioned someone
      const mentionedUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (mentionedUser) {
        userToAdd = mentionedUser;
      } else {
        // Treat as phone number
        const phoneNumber = args[0].replace(/\D/g, ""); // Remove non-digits
        if (phoneNumber.length < 10) {
          return reply("❌ Please provide a valid phone number.");
        }
        
        // Format phone number to WhatsApp ID
        userToAdd = `${phoneNumber}@s.whatsapp.net`;
      }
      
      // Check if user is already in the group
      const threadData = await DataUtils.getThread(threadId);
      if (threadData.participants.includes(userToAdd)) {
        return reply("❌ User is already in this group.");
      }
      
      try {
        // Add user to group
        await api.groupParticipantsUpdate(threadId, [userToAdd], "add");
        
        // Update thread data
        const updatedParticipants = [...threadData.participants, userToAdd];
        await DataUtils.updateThread(threadId, {
          participants: updatedParticipants,
          lastActivity: Date.now()
        });
        
        // Get user data
        const userData = await DataUtils.getUser(userToAdd);
        
        const addMessage = `✅ *User Added*\n\n` +
                          `👤 User: ${userData.name || "Unknown"}\n` +
                          `🆔 ID: ${userToAdd}\n` +
                          `👮 By: ${message.pushName || "Admin"}\n` +
                          `🕐 Time: ${new Date().toLocaleString()}`;
        
        await reply(addMessage);
        
        logger.info(`User added: ${userData.name} (${userToAdd}) to group ${threadId} by ${senderJid}`);
        
      } catch (error) {
        logger.error("Error adding user:", error);
        
        let errorMessage = "❌ Failed to add user. ";
        if (error.message.includes("privacy")) {
          errorMessage += "User's privacy settings prevent being added to groups.";
        } else if (error.message.includes("not_authorized")) {
          errorMessage += "Bot doesn't have admin permissions.";
        } else if (error.message.includes("forbidden")) {
          errorMessage += "User has blocked the bot or doesn't exist.";
        } else {
          errorMessage += "Please check the phone number and try again.";
        }
        
        await reply(errorMessage);
      }
      
    } catch (error) {
      logger.error("Error in add command:", error);
      await reply("❌ An error occurred while processing the add command.");
    }
  }
};
