const fs = require('fs');
const path = require('path');

// Global configuration and utilities
class GoatBotConfig {
    constructor() {
        this.config = require('../config.json');
        this.languages = new Map();
        this.onReply = new Map();
        this.onReaction = new Map();
        this.onChat = [];
        this.onFirstChat = [];
        this.countDown = {};
        this.messageBuffer = new Map();
        this.initialize();
    }

    initialize() {
        // Load languages
        this.loadLanguages();
        
        // Initialize global GoatBot object
        this.setupGlobalGoatBot();
        
        // Setup utils
        this.setupUtils();
    }

    setupGlobalGoatBot() {
        // Initialize global.GoatBot if it doesn't exist
        if (!global.GoatBot) {
            global.GoatBot = {
                commands: new Map(),
                aliases: new Map(),
                events: new Map(),
                cooldowns: new Map(),
                startTime: Date.now(),
                stats: {
                    messagesProcessed: 0,
                    commandsExecuted: 0,
                    errors: 0,
                },
                isConnected: false,
                connectionStatus: "initializing",
                authMethod: null,
                sessionValid: false,
                initialized: false,
            };
        }
        
        // Enhance the existing global.GoatBot with original features
        global.GoatBot = {
            ...global.GoatBot,
            config: this.config,
            configCommands: new Map(),
            commands: global.GoatBot.commands || new Map(),
            aliases: global.GoatBot.aliases || new Map(),
            events: global.GoatBot.events || new Map(),
            onReply: this.onReply,
            onReaction: this.onReaction,
            onChat: this.onChat,
            onFirstChat: this.onFirstChat,
            countDown: this.countDown,
            messageBuffer: this.messageBuffer,
            startTime: global.GoatBot.startTime || Date.now(),
            user: global.GoatBot.user || {},
            sock: global.GoatBot.sock || null,
            db: global.GoatBot.db || null,
            stats: global.GoatBot.stats || {
                messagesProcessed: 0,
                commandsExecuted: 0,
                errors: 0,
                commandStats: new Map()
            },
            isConnected: global.GoatBot.isConnected || false,
            connectionStatus: global.GoatBot.connectionStatus || "initializing",
            authMethod: global.GoatBot.authMethod || null,
            sessionValid: global.GoatBot.sessionValid || false,
            initialized: global.GoatBot.initialized || false,
            adminBot: this.config.admins || [],
            nickNameBot: this.config.botName || "GoatBot",
            prefix: this.config.prefix || ".",
            language: this.config.language || "en",
            hideNotiMessage: {
                commandNotFound: false,
                needRoleToUseCmd: false,
                needRoleToUseCmdOnReply: false,
                needRoleToUseCmdOnReaction: false,
                needRoleToUseCmdOnChat: false
            }
        };
    }

    setupUtils() {
        global.utils = {
            // Text utilities
            getText: (options, key, ...args) => {
                return this.getText(options, key, ...args);
            },
            
            // Get prefix for thread
            getPrefix: (threadID) => {
                // TODO: Implement per-thread prefix from database
                return global.GoatBot.prefix;
            },
            
            // File utilities
            getStreamFromURL: async (url) => {
                const axios = require('axios');
                const response = await axios.get(url, { responseType: 'stream' });
                return response.data;
            },
            
            // Time utilities
            getTime: (format) => {
                const moment = require('moment');
                return moment().format(format);
            },
            
            // Type checking
            getType: (obj) => {
                return Object.prototype.toString.call(obj).slice(8, -1);
            },
            
            // Number checking
            isNumber: (value) => {
                return !isNaN(value) && !isNaN(parseFloat(value));
            },
            
            // Script loading utilities
            loadScripts: (type, fileName, log, configCommands, ...args) => {
                return this.loadScripts(type, fileName, log, configCommands, ...args);
            },
            
            unloadScripts: (type, fileName, log) => {
                return this.unloadScripts(type, fileName, log);
            },
            
            // Logging utilities
            log: {
                info: (type, message, ...args) => {
                    console.log(`[${type}]`, message, ...args);
                },
                err: (type, message, ...args) => {
                    console.error(`[${type}]`, message, ...args);
                },
                warn: (type, message, ...args) => {
                    console.warn(`[${type}]`, message, ...args);
                }
            },
            
            // Remove home directory from path
            removeHomeDir: (filePath) => {
                return filePath.replace(process.cwd(), '');
            },
            
            // Create language getter
            createGetText: (langCode, filePath, prefix, command) => {
                return this.createGetText(langCode, filePath, prefix, command);
            }
        };
    }

    loadLanguages() {
        const langDir = path.join(__dirname, '../languages');
        if (!fs.existsSync(langDir)) {
            fs.mkdirSync(langDir, { recursive: true });
        }

        // Load available language files
        try {
            const langFiles = fs.readdirSync(langDir).filter(file => file.endsWith('.js'));
            for (const file of langFiles) {
                const langCode = file.replace('.js', '');
                const langPath = path.join(langDir, file);
                delete require.cache[require.resolve(langPath)];
                this.languages.set(langCode, require(langPath));
            }
        } catch (error) {
            console.error('Error loading languages:', error);
        }

        // Load default English if no languages found
        if (this.languages.size === 0) {
            this.languages.set('en', this.getDefaultLanguage());
        }
    }

