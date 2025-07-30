const axios = require("axios");

module.exports = {
  config: {
    name: "gemini",
    aliases: ["ai", "ask", "chat"],
    description: "Ask anything to Google's Gemini AI (free version)",
    author: "anbuinfosec",
    cooldown: 5,
    role: 0,
    category: "ai",
    guide: "{pn}gemini <question>\nExample: {pn}gemini explain quantum computing in simple terms"
  },

  onCmd: async ({ args, event, reply, react }) => {
    const prompt = args.join(" ");
    const apiKey = global.GoatBot.config.apikeys?.gemini;

    if (!apiKey) {
      await react("❌");
      return reply("❌ Gemini API key is not set. Please define `GEMINI_API_KEY` in your .env file.");
    }

    if (!prompt) {
      return reply("❌ Please provide a prompt.\nExample: /gemini what is machine learning?");
    }

    await react("💭");

    try {
      const res = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey
          }
        }
      );

      const replyText =
        res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!replyText) {
        await react("❌");
        return reply("❌ Gemini could not generate a response.");
      }

      await react("✅");
      return reply(`🧠 *Gemini AI says:*\n\n${replyText}`);
    } catch (err) {
      console.error("Gemini error:", err.response?.data || err.message);
      await react("❌");
      return reply("❌ Failed to connect to Gemini API. Please try again.");
    }
  },
};
