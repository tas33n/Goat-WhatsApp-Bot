const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { getStreamFromURL, sendAttachmentWithText, sendMultipleAttachments, ensureDir, getDownloadsDir, getTempDir, cleanupFile, sanitizeFilename, isWithinSizeLimit, downloadWithYoutubeDL, validateYouTubeURL, validateMediaFile } = global.utils || require("../../utils/utils");

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
    // Wrap the entire function in try-catch to prevent crashes
    try {
      if (args.length < 1) {
        return reply("Please provide a search term!\n\nUsage:\n• .ytdl <song name> - Search and select video/audio\n• .ytdl -a <song name> - Show 5 results for audio selection\n• .ytdl -v <song name> - Show 5 results for video selection");
      }

      let downloadType = "both"; // Default to both audio and video options
      let searchQuery = "";
      
      // Check if first argument is a flag
      if (args[0].startsWith("-")) {
        const flag = args[0];
        if (flag === "-a") {
          downloadType = "audio";
        } else if (flag === "-v") {
          downloadType = "video";
        }
        searchQuery = args.slice(1).join(" ");
      } else {
        // No flag, just search query
        searchQuery = args.join(" ");
      }

      if (!searchQuery) {
        return reply("Please provide a search term!");
      }

      // Show processing message
      await reply("🔍 Searching for: " + searchQuery);

      try {
        // Search for videos
        const searchResults = await yts(searchQuery);
        
        if (!searchResults.videos || searchResults.videos.length === 0) {
          return reply("❌ No videos found for: " + searchQuery);
        }

        // Get top 5 results
        const topVideos = searchResults.videos.slice(0, 5);
        
        // Create message with video information
        let searchText = `🎵 *Top 5 Results for "${searchQuery}"*\n\n`;
        
        // Collect thumbnail URLs
        const thumbnailUrls = [];
        
        for (let i = 0; i < topVideos.length; i++) {
          const vid = topVideos[i];
          searchText += `${i + 1}. *${vid.title}*\n`;
          searchText += `   👤 ${vid.author.name}\n`;
          searchText += `   ⏱️ ${vid.duration.timestamp}\n`;
          searchText += `   👁️ ${vid.views} views\n\n`;
          
          // Add thumbnail URL for batch sending - validate URL first
          if (vid.thumbnail && typeof vid.thumbnail === 'string' && vid.thumbnail.trim()) {
            const thumbnailUrl = vid.thumbnail.trim();
            if (thumbnailUrl.startsWith('http')) {
              thumbnailUrls.push(thumbnailUrl);
              console.log(`Added thumbnail ${i + 1}: ${thumbnailUrl}`);
            } else {
              console.log(`Invalid thumbnail URL for video ${i + 1}: ${thumbnailUrl}`);
            }
          } else {
            console.log(`No thumbnail found for video ${i + 1}: ${vid.title}`);
          }
        }
        
        // Add reply instructions based on download type
        if (downloadType === "audio") {
          searchText += `📝 *Reply with number (1-5) to download audio*\n`;
          searchText += `Example: Reply "1" to download audio from result #1`;
        } else if (downloadType === "video") {
          searchText += `📝 *Reply with number (1-5) to download video*\n`;
          searchText += `Example: Reply "1" to download video from result #1`;
        } else {
          searchText += `📝 *Reply with:*\n`;
          searchText += `• Number + "a" for audio (e.g., "1a", "2a")\n`;
          searchText += `• Number + "v" for video (e.g., "1v", "2v")\n`;
          searchText += `• Just number for info (e.g., "1", "2")`;
        }
        
        // Send message with thumbnails in a single message using GoatBot V2 style
        if (thumbnailUrls.length > 0) {
          try {
            console.log(`Sending ${thumbnailUrls.length} thumbnail URLs:`, thumbnailUrls);
            
            // Use GoatBot V2 style message.reply with attachments
            await message.reply({
              body: searchText,
              attachment: thumbnailUrls
            });
            
          } catch (error) {
            console.error("Error sending thumbnails with text:", error);
            // Fallback to text only if thumbnails fail
            try {
              await message.reply(searchText);
            } catch (textError) {
              console.error("Failed to send text fallback:", textError);
              reply("❌ Error displaying search results. Please try again.");
            }
          }
        } else {
          // Send only text if no thumbnails
          try {
            await message.reply(searchText);
          } catch (textError) {
            console.error("Failed to send text:", textError);
            reply("❌ Error displaying search results. Please try again.");
          }
        }

      } catch (searchError) {
        console.log("Search error:", searchError);
        reply("❌ Error searching for videos. Please try again.");
      }

    } catch (error) {
      console.error("YouTube downloader error:", error);
      // Don't let this crash the bot
      try {
        reply("❌ An error occurred while processing your request. Please try again.");
      } catch (replyError) {
        console.error("Failed to send error reply:", replyError);
      }
    }
  },

  onReply: async function ({ body, reply, api, message, quotedMessage }) {
    try {
      // Check if this is a reply to a ytdl search result
      if (!quotedMessage || !quotedMessage.conversation) return;
      
      const quotedText = quotedMessage.conversation;
      if (!quotedText.includes("Top 5 Results for")) return;

      // Parse user input
      const userInput = body.trim().toLowerCase();
      
      // Extract search query from quoted message
      const searchQueryMatch = quotedText.match(/Top 5 Results for "(.+?)"/);
      if (!searchQueryMatch) {
        return reply("❌ Could not find search query in the original message.");
      }

      const searchQuery = searchQueryMatch[1];
      
      // Determine download type from quoted message
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
        // Original format with "a" or "v" suffix
        const match = userInput.match(/^(\d+)([av]?)$/);
        if (match) {
          selectedIndex = parseInt(match[1]) - 1;
          action = match[2] || "info";
        }
      }

      if (selectedIndex === -1) {
        return reply("❌ Invalid format! Please reply with a number (1-5) as shown in the instructions.");
      }

      if (selectedIndex < 0 || selectedIndex >= 5) {
        return reply("❌ Invalid selection! Please choose a number between 1-5.");
      }

      await reply("🔍 Processing your selection...");

      // Search again to get video details
      const searchResults = await yts(searchQuery);
      
      if (!searchResults.videos || searchResults.videos.length <= selectedIndex) {
        return reply("❌ Selected video not found. Please try again.");
      }

      const video = searchResults.videos[selectedIndex];
      const videoUrl = video.url;
      const videoTitle = video.title;
      const videoDuration = video.duration.timestamp;
      const videoViews = video.views;
      const videoAuthor = video.author.name;

      // If just info requested
      if (action === "info") {
        const infoText = `🎵 *${videoTitle}*\n\n` +
                        `👤 Author: ${videoAuthor}\n` +
                        `⏱️ Duration: ${videoDuration}\n` +
                        `👁️ Views: ${videoViews}\n` +
                        `🔗 URL: ${videoUrl}\n\n` +
                        `📝 Reply with "${selectedIndex + 1}a" for audio or "${selectedIndex + 1}v" for video.`;
        return reply(infoText);
      }

      // Check video duration (limit to 10 minutes for performance)
      const durationInSeconds = video.duration.seconds;
      if (durationInSeconds > 600) {
        return reply("❌ Video is too long! Maximum duration allowed is 10 minutes.");
      }

      // Validate video URL
      const isValidURL = validateYouTubeURL(videoUrl);

      if (!isValidURL) {
        return reply("❌ Invalid video URL! Please try another video.");
      }

      await reply("📥 Downloading: " + videoTitle);

      // Use local tmp directory for downloads
      const tmpDir = path.join(__dirname, "tmp");
      ensureDir(tmpDir);

      // Generate filename
      const sanitizedTitle = sanitizeFilename(videoTitle);
      const fileExtension = action === "a" ? "m4a" : "mp4";
      const filename = `${sanitizedTitle}.${fileExtension}`;
      const filepath = path.join(tmpDir, filename);

      if (action === "a") {
        // Download audio only
        try {
          const downloadMethod = await downloadWithYoutubeDL(videoUrl, filepath, "audio");
          console.log(`Audio downloaded successfully using ${downloadMethod}`);
          
          // Validate audio file
          if (!validateMediaFile(filepath, "audio")) {
            cleanupFile(filepath);
            return reply("❌ Downloaded audio file is invalid or corrupted. Please try another video.");
          }
          
          // Send audio file using GoatBot V2 style
          try {
            const audioStream = await getStreamFromURL(filepath);
            if (audioStream) {
              await message.reply({
                body: `🎵 *${videoTitle}*\n\n👤 Author: ${videoAuthor}\n⏱️ Duration: ${videoDuration}\n👁️ Views: ${videoViews}\n\n📥 Downloaded by @anbuinfosec Bot`,
                attachment: audioStream
              });
            } else {
              reply("❌ Error sending audio file. File might be too large or corrupted.");
            }
          } catch (error) {
            console.error("Error sending audio with GoatBot V2 style:", error);
            reply("❌ Error sending audio file. File might be too large or corrupted.");
          }

          // Clean up file
          cleanupFile(filepath);
          
        } catch (downloadError) {
          console.log("Download failed:", downloadError);
          
          // Specific error handling for different types of errors
          if (downloadError.message?.includes("no such option")) {
            reply("❌ YouTube downloader needs to be updated. Please contact admin.");
          } else if (downloadError.message?.includes("Private video")) {
            reply("❌ This video is private and cannot be downloaded.");
          } else if (downloadError.message?.includes("Video unavailable")) {
            reply("❌ This video is no longer available on YouTube.");
          } else if (downloadError.message?.includes("Age-restricted")) {
            reply("❌ This video is age-restricted and cannot be downloaded.");
          } else if (downloadError.message?.includes("empty")) {
            reply("❌ Downloaded file is empty. This video might be unavailable or restricted.");
          } else {
            reply("❌ Error downloading audio. This video might be unavailable or restricted. Please try another video.");
          }
        }

      } else if (action === "v") {
        // Download video
        try {
          const downloadMethod = await downloadWithYoutubeDL(videoUrl, filepath, "video");
          console.log(`Video downloaded successfully using ${downloadMethod}`);
          
          // Validate video file
          if (!validateMediaFile(filepath, "video")) {
            cleanupFile(filepath);
            return reply("❌ Downloaded video file is invalid or corrupted. Please try another video.");
          }
          
          // Check file size (limit to 25MB for WhatsApp)
          if (!isWithinSizeLimit(filepath, 25)) {
            cleanupFile(filepath);
            return reply("❌ Video file is too large! Maximum size allowed is 25MB.");
          }

          // Send video file using GoatBot V2 style
          try {
            const videoStream = await getStreamFromURL(filepath);
            if (videoStream) {
              await message.reply({
                body: `🎥 *${videoTitle}*\n\n👤 Author: ${videoAuthor}\n⏱️ Duration: ${videoDuration}\n👁️ Views: ${videoViews}\n\n📥 Downloaded by @anbuinfosec Bot`,
                attachment: videoStream
              });
            } else {
              reply("❌ Error sending video file. File might be too large or corrupted.");
            }
          } catch (error) {
            console.error("Error sending video with GoatBot V2 style:", error);
            reply("❌ Error sending video file. File might be too large or corrupted.");
          }

          if (false) {
            reply("❌ Error sending video file. File might be too large or corrupted.");
          }

          // Clean up file
          cleanupFile(filepath);
          
        } catch (downloadError) {
          console.log("Download failed:", downloadError);
          
          // Specific error handling for different types of errors
          if (downloadError.message?.includes("no such option")) {
            reply("❌ YouTube downloader needs to be updated. Please contact admin.");
          } else if (downloadError.message?.includes("Private video")) {
            reply("❌ This video is private and cannot be downloaded.");
          } else if (downloadError.message?.includes("Video unavailable")) {
            reply("❌ This video is no longer available on YouTube.");
          } else if (downloadError.message?.includes("Age-restricted")) {
            reply("❌ This video is age-restricted and cannot be downloaded.");
          } else if (downloadError.message?.includes("empty")) {
            reply("❌ Downloaded file is empty. This video might be unavailable or restricted.");
          } else {
            reply("❌ Error downloading video. This video might be unavailable or restricted. Please try another video.");
          }
        }
      }

    } catch (error) {
      console.error("YouTube downloader reply error:", error);
      reply("❌ An error occurred while processing your selection. Please try again.");
    }
  },
};
