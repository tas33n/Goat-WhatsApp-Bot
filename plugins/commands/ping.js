// Corrected the path to be relative
const { sleep } = require("@/libs/utils");

module.exports = {
  config: {
    name: "ping",
    aliases: ["p"],
    version: "1.0",
    author: "You",
    countDown: 5,
    role: 0, // 0 = everyone, 1 = admin
    description: "Check bot's response time.",
    category: "Utility",
    guide: "{pn}",
  },

  onCmd: async ({ api, message, reply }) => {
    const startTime = Date.now();
    // The initial reply is enough to measure latency from the user's perspective.
    const sentMsg = await reply("Pinging..."); 
    const latency = Date.now() - startTime;
    
    // The sleep here isn't necessary for a ping command, it just adds an artificial delay.
    // I've kept it as it was in your file, but you might consider removing it.
    await sleep(1000); 

    await api.sendMessage(message.key.remoteJid, {
      text: `🏓 Pong!\nLatency: ${latency}ms`,
      edit: sentMsg.key,
    });
  },
};