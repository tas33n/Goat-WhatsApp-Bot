const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "cmd",
        aliases: ["command"],
        description: "Command management (load, unload, reload, info)",
        guide: "{pn} [load|unload|reload|info] <command>",
        author: "@anbuinfosec",
        role: 2,
        cooldown: 3,
        countDown: 3,
        category: "admin"
    },

    onStart: async ({ reply, event, args, utils, role, getLang }) => {
        try {
            const getText = getLang || ((key, ...args) => {
                const texts = {
                    missingAction: "❌ Please specify an action: load, unload, reload, info, list",
                    missingCommand: "❌ Please specify a command name",
                    commandNotFound: "❌ Command '%1' not found",
                    commandLoaded: "✅ Command '%1' loaded successfully",
                    commandUnloaded: "✅ Command '%1' unloaded successfully",
                    commandReloaded: "✅ Command '%1' reloaded successfully",
                    loadError: "❌ Error loading command '%1': %2",
                    unloadError: "❌ Error unloading command '%1': %2",
                    commandsList: "📋 Available Commands (%1):\n\n%2",
                    commandInfo: "📖 Command Information:\n\n🏷️ Name: %1\n📝 Description: %2\n🔧 Usage: %3\n🔑 Role: %4\n⏱️ Cooldown: %5s\n📂 Category: %6\n🔗 Aliases: %7"
                };
                let text = texts[key] || key;
                args.forEach((arg, index) => {
                    text = text.replace(new RegExp(`%${index + 1}`, 'g'), arg);
                });
                return text;
            });

            if (!args[0]) {
                return await reply(getText('missingAction'));
            }

            const action = args[0].toLowerCase();
            const commandName = args[1];

            switch (action) {
                case 'load':
                    if (!commandName) {
                        return await reply(getText('missingCommand'));
                    }
                    await loadCommand(commandName, reply, getText);
                    break;

                case 'unload':
                    if (!commandName) {
                        return await reply(getText('missingCommand'));
                    }
                    await unloadCommand(commandName, reply, getText);
                    break;

                case 'reload':
                    if (!commandName) {
                        return await reply(getText('missingCommand'));
                    }
                    await reloadCommand(commandName, reply, getText);
                    break;

                case 'info':
                    if (!commandName) {
                        return await reply(getText('missingCommand'));
                    }
                    await showCommandInfo(commandName, reply, getText);
                    break;

                case 'list':
                    await listCommands(reply, getText);
                    break;

                default:
                    await reply(getText('missingAction'));
            }

        } catch (error) {
            console.error("Error in cmd command:", error);
            await reply("❌ An error occurred while processing the command.");
        }
    }
};

async function loadCommand(commandName, reply, getText) {
    try {
        const commandPath = path.join(__dirname, `${commandName}.js`);
        
        if (!fs.existsSync(commandPath)) {
            return await reply(getText('commandNotFound', commandName));
        }

        // Clear module cache
        delete require.cache[require.resolve(commandPath)];

        // Load the command
        const command = require(commandPath);
        
        // Add to global commands
        global.GoatBot.commands.set(command.config.name, command);

        // Add aliases
        if (command.config.aliases) {
            command.config.aliases.forEach(alias => {
                global.GoatBot.aliases.set(alias, command.config.name);
            });
        }

        // Add to onChat if has onChat handler
        if (command.onChat && !global.GoatBot.onChat.includes(command.config.name)) {
            global.GoatBot.onChat.push(command.config.name);
        }

        await reply(getText('commandLoaded', command.config.name));

    } catch (error) {
        await reply(getText('loadError', commandName, error.message));
    }
}

async function unloadCommand(commandName, reply, getText) {
    try {
        const command = global.GoatBot.commands.get(commandName);
        
        if (!command) {
            return await reply(getText('commandNotFound', commandName));
        }

        // Remove from commands
        global.GoatBot.commands.delete(commandName);

        // Remove aliases
        if (command.config.aliases) {
            command.config.aliases.forEach(alias => {
                global.GoatBot.aliases.delete(alias);
            });
        }

        // Remove from onChat
        const chatIndex = global.GoatBot.onChat.indexOf(commandName);
        if (chatIndex !== -1) {
            global.GoatBot.onChat.splice(chatIndex, 1);
        }

        // Clear module cache
        const commandPath = path.join(__dirname, `${commandName}.js`);
        if (fs.existsSync(commandPath)) {
            delete require.cache[require.resolve(commandPath)];
        }

        await reply(getText('commandUnloaded', commandName));

    } catch (error) {
        await reply(getText('unloadError', commandName, error.message));
    }
}

async function reloadCommand(commandName, reply, getText) {
    try {
        // First unload
        await unloadCommand(commandName, () => {}, getText);
        
        // Then load
        await loadCommand(commandName, reply, getText);

    } catch (error) {
        await reply(getText('loadError', commandName, error.message));
    }
}

async function showCommandInfo(commandName, reply, getText) {
    try {
        const command = global.GoatBot.commands.get(commandName) || 
                       global.GoatBot.commands.get(global.GoatBot.aliases.get(commandName));
        
        if (!command) {
            return await reply(getText('commandNotFound', commandName));
        }

        const config = command.config;
        const roleNames = ['User', 'Moderator', 'Admin'];
        const roleName = roleNames[config.role] || `Level ${config.role}`;
        const aliases = config.aliases ? config.aliases.join(', ') : 'None';

        const info = getText('commandInfo',
            config.name,
            config.description || 'No description',
            config.usage || `${global.GoatBot.prefix}${config.name}`,
            roleName,
            config.cooldown || config.countDown || 3,
            config.category || 'general',
            aliases
        );

        await reply(info);

    } catch (error) {
        await reply(getText('commandNotFound', commandName));
    }
}

async function listCommands(reply, getText) {
    try {
        const commands = Array.from(global.GoatBot.commands.values());
        const categories = {};

        // Group commands by category
        commands.forEach(cmd => {
            const category = cmd.config.category || 'general';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(cmd.config.name);
        });

        let commandsList = '';
        for (const [category, cmdList] of Object.entries(categories)) {
            commandsList += `📂 **${category.toUpperCase()}**\n`;
            commandsList += `${cmdList.join(', ')}\n\n`;
        }

        await reply(getText('commandsList', commands.length, commandsList));

    } catch (error) {
        await reply("❌ Error listing commands.");
    }
}
