module.exports = {
  config: {
    name: "ping",
    aliases: ["p"],
    version: "1.0",
    author: "@anbuinfosec",
    countDown: 0,
    role: 0, 
    description: "Check bot's response time.",
    category: "Utility",
    guide: "{pn}",
  },

  onCmd: async ({ api, message, reply, user, thread, role, utils, logger }) => {
    const startTime = Date.now();
    const sentMsg = await reply("Pinging..."); 
    const latency = Date.now() - startTime;

    await api.sendMessage(sentMsg.key.remoteJid, {
      text: `🏓 Pong!\nLatency: ${latency}ms`,
      edit: sentMsg.key,
    });
  },
};