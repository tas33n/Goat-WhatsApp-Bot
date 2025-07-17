module.exports = {
    handlerEvents: {
        commandNotFound: "Command \"%1\" not found",
        commandNotFound2: "Use \"%1help\" to see available commands",
        onlyAdmin: "Only group administrators can use this command",
        onlyAdminBot: "Only bot administrators can use this command",
        onlyAdminBot2: "Only bot administrators can use this command: %1",
        onlyAdminToUseOnReply: "Only group administrators can use reply commands",
        onlyAdminBot2ToUseOnReply: "Only bot administrators can use reply commands: %1",
        onlyAdminToUseOnReaction: "Only group administrators can use reaction commands",
        onlyAdminBot2ToUseOnReaction: "Only bot administrators can use reaction commands: %1",
        cannotFindCommand: "Cannot find command: %1",
        cannotFindCommandName: "Cannot find command name",
        errorOccurred: "An error occurred while executing the command",
        errorOccurred2: "An error occurred while executing onChat command %1 at %2:\n%3",
        errorOccurred3: "An error occurred while executing onReply command %1 at %2:\n%3",
        errorOccurred4: "An error occurred while executing onReaction command %1 at %2:\n%3",
        coolDown: "Please wait %1 seconds before using this command again",
        userBanned: "You have been banned from using this bot",
        threadBanned: "This group has been banned from using this bot",
        needRoleToUseCmd: "You need to be a group administrator to use this command",
        needRoleToUseCmdOnReply: "You need to be a group administrator to use reply commands",
        needRoleToUseCmdOnReaction: "You need to be a group administrator to use reaction commands",
        needRoleToUseCmdOnChat: "You need to be a group administrator to use chat commands"
    },
    
    // Command-specific language entries
    help: {
        description: "Display list of available commands",
        guide: "Use {pn} to see all commands\nUse {pn} <command> to see command details",
        text: {
            noPermission: "You don't have permission to view this command",
            commandNotFound: "Command \"%1\" not found",
            commandsList: "📋 Available Commands",
            commandDetails: "📖 Command Details",
            usage: "Usage: %1",
            aliases: "Aliases: %1",
            description: "Description: %1",
            cooldown: "Cooldown: %1 seconds",
            role: "Required role: %1",
            category: "Category: %1"
        }
    },
    
    ping: {
        description: "Check bot response time",
        guide: "Use {pn} to check bot ping",
        text: {
            pong: "🏓 Pong!\n⏱️ Response time: %1ms\n📡 Connection: %2"
        }
    },
    
    rank: {
        description: "View user rank and experience",
        guide: "Use {pn} to view your rank\nUse {pn} @user to view someone's rank",
        text: {
            userRank: "🏆 RANK INFORMATION 🏆\n\n👤 User: %1\n📊 Level: %2\n⭐ Experience: %3 XP\n🎯 Rank: #%4\n📈 Progress: %5/%6 XP\n%7\n🔥 Next Level: %8 XP needed\n\n💡 Tip: Stay active to earn more XP!",
            userNotFound: "User not found in database"
        }
    },
    
    weather: {
        description: "Get weather information for a location",
        guide: "Use {pn} <location> to get weather info\nExample: {pn} London",
        text: {
            missingLocation: "❌ Please provide a location!\nExample: weather London",
            fetching: "🌤️ Getting weather information...",
            locationNotFound: "❌ Location not found. Please check the spelling and try again.",
            serviceUnavailable: "❌ Weather service unavailable. Please contact admin.",
            error: "❌ Error fetching weather data. Please try again later.",
            weatherReport: "%1 WEATHER REPORT %1\n\n📍 Location: %2, %3\n🌡️ Temperature: %4°C\n🤒 Feels Like: %5°C\n🌦️ Description: %6\n💧 Humidity: %7%\n🌪️ Wind Speed: %8 m/s\n👁️ Visibility: %9 km\n🌅 Sunrise: %10\n🌇 Sunset: %11\n📊 Pressure: %12 hPa\n\n🌐 Weather data provided by OpenWeatherMap"
        }
    },
    
    status: {
        description: "Check bot status and system information",
        guide: "Use {pn} to check bot status",
        text: {
            statusInfo: "🤖 BOT STATUS\n\n🟢 Status: %1\n📡 Connection: %2\n⏱️ Uptime: %3\n📊 Commands: %4\n🎯 Events: %5\n💾 Database: %6\n🔧 Version: %7\n\n📈 STATISTICS\n• Messages: %8\n• Commands: %9\n• Errors: %10"
        }
    },
    
    prefix: {
        description: "Change bot prefix",
        guide: "Use {pn} <new_prefix> to change prefix",
        text: {
            myPrefix: "My prefix is: %1\nThread prefix: %2",
            changed: "✅ Prefix changed to: %1",
            missingPrefix: "❌ Please provide a new prefix",
            invalidPrefix: "❌ Invalid prefix format"
        }
    },
    
    auth: {
        description: "Authentication and user management",
        guide: "Use {pn} <action> for auth actions",
        text: {
            notAdmin: "❌ You are not authorized to use this command",
            success: "✅ Authentication successful",
            failed: "❌ Authentication failed",
            userBanned: "❌ User has been banned",
            userUnbanned: "✅ User has been unbanned"
        }
    }
};
