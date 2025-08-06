const simi = require('node-simipro');

module.exports = {
  config: {
    name: "simi",
    aliases: ["simsimi", "sim"],
    description: "Chat or teach Simi with simsimi",
    author: "anbuinfosec",
    cooldown: 5,
    role: 0,
    category: "fun",
    guide: `Usage:
- Talk: {pn}simi <message>
- Teach: {pn}simi -teach -ask <question> -ans <answer> -lc <language>
Example:
{pn}simi hello
{pn}simi -teach -ask hi -ans hello -lc en`
  },

  onCmd: async ({ args, reply, react }) => {
    if (args.length === 0) {
      return reply("❌ Hey baka follow the steps.\nUse 'simi <message>' to chat or 'simi -teach -ask <question> -ans <answer> -lc <language>' to teach.");
    }

    const isTeach = args.includes("-teach");
    if (isTeach) {
      const askIndex = args.indexOf("-ask");
      const ansIndex = args.indexOf("-ans");
      const lcIndex = args.indexOf("-lc");

      if (askIndex === -1 || ansIndex === -1 || lcIndex === -1) {
        return reply("❌ Teach mode requires -ask, -ans, and -lc parameters.\nExample:\nsimi -teach -ask hi -ans hello -lc en");
      }

      const question = args[askIndex + 1];
      const answer = args[ansIndex + 1];
      const lang = args[lcIndex + 1];

      if (!question || !answer || !lang) {
        return reply("❌ Invalid teach parameters. Make sure to provide values for -ask, -ans and -lc.");
      }

      await react("💡");
      try {
        const res = await simi.simiteach(question, answer, lang);
        if (res.success) {
          return reply(`✅ ${res.message}`);
        } else {
          return reply(`❌ Failed to teach Simi. Message: ${res.message || "Unknown error"}`);
        }
      } catch (error) {
        console.error("Simi teach error:", error);
        return reply("❌ Error occurred while teaching Simi.");
      }
    } else {
      const message = args.join(" ");
      const lang = global.GoatBot.simiLang || "en";

      await react("💬");
      try {
        const res = await simi.simitalk(message, lang);
        if (res.success) {
          return reply(`📨 ${res.message}`);
        } else {
          return reply(`❌ Failed to get response from Simi. Message: ${res.message || "Unknown error"}`);
        }
      } catch (error) {
        console.error("Simi talk error:", error);
        return reply("❌ Error occurred while talking to Simi.");
      }
    }
  }
};
