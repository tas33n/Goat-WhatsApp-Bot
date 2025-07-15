module.exports = {
  config: {
    name: "auth",
    aliases: ["login", "session"],
    version: "1.0",
    author: "Anonymous",
    countDown: 5,
    role: 1, // Admin only
    description: "Manage bot authentication and session",
    category: "Admin",
    guide: "{pn} [info|clear|restart]",
  },

  onCmd: async ({ api, message, args, reply }) => {
    const action = args[0]?.toLowerCase()

    switch (action) {
      case "info":
        const authInfo = `🔐 *Authentication Info*

📱 *Method:* ${global.GoatBot.authMethod || "Unknown"}
✅ *Session Valid:* ${global.GoatBot.sessionValid ? "Yes" : "No"}
🔗 *Connected:* ${global.GoatBot.isConnected ? "Yes" : "No"}
📊 *Status:* ${global.GoatBot.connectionStatus}
⏰ *Session Age:* ${Math.floor((Date.now() - global.GoatBot.startTime) / 1000)}s

🌐 *Dashboard:* http://localhost:3000`

        await reply(authInfo)
        break

      case "clear":
        await reply("⚠️ This will clear the session and require re-authentication. The bot will restart automatically.")
        setTimeout(() => {
          process.exit(2) // Trigger restart
        }, 2000)
        break

      case "restart":
        await reply("🔄 Restarting authentication process...")
        setTimeout(() => {
          process.exit(2) // Trigger restart
        }, 1000)
        break

      default:
        const helpText = `🔐 *Authentication Commands*

📋 *Available Actions:*
• \`${global.config?.prefix || "."}auth info\` - Show auth information
• \`${global.config?.prefix || "."}auth clear\` - Clear session data
• \`${global.config?.prefix || "."}auth restart\` - Restart auth process

🌐 *Dashboard:* http://localhost:3000`

        await reply(helpText)
    }
  },
}
