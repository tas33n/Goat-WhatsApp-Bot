module.exports = {
  config: {
    name: "eval",
    aliases: ["e"],
    description: "Evaluate JavaScript code.",
    role: 2, // Bot admin only
    countDown: 2
  },
  onCmd: async ({ args, reply, message, user, config, logger, event }) => {
    const code = args.join(" ");
    if (!code) return reply("⚠️ Please provide code to evaluate.");
    try {
      // Use eval in a restricted scope
      let result = await eval(code);
    //   if (typeof result !== "string") result = require("util").inspect(result, { depth: 1 });
    //   reply(`✅ Result:\n${result}`);
    } catch (err) {
      logger.error("Eval error:", err);
      reply(`❌ Error:\n${err}`);
    }
  }
};
