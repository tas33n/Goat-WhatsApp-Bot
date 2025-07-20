module.exports = {
  config: {
    name: "eval",
    aliases: ["e"],
    description: "Evaluate JavaScript code.",
    role: 2, // Bot admin only
    countDown: 2,
  },
  onCmd: async ({ args, reply, message, user, config, logger, event }) => {
    function output(msg) {
      if (
        typeof msg == "number" ||
        typeof msg == "boolean" ||
        typeof msg == "function"
      )
        msg = msg.toString();
      else if (msg instanceof Map) {
        let text = `Map(${msg.size}) `;
        text += JSON.stringify(mapToObj(msg), null, 2);
        msg = text;
      } else if (typeof msg == "object") msg = JSON.stringify(msg, null, 2);
      else if (typeof msg == "undefined") msg = "undefined";
      message.reply(msg);
    }
    function out(msg) {
      output(msg);
    }
    function mapToObj(map) {
      const obj = {};
      map.forEach(function (v, k) {
        obj[k] = v;
      });
      return obj;
    }

    const code = args.join(" ");
    if (!code) return reply("⚠️ Please provide code to evaluate.");
    const cmd = `
    (async () => {
      try {
        ${code}
      }
      catch(err) {
        logger.error("Eval error:", err);
        reply("❌ Error:\\n" + (err.stack || JSON.stringify(err, null, 2)));
      }
    })()
  `;
    try {
      await eval(cmd);
    } catch (err) {
      logger.error("Eval error:", err);
      reply(`❌ Error:\n${err}`);
    }
  },
};
