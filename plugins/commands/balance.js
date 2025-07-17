const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "balance",
    aliases: ["bal", "money", "currency"],
    version: "1.0.0",
    author: "@anbuinfosec",
    countDown: 5,
    role: 0,
    description: "Check your balance or give/take money (admin only)",
    category: "economy",
    guide: "{pn} [give/take] [@user] [amount]"
  },
  
  onCmd: async function ({ api, message, args, db, logger, config, reply }) {
    try {
      const senderJid = message.key.participant || message.key.remoteJid;
      const isAdmin = config.admins.includes(senderJid);
      
      // If no arguments, show balance
      if (args.length === 0) {
        const userData = await DataUtils.getUser(senderJid);
        if (!userData) {
          return reply("❌ Unable to retrieve your balance.");
        }
        
        return reply(`💰 *Your Balance*\n\n` +
                    `💵 Currency: ${userData.currency}\n` +
                    `⭐ Level: ${userData.level}\n` +
                    `📊 Experience: ${userData.experience}`);
      }
      
      // Admin commands
      if (isAdmin && (args[0] === "give" || args[0] === "take")) {
        const action = args[0];
        const targetUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const amount = parseInt(args[2]);
        
        if (!targetUser) {
          return reply("❌ Please mention a user to give/take money from.");
        }
        
        if (isNaN(amount) || amount <= 0) {
          return reply("❌ Please provide a valid amount.");
        }
        
        const userData = await DataUtils.getUser(targetUser);
        if (!userData) {
          return reply("❌ Unable to find user data.");
        }
        
        if (action === "give") {
          userData.currency += amount;
          await DataUtils.updateUser(targetUser, { currency: userData.currency });
          return reply(`✅ Successfully gave ${amount} currency to ${userData.name}.\n` +
                      `💰 Their new balance: ${userData.currency}`);
        } else {
          if (userData.currency < amount) {
            return reply(`❌ User only has ${userData.currency} currency, cannot take ${amount}.`);
          }
          userData.currency -= amount;
          await DataUtils.updateUser(targetUser, { currency: userData.currency });
          return reply(`✅ Successfully took ${amount} currency from ${userData.name}.\n` +
                      `💰 Their new balance: ${userData.currency}`);
        }
      }
      
      // Check mentioned user's balance
      const targetUser = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (targetUser) {
        const userData = await DataUtils.getUser(targetUser);
        if (!userData) {
          return reply("❌ Unable to retrieve user balance.");
        }
        
        return reply(`💰 *${userData.name}'s Balance*\n\n` +
                    `💵 Currency: ${userData.currency}\n` +
                    `⭐ Level: ${userData.level}\n` +
                    `📊 Experience: ${userData.experience}`);
      }
      
      return reply("❌ Invalid usage. Use without arguments to check your balance, or mention a user to check theirs.");
      
    } catch (error) {
      logger.error("Error in balance command:", error);
      await reply("❌ An error occurred while processing the balance command.");
    }
  }
};
