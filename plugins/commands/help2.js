const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "help2",
        aliases: ["h2", "commands2"],
        description: "Display list of available commands or command details",
        guide: "{pn} [command]",
        author: "@anbuinfosec",
        role: 0,
        cooldown: 3,
        countDown: 3,
        category: "info"
    },

    onStart: async ({ reply, event, args, user, role, utils, getLang }) => {
        try {
            const getText = getLang || ((key, ...args) => {
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
                    totalCommands: "📊 Total Commands: %1",
                    prefix: "🤖 Prefix: %1"
                };
                let text = texts[key] || key;
                args.forEach((arg, index) => {
                    text = text.replace(new RegExp(`%${index + 1}`, 'g'), arg);
                });
                return text;
            });

            const currentUser = await user.getUser();
            const userRole = await role.getRole();
            const prefix = global.GoatBot.prefix || utils.getPrefix();

            // If specific command requested
            if (args[0]) {
                const commandName = args[0].toLowerCase();
                const command = global.GoatBot.commands.get(commandName) || 
                               global.GoatBot.commands.get(global.GoatBot.aliases.get(commandName));
                
                if (!command) {
                    return await reply(getText('commandNotFound', commandName));
                }

                // Check permission
                if (command.config.role > userRole) {
                    return await reply(getText('noPermission'));
                }

                // Show command details
                const config = command.config;
                const roleNames = ['👤 User', '🛡️ Moderator', '👑 Admin'];
                const roleName = roleNames[config.role] || `Level ${config.role}`;
                const aliases = config.aliases ? config.aliases.join(', ') : 'None';

                let details = `${getText('commandDetails')}\n\n`;
                details += `🏷️ **${config.name}**\n`;
                details += `${getText('description', config.description || 'No description')}\n`;
                details += `${getText('usage', config.usage || `${prefix}${config.name}`)}\n`;
                details += `${getText('role', roleName)}\n`;
                details += `${getText('cooldown', config.cooldown || config.countDown || 3)}\n`;
                details += `${getText('category', config.category || 'general')}\n`;
                details += `${getText('aliases', aliases)}`;

                return await reply(details);
            }

            // Show all commands
            const commands = Array.from(global.GoatBot.commands.values());
            const categories = {};

            // Filter commands by user role and group by category
            commands.forEach(cmd => {
                if (cmd.config.role <= userRole) {
                    const category = cmd.config.category || 'general';
                    if (!categories[category]) {
                        categories[category] = [];
                    }
                    categories[category].push({
                        name: cmd.config.name,
                        description: cmd.config.description || 'No description',
                        aliases: cmd.config.aliases || []
                    });
                }
            });

            let helpMessage = `${getText('commandsList')}\n`;
            helpMessage += `${getText('prefix', prefix)}\n`;
            helpMessage += `${getText('totalCommands', Object.values(categories).flat().length)}\n\n`;

            // Sort categories
            const sortedCategories = Object.keys(categories).sort();

            for (const category of sortedCategories) {
                const categoryCommands = categories[category];
                const categoryEmoji = getCategoryEmoji(category);
                
                helpMessage += `${categoryEmoji} **${category.toUpperCase()}**\n`;
                
                categoryCommands.forEach(cmd => {
                    const aliasText = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
                    helpMessage += `• \`${prefix}${cmd.name}${aliasText}\` - ${cmd.description}\n`;
                });
                
                helpMessage += '\n';
            }

            helpMessage += `💡 Use \`${prefix}help2 <command>\` for detailed information about a specific command.`;

            await reply(helpMessage);

        } catch (error) {
            console.error("Error in help2 command:", error);
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
