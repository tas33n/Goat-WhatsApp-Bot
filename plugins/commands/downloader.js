const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "downloader",
    aliases: ["fbdl", "ytdl", "mediadl", "igdl", "twdl", "dl"],
    description: "Universal media downloader for videos and audios",
    author: "anbuinfosec",
    cooldown: 5,
    role: 0,
    category: "media",
    guide:"{pn}downloader -v <url> → download video" + 
    "\n{pn}downloader -a <url> → download audio"
  },

  onCmd: async ({ args, event, reply, react }) => {
    const type = args[0] === "-a" ? "audio" : "video";
    const url = args[1];

    if (!url?.startsWith("http")) {
      return reply(
        "❌ Please provide a valid URL.\nUsage:\n/downloader -v <url> or -a <url>"
      );
    }

    await react("⏳");
    const apikey = ""; // set your API key here or via env variable. Get one from https://api.anbuinfosec.xyz/
    if (!apikey) {
      await react("❌");
      return reply(
        "❌ API key is not set. Please set your API key in the code."
      );
    }
    const apiUrl = `https://api.anbuinfosec.xyz/api/downloader/download?url=${encodeURIComponent(
      url
    )}&apikey=${apikey}`;

    try {
      const { data } = await axios.get(apiUrl);

      if (!data.success || !data.medias?.length) {
        await react("❌");
        return reply("❌ No media found for the provided URL.");
      }

      const selected = getBestMedia(data.medias, type);
      if (!selected?.url) {
        await react("❌");
        return reply(`❌ No ${type} found.`);
      }

      const ext = selected.extension || (type === "audio" ? "m4a" : "mp4");
      const tempDir = path.join(__dirname, "tmp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, `media_${Date.now()}.${ext}`);

      const mediaStream = await axios({
        url: selected.url,
        method: "GET",
        responseType: "stream",
      });

      const writer = fs.createWriteStream(tempPath);
      mediaStream.data.pipe(writer);

      writer.on("finish", async () => {
        try {
          await react("✔️");

          // Read file fully as buffer to avoid Baileys toString() error
          const buffer = fs.readFileSync(tempPath);

          await reply({
            [type]: buffer,
            mimetype: type === "audio" ? "audio/mpeg" : "video/mp4",
            caption: `🎬 *Title:* ${data.title || "N/A"}\n👤 *Author:* ${
              data.author || "N/A"
            }\n📺 *Type:* ${type.toUpperCase()}`,
          });
        } catch (err) {
          console.error("Failed to send media:", err);
          await react("❌");
          try {
          fs.unlink(tempPath, () => {});} catch (unlinkErr) {
            console.error("Failed to delete temp file:", unlinkErr);
          }
          await reply("❌ Failed to send media.");
          return;
        } finally {
          // Always delete temp file after attempt
          fs.unlink(tempPath, () => {});
        }
      });

      writer.on("error", async () => {
        await react("❌");
        await reply("❌ Failed to save media file.");
        fs.unlink(tempPath, () => {});
      });
    } catch (err) {
      console.error("Download error:", err);
      await react("❌");
      reply("❌ An error occurred during download.");
    }
  },
};

function getBestMedia(medias, type = "video") {
  const filtered = medias.filter((m) => m.type === type);
  if (!filtered.length) return null;

  if (type === "video") {
    return filtered.sort((a, b) => {
      const resA = parseInt(a.resolution?.split("x")[1] || "0", 10);
      const resB = parseInt(b.resolution?.split("x")[1] || "0", 10);
      return resB - resA;
    })[0];
  } else {
    return filtered.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
  }
}
