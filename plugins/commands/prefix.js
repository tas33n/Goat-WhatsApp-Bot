module.exports = {
  config: {
    name: "prefix",
    aliases: ["pf"],
    version: "1.0",
    author: "@anbuinfosec",
    countDown: 3,
    role: 0,
    description: "Show bot prefix when user types 'prefix'",
    category: "Info",
    guide: "{pn} or just type 'prefix'",
  },

  // Main command handler (when using .prefix)
  onCmd: async ({ api, message, reply, user, thread, role, utils, logger }) => {
    const config = require("../../config.json");
    const prefix = config.prefix || ".";
    
    await reply(`🤖 **Bot Prefix Information**\n\n` +
               `🔧 Current Prefix: \`${prefix}\`\n` +
               `📝 Usage: Type \`${prefix}help\` to see all commands\n` +
               `💡 You can also just type "prefix" to see this message`);
  },

  // Chat handler - triggers when someone types "prefix" without the dot
  onChat: async ({ api, message, reply, user, thread, role, utils, logger }) => {
    const messageText = message.message?.conversation || "";
    
    // Check if message is exactly "prefix" (case insensitive)
    if (messageText.toLowerCase().trim() === "prefix") {
      const config = require("../../config.json");
      const prefix = config.prefix || ".";
      
      await reply(`🤖 **My Prefix is:** \`${prefix}\`\n\n` +
                 `📝 Usage: \`${prefix}help\` - See all commands\n` +
                 `💡 Example: \`${prefix}ping\` - Check bot response`);
    }
  }
};
