const axios = require("axios");

module.exports = {
  config: {
    name: "imagine",
    aliases: ["t2i", "imagegen", "aiart"],
    description: "Generate an image from text using AI",
    author: "anbuinfosec",
    cooldown: 5,
    role: 0,
    category: "ai",
    guide: "{pn}imagine <prompt> → generate image from prompt\nExample:\n{pn}imagine cyberpunk cat"
  },

  onCmd: async ({ args, event, reply, react }) => {
    const prompt = args.join(" ");
    if (!prompt) return reply("❌ Please provide a prompt.\nExample: /imagine cyberpunk hacker");

    await react("🎨");

    const apiUrl = `https://t2i.anbuinfosec.workers.dev/${encodeURIComponent(prompt)}`;

    try {
      const { data } = await axios.get(apiUrl, {
        responseType: "arraybuffer",
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      await react("✔️");
      await reply({
        image: Buffer.from(data),
        mimetype: "image/jpeg",
        caption: `🧠 *Prompt:* ${prompt}`
      });
    } catch (err) {
      console.error("Image generation error:", err);
      await react("❌");
      return reply("❌ Failed to generate image. Try again later.");
    }
  },
};