    getDefaultLanguage() {
        return {
            handlerEvents: {
                commandNotFound: "Command \"%1\" not found",
                commandNotFound2: "Use \"%1help\" to see available commands",
                onlyAdmin: "Only group admins can use this command",
                onlyAdminBot: "Only bot admins can use this command",
                onlyAdminBot2: "Only bot admins can use this command: %1",
                onlyAdminToUseOnReply: "Only admins can use reply commands",
                onlyAdminBot2ToUseOnReply: "Only bot admins can use reply commands: %1",
                onlyAdminToUseOnReaction: "Only admins can use reaction commands",
                onlyAdminBot2ToUseOnReaction: "Only bot admins can use reaction commands: %1",
                cannotFindCommand: "Cannot find command: %1",
                cannotFindCommandName: "Cannot find command name",
                errorOccurred: "An error occurred while executing the command",
                errorOccurred2: "An error occurred while executing onChat command %1",
                errorOccurred3: "An error occurred while executing onReply command %1",
                errorOccurred4: "An error occurred while executing onReaction command %1",
                coolDown: "Please wait %1 seconds before using this command again",
                userBanned: "You have been banned from using this bot",
                threadBanned: "This group has been banned from using this bot"
            }
        };
    }

    getText(options, key, ...args) {
        const { lang = 'en', head = 'handlerEvents' } = options;
        const langData = this.languages.get(lang) || this.languages.get('en');
        
        if (!langData || !langData[head] || !langData[head][key]) {
            return key;
        }
        
        let text = langData[head][key];
        
        // Replace placeholders
        args.forEach((arg, index) => {
            text = text.replace(new RegExp(`%${index + 1}`, 'g'), arg);
        });
        
        return text;
    }

    createGetText(langCode, filePath, prefix, command) {
        return (key, ...args) => {
            // Try to get text from command-specific language file
            try {
                const cmdLangPath = path.join(path.dirname(filePath), `${langCode}.js`);
                if (fs.existsSync(cmdLangPath)) {
                    const cmdLang = require(cmdLangPath);
                    const commandName = command.config.name;
                    if (cmdLang[commandName] && cmdLang[commandName].text && cmdLang[commandName].text[key]) {
                        let text = cmdLang[commandName].text[key];
                        // Replace placeholders
                        args.forEach((arg, index) => {
                            text = text.replace(new RegExp(`%${index + 1}`, 'g'), arg);
                        });
                        // Replace {pn} with prefix + command name
                        text = text.replace(/{pn}/g, prefix + commandName);
                        return text;
                    }
                }
            } catch (error) {
                // Fall back to default
            }
            
            // Fall back to default language
            return this.getText({ lang: langCode, head: 'handlerEvents' }, key, ...args);
        };
    }

    loadScripts(type, fileName, log, configCommands, ...args) {
        try {
            const scriptsDir = path.join(__dirname, '../plugins', type === 'cmds' ? 'commands' : 'events');
            const scriptPath = path.join(scriptsDir, fileName);
            
            if (!fs.existsSync(scriptPath)) {
                return {
                    status: 'error',
                    name: fileName,
                    error: new Error('File not found')
                };
            }
            
            // Clear cache
            delete require.cache[require.resolve(scriptPath)];
            
            // Load script
            const script = require(scriptPath);
            
            if (type === 'cmds') {
                global.GoatBot.commands.set(script.config.name, script);
                
                // Add aliases
                if (script.config.aliases) {
                    script.config.aliases.forEach(alias => {
                        global.GoatBot.aliases.set(alias, script.config.name);
                    });
                }
                
                // Add to onChat if has onChat handler
                if (script.onChat && !global.GoatBot.onChat.includes(script.config.name)) {
                    global.GoatBot.onChat.push(script.config.name);
                }
                
                // Add to onFirstChat if has onFirstChat handler
                if (script.onFirstChat && !global.GoatBot.onFirstChat.some(item => item.commandName === script.config.name)) {
                    global.GoatBot.onFirstChat.push({
                        commandName: script.config.name,
                        threadIDsChattedFirstTime: []
                    });
                }
            } else {
                global.GoatBot.events.set(script.config.name, script);
            }
            
            return {
                status: 'success',
                name: fileName,
                script: script
            };
            
        } catch (error) {
            return {
                status: 'error',
                name: fileName,
                error: error
            };
        }
    }

    unloadScripts(type, fileName, log) {
        try {
            const scriptsDir = path.join(__dirname, '../plugins', type === 'cmds' ? 'commands' : 'events');
            const scriptPath = path.join(scriptsDir, fileName);
            
            if (type === 'cmds') {
                // Find and remove command
                for (const [name, cmd] of global.GoatBot.commands) {
                    if (cmd.config && cmd.config.name === fileName.replace('.js', '')) {
                        global.GoatBot.commands.delete(name);
                        
                        // Remove aliases
                        if (cmd.config.aliases) {
                            cmd.config.aliases.forEach(alias => {
                                global.GoatBot.aliases.delete(alias);
                            });
                        }
                        
                        // Remove from onChat
                        const chatIndex = global.GoatBot.onChat.indexOf(name);
                        if (chatIndex !== -1) {
                            global.GoatBot.onChat.splice(chatIndex, 1);
                        }
                        
                        // Remove from onFirstChat
                        const firstChatIndex = global.GoatBot.onFirstChat.findIndex(item => item.commandName === name);
                        if (firstChatIndex !== -1) {
                            global.GoatBot.onFirstChat.splice(firstChatIndex, 1);
                        }
                        
                        break;
                    }
                }
            } else {
                global.GoatBot.events.delete(fileName.replace('.js', ''));
            }
            
            // Clear cache
            delete require.cache[require.resolve(scriptPath)];
            
            return {
                status: 'success',
                name: fileName
            };
            
        } catch (error) {
            return {
                status: 'error',
                name: fileName,
                error: error
            };
        }
    }
}

module.exports = new GoatBotConfig();
