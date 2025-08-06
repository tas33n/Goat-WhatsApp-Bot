const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "help",
    aliases: ["h", "menu", "commands"],
    description: "Display list of available commands or command details",
    guide: [
      "{pn}help <command> → Show details for a specific command",
      "{pn}help → Show all available commands"
    ],
    author: "@anbuinfosec",
    role: 0,
    cooldown: 3,
    countDown: 3,
    category: "info"
  },

  onStart: async ({ reply, event, args, user, role, utils, getLang }) => {
    try {
      const getText = getLang || ((key, ...params) => {
        const texts = {
          noPermission: "❌ You don't have permission to view this command",
          commandNotFound: "❌ Command '%1' not found",
          commandsList: "📋 Available Commands",
          commandDetails: "📖 Command Details",
          usage: "🔧 Usage: %1",
          aliases: "🔗 Aliases: %1",
          description: "📝 Description: %1",
          cooldown: "⏱️ Cooldown: %1 seconds",
          role: "🔑 Required role: %1",
          category: "📂 Category: %1",
          totalCommands: "Currently, the bot has %1 commands that can be used",
          prefix: "» Type %1help <command name> to view the details of how to use that command",
          noAliases: "None",
          noDescription: "No description",
          roleNames: ['👤 User', '🛡️ Moderator', '👑 Admin']
        };
        let text = texts[key] || key;
        params.forEach((param, index) => {
          text = text.replace(new RegExp(`%${index + 1}`, 'g'), param);
        });
        return text;
      });

      const currentUser = await user.getUser();
      const userRole = await role.getRole();
      const prefix = global.GoatBot.prefix || utils.getPrefix();
      const botName = global.GoatBot.config?.botName || "GoatBot";

      if (args[0]) {
        // Show specific command details
        const commandName = args[0].toLowerCase();
        const command = global.GoatBot.commands.get(commandName) || 
                        global.GoatBot.commands.get(global.GoatBot.aliases.get(commandName));

        if (!command) {
          return await reply(getText('commandNotFound', commandName));
        }

        if (command.config.role > userRole) {
          return await reply(getText('noPermission'));
        }

        const c = command.config;

        const roleName = getText("roleNames")[c.role] || `Level ${c.role}`;
        const aliases = c.aliases && c.aliases.length ? c.aliases.join(", ") : getText("noAliases");
        const description = c.description || getText("noDescription");

        let guideContent = c.guide || c.guide?.en || c.guide?.vi || "";
        if (Array.isArray(guideContent)) {
          guideContent = guideContent.map(line => line.trim()).join("\n");
        } else if (typeof guideContent === "string") {
          guideContent = guideContent.trim();
        } else {
          guideContent = "";
        }
        guideContent = guideContent.replace(/\{pn\}/g, prefix);

        let details = `${getText('commandDetails')}\n\n`;
        details += `🏷️ **${c.name}**\n`;
        details += `${getText('description', description)}\n`;
        details += `${getText('role', roleName)}\n`;
        details += `${getText('cooldown', c.cooldown || c.countDown || 3)}\n`;
        details += `${getText('category', c.category || 'general')}\n`;
        details += `${getText('aliases', aliases)}\n\n`;
        details += `${getText('usage', guideContent)}`;

        return await reply(details);
      }

      // Show all commands grouped by category
      const commands = Array.from(global.GoatBot.commands.values());
      const categories = {};

      commands.forEach(cmd => {
        if (cmd.config.role <= userRole) {
          const category = (cmd.config.category || 'general').toLowerCase();
          if (!categories[category]) categories[category] = [];
          categories[category].push({
            name: cmd.config.name,
            description: cmd.config.description || 'No description',
            aliases: cmd.config.aliases || []
          });
        }
      });

      let helpMessage = "";

      // Sort categories alphabetically, but keep 'admin' first if exists
      const sortedCategories = Object.keys(categories).sort((a, b) => {
        if (a === 'admin') return -1;
        if (b === 'admin') return 1;
        return a.localeCompare(b);
      });

      sortedCategories.forEach((category, index) => {
        const categoryCommands = categories[category];
        const categoryEmoji = getCategoryEmoji(category);

        // Use different border symbol for the first category
        const topBorder = index === 0 ? '╭───' : '╭─────';
        const bottomSymbol = index === 0 ? '⭓' : '⭔';

        helpMessage += `${topBorder} ${category.toUpperCase()} ${bottomSymbol}\n`;

        categoryCommands.forEach(cmd => {
          helpMessage += `╰ ◈ ${cmd.name}\n`;
        });
      });

      // Add footer styling
      helpMessage += "𝄖".repeat(15) + "⧕\n";
      helpMessage += `${getText('totalCommands', Object.values(categories).flat().length)}\n`;
      helpMessage += `${getText('prefix', prefix)}\n`;
      helpMessage += `» ${botName}\n`;
      helpMessage += "𝄖".repeat(15) + "⧕";

      await reply(helpMessage);

    } catch (error) {
      console.error("Error in help command:", error);
      await reply("❌ An error occurred while retrieving help information.");
    }
  }
};

function getCategoryEmoji(category) {
  const emojiMap = {
    'admin': '👑',
    'info': 'ℹ️',
    'utility': '🔧',
    'fun': '🎉',
    'moderation': '🛡️',
    'game': '🎮',
    'music': '🎵',
    'image': '🖼️',
    'economy': '💰',
    'general': '📝',
    'system': '⚙️',
    'owner': '👤'
  };
  return emojiMap[category.toLowerCase()] || '📂';
}
