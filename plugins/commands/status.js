module.exports = {
  config: {
    name: "status",
    aliases: ["stats", "info"],
    version: "1.0",
    author: "@anbuinfosec",
    countDown: 3,
    role: 0,
    description: "Show bot status and statistics",
    category: "Utility",
    guide: "{pn}",
  },

  onCmd: async ({ reply, user, thread, role, utils, logger }) => {
    const uptime = Date.now() - global.GoatBot.startTime
    const hours = Math.floor(uptime / (1000 * 60 * 60))
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000)

    const status = `🐐 *GOAT Bot Status*

🔗 *Connection:* ${global.GoatBot.isConnected ? "✅ Connected" : "❌ Disconnected"}
⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s
📊 *Messages Processed:* ${global.GoatBot.stats.messagesProcessed}
⚡ *Commands Executed:* ${global.GoatBot.stats.commandsExecuted}
❌ *Errors:* ${global.GoatBot.stats.errors}
📦 *Commands Loaded:* ${global.GoatBot.commands.size}
🎭 *Events Loaded:* ${global.GoatBot.events.size}`

    await reply(status)
  },
}
