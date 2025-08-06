const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "tts",
    version: "1.0",
    author: "@anbuinfosec",
    description: "Convert text to speech",
    category: "tools",
    guide: "{pn} <text> - Say something\nOptional: {pn} -lc <lang_code> <text> (default: en)",
  },

  onStart: async function ({ args, reply, react }) {
    if (!args[0]) return reply("🗣️ Please provide text to speak.\nExample: .tts Hello world!");

    let lang = "en";
    let text = args.join(" ");

    if (args[0] === "-lc") {
      lang = args[1];
      text = args.slice(2).join(" ");
    }

    if (!text) return reply("❌ Text is missing after language code.");

    try {
      await react("🔊");

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        text
      )}&tl=${lang}&client=tw-ob`;

      const res = await axios.get(url, { responseType: "arraybuffer" });

      const filePath = path.join(__dirname, `../../tmp/tts_${Date.now()}.mp3`);
      fs.writeFileSync(filePath, res.data);

      const audioBuffer = fs.readFileSync(filePath);

      await reply({
        audio: audioBuffer,
        mimetype: "audio/mpeg",
        ptt: true,
      });

      fs.unlinkSync(filePath);
      await react("✅");
    } catch (err) {
      console.error("TTS Error:", err);
      await react("❌");
      reply("❌ Failed to generate TTS audio.");
    }
  },
};
