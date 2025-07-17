/*
Not Working!
Video and Audio Downloading is not working properly.
You can use the ytdl plugin to download videos and audio from YouTube.
*/

const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  getStreamFromURL,
  sendAttachmentWithText,
  sendMultipleAttachments,
  ensureDir,
  getDownloadsDir,
  getTempDir,
  cleanupFile,
  sanitizeFilename,
  isWithinSizeLimit,
  downloadWithYoutubeDL,
  validateYouTubeURL,
  validateMediaFile
} = require("../../utils/utils");

module.exports = {
  config: {
    name: "ytdl",
    version: "1.0",
    author: "@anbuinfosec",
    countDown: 10,
    role: 0,
    description: "Download YouTube videos and audio",
    category: "media",
    guide: "{pn} <song name>: Search and select video/audio"
      + "\n{pn} -a <song name>: Show 5 results for audio selection"
      + "\n{pn} -v <song name>: Show 5 results for video selection"
  },

  onStart: async function ({ args, message, api, reply }) {
    try {
      if (!args || args.length < 1) {
        return reply("Please provide a search term!\n\nUsage:\n• .ytdl <song name> - Search and select video/audio\n• .ytdl -a <song name> - Show 5 results for audio selection\n• .ytdl -v <song name> - Show 5 results for video selection");
      }
      let downloadType = "both";
      let searchQuery = "";
      if (args[0].startsWith("-")) {
        const flag = args[0];
        if (flag === "-a") downloadType = "audio";
        else if (flag === "-v") downloadType = "video";
        searchQuery = args.slice(1).join(" ");
      } else {
        searchQuery = args.join(" ");
      }
      if (!searchQuery) return reply("Please provide a search term!");
      await reply("🔍 Searching for: " + searchQuery);
      try {
        const searchResults = await yts(searchQuery);
        if (!searchResults.videos || searchResults.videos.length === 0) {
          return reply("❌ No videos found for: " + searchQuery);
        }
        const topVideos = searchResults.videos.slice(0, 5);
        let searchText = `🎵 *Top 5 Results for \"${searchQuery}\"*\n\n`;
        const thumbnailUrls = [];
        for (let i = 0; i < topVideos.length; i++) {
          const vid = topVideos[i];
          searchText += `${i + 1}. *${vid.title}*\n`;
          searchText += `   👤 ${vid.author.name}\n`;
          searchText += `   ⏱️ ${vid.duration.timestamp}\n`;
          searchText += `   👁️ ${vid.views} views\n`;
          searchText += `   🔗 ${vid.url}\n\n`;
          if (vid.thumbnail && typeof vid.thumbnail === 'string' && vid.thumbnail.trim() && vid.thumbnail.startsWith('http')) {
            thumbnailUrls.push(vid.thumbnail.trim());
          }
        }
        if (downloadType === "audio") {
          searchText += `📝 *Reply with number (1-5) to download audio*\nExample: Reply \"1\" to download audio from result #1`;
        } else if (downloadType === "video") {
          searchText += `📝 *Reply with number (1-5) to download video*\nExample: Reply \"1\" to download video from result #1`;
        } else {
          searchText += `📝 *Reply with:*\n• Number + \"a\" for audio (e.g., \"1a\", \"2a\")\n• Number + \"v\" for video (e.g., \"1v\", \"2v\")\n• Just number for info (e.g., \"1\", \"2\")`;
        }
        if (thumbnailUrls.length > 0) {
          try {
            await message.reply({ body: searchText, attachment: thumbnailUrls });
          } catch (error) {
            await message.reply(searchText);
          }
        } else {
          await message.reply(searchText);
        }
      } catch (searchError) {
        await reply("❌ Error searching for videos. Please try again.");
      }
    } catch (error) {
      await reply("❌ An error occurred while processing your request. Please try again.");
    }
  },

  onReply: async function ({ body, reply, api, message, quotedMessage }) {
    try {
      if (!quotedMessage || !quotedMessage.conversation) return;
      const quotedText = quotedMessage.conversation;
      if (!quotedText.includes("Top 5 Results for")) return;
      const userInput = body.trim().toLowerCase();
      const searchQueryMatch = quotedText.match(/Top 5 Results for \"(.+?)\"/);
      if (!searchQueryMatch) return reply("❌ Could not find search query in the original message.");
      const searchQuery = searchQueryMatch[1];
      let downloadType = "both";
      let selectedIndex = -1;
      let action = "";
      if (quotedText.includes("Reply with number (1-5) to download audio")) {
        downloadType = "audio";
        const match = userInput.match(/^(\d+)$/);
        if (match) {
          selectedIndex = parseInt(match[1]) - 1;
          action = "a";
        }
      } else if (quotedText.includes("Reply with number (1-5) to download video")) {
        downloadType = "video";
        const match = userInput.match(/^(\d+)$/);
        if (match) {
          selectedIndex = parseInt(match[1]) - 1;
          action = "v";
        }
      } else {
        const match = userInput.match(/^(\d+)([av]?)$/);
        if (match) {
          selectedIndex = parseInt(match[1]) - 1;
          action = match[2] || "info";
        }
      }
      if (selectedIndex === -1 || selectedIndex < 0 || selectedIndex >= 5) {
        return reply("❌ Invalid selection! Please choose a number between 1-5.");
      }
      const processingMsg = await reply("🔍 Processing your selection...");
      const searchResults = await yts(searchQuery);
      if (!searchResults.videos || searchResults.videos.length <= selectedIndex) {
        await reply("❌ Selected video not found. Please try again.");
        if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
        return;
      }
      const video = searchResults.videos[selectedIndex];
      const videoUrl = video.url;
      const videoTitle = video.title;
      const videoDuration = video.duration.timestamp;
      const videoViews = video.views;
      const videoAuthor = video.author.name;
      const tmpDir = getTempDir();
      const fileExtension = action === "a" ? "m4a" : "mp4";
      const filename = `${sanitizeFilename(videoTitle)}.${fileExtension}`;
      const filepath = path.join(tmpDir, filename);
      const partFile = filepath + '.part';
      if (fs.existsSync(partFile)) {
        let waited = 0;
        while (fs.existsSync(partFile) && waited < 30) {
          await new Promise(res => setTimeout(res, 1000));
          waited++;
        }
      }
      if (!fs.existsSync(filepath)) {
        let errorMsg = "❌ Download failed or incomplete. Please try again.";
        if (fs.existsSync(partFile)) {
          errorMsg += "\nReason: Download still in progress or interrupted (.part file exists).";
        } else {
          errorMsg += "\nReason: File does not exist after download attempt.";
        }
        await reply(errorMsg);
        if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
        return;
      }
      if (action === "a") {
        try {
          // Use utils downloader for audio
          await downloadWithYoutubeDL(videoUrl, filepath, "audio");
          if (!validateMediaFile(filepath, "audio")) {
            cleanupFile(filepath);
            await reply("❌ Downloaded audio file is invalid or corrupted. Please try another video.");
            if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
            return;
          }
          const audioStream = await getStreamFromURL(filepath);
          if (audioStream) {
            await message.reply({
              body: `🎵 *${videoTitle}*\n\n👤 Author: ${videoAuthor}\n⏱️ Duration: ${videoDuration}\n👁️ Views: ${videoViews}\n🔗 ${videoUrl}\n\n📥 Downloaded by @anbuinfosec Bot`,
              attachment: audioStream
            });
          } else {
            await reply("❌ Error sending audio file. File might be too large or corrupted.");
          }
          cleanupFile(filepath);
          if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
        } catch (downloadError) {
          await reply("❌ Error downloading audio. Please try another video.");
          if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
        }
      } else if (action === "v") {
        try {
          // Use utils downloader for video
          await downloadWithYoutubeDL(videoUrl, filepath, "video");
          if (!validateMediaFile(filepath, "video")) {
            cleanupFile(filepath);
            await reply("❌ Downloaded video file is invalid or corrupted. Please try another video.");
            if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
            return;
          }
          if (!isWithinSizeLimit(filepath, 25)) {
            cleanupFile(filepath);
            await reply("❌ Video file is too large! Maximum size allowed is 25MB.");
            if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
            return;
          }
          const videoStream = await getStreamFromURL(filepath);
          if (videoStream) {
            await message.reply({
              body: `🎥 *${videoTitle}*\n\n👤 Author: ${videoAuthor}\n⏱️ Duration: ${videoDuration}\n👁️ Views: ${videoViews}\n🔗 ${videoUrl}\n\n📥 Downloaded by @anbuinfosec Bot`,
              attachment: videoStream
            });
          } else {
            await reply("❌ Error sending video file. File might be too large or corrupted.");
          }
          cleanupFile(filepath);
          if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
        } catch (downloadError) {
          await reply("❌ Error downloading video. Please try another video.");
          if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
        }
      } else {
        await reply(`🔗 YouTube Link: ${videoUrl}\n*${videoTitle}* by ${videoAuthor}\nDuration: ${videoDuration}\nViews: ${videoViews}`);
        if (processingMsg?.unsend) await message.unsend.call({ sock: message.sock, threadID: message.threadID, msg: processingMsg });
      }
    } catch (error) {
      await reply("❌ An error occurred while processing your request. Please try again.");
    }
  }
}
