// Corrected the path to be relative
const { sleep } = require("@/libs/utils");

module.exports = {
  config: {
    name: "ping",
    aliases: ["p"],
    version: "1.0",
    author: "You",
    countDown: 5,
    role: 0, 
    description: "Check bot's response time.",
    category: "Utility",
    guide: "{pn}",
  },

  onCmd: async ({ api, message, reply }) => {
    const startTime = Date.now();
    const sentMsg = await reply("Pinging..."); 
    const latency = Date.now() - startTime;

    await api.sendMessage(message.key.remoteJid, {
      text: `🏓 Pong!\nLatency: ${latency}ms`,
      edit: sentMsg.key,
    });
  },
};