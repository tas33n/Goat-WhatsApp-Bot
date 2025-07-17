const axios = require("axios");
const fs = require("fs");
const path = require("path");
const youtubedl = require("youtube-dl-exec");
const { logger } = require("../libs/logger");

// Utility function to get extension from MIME type
function getExtFromMimeType(mimeType = "") {
  const mimeDB = require('mime-db');
  if (mimeDB[mimeType] && Array.isArray(mimeDB[mimeType].extensions)) {
    return mimeDB[mimeType].extensions[0] || "unknown";
  }
  return "unknown";
}

// Utility function to generate random string
function randomString(length = 10) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Enhanced getStreamFromURL function with better error handling
async function getStreamFromURL(url = "", pathName = "", options = {}) {
  if (!options && typeof pathName === "object") {
    options = pathName;
    pathName = "";
  }

  // If it's a local file path, return a readable stream
  if (typeof url === "string" && !/^https?:\/\//.test(url) && fs.existsSync(url)) {
    return fs.createReadStream(url);
  }

  // Otherwise, treat as remote URL
  try {
    if (!url || typeof url !== "string" || url.trim() === "") {
      throw new Error(`Invalid URL provided: ${url}`);
    }
    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    const response = await axios({
      url: url.trim(),
      method: "GET",
      responseType: "stream",
      timeout: 15000,
      maxRedirects: 3,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      ...options
    });
    if (!pathName) {
      const contentType = response.headers["content-type"];
      const extension = getExtFromMimeType(contentType) || "jpg";
      pathName = randomString(10) + '.' + extension;
    }
    if (response.data) {
      response.data.path = pathName;
    }
    return response.data;
  } catch (err) {
    logger.error(`Error in getStreamFromURL for ${url}: ${err.message}`);
    throw err;
  }
}

// Enhanced download function with better error handling and format options
async function downloadWithYoutubeDL(videoUrl, filepath, type = "audio") {
  return new Promise(async (resolve, reject) => {
    try {
      logger.info(`Downloading ${type} with youtube-dl-exec...`);
      
      // Use the provided filepath directly (should be in tmp directory)
      const downloadDir = path.dirname(filepath);
      ensureDir(downloadDir);
      
      let ytdlOptions;
      
      if (type === "audio") {
        ytdlOptions = {
          output: filepath,
          format: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
          extractAudio: true,
          audioFormat: 'm4a',
          audioQuality: 0,
          noCheckCertificate: true,
          preferFreeFormats: true,
          addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        };
      } else {
        ytdlOptions = {
          output: filepath,
          format: 'best[height<=480][ext=mp4]/best[ext=mp4]/best',
          noCheckCertificate: true,
          preferFreeFormats: true,
          addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        };
      }
      
      await youtubedl(videoUrl, ytdlOptions);
      logger.info(`youtube-dl-exec download completed: ${filepath}`);
      
      // Verify file exists and has content
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > 0) {
          resolve('youtube-dl-exec');
        } else {
          reject(new Error('Downloaded file is empty'));
        }
      } else {
        reject(new Error('Downloaded file does not exist'));
      }
      
    } catch (error) {
          logger.error(`youtube-dl-exec failed: ${error.message}`);
      reject(error);
    }
  });
}

// Enhanced sendAttachmentWithText function with retry logic
async function sendAttachmentWithText(api, jid, attachmentPath, text, type = "image") {
  const maxRetries = 2;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      logger.info(`Attempting to send ${type} (attempt ${attempt + 1}/${maxRetries}): ${attachmentPath}`);
      
      const messageContent = {
        caption: text
      };
      
      // If it's a URL, use getStreamFromURL
      if (attachmentPath.startsWith('http')) {
        const stream = await getStreamFromURL(attachmentPath);
        
        if (type === "image") {
          messageContent.image = stream;
        } else if (type === "video") {
          messageContent.video = stream;
        } else if (type === "audio") {
          messageContent.audio = stream;
        }
      } else {
        // Local file path
        if (type === "image") {
          messageContent.image = { url: attachmentPath };
        } else if (type === "video") {
          messageContent.video = { url: attachmentPath };
        } else if (type === "audio") {
          messageContent.audio = { url: attachmentPath };
        }
      }
      
      await api.sendMessage(jid, messageContent);
      logger.info(`Successfully sent ${type}`);
      return true;
    } catch (error) {
      logger.error(`Error sending ${type} (attempt ${attempt + 1}): ${error.message}`);
      attempt++;
      
      if (attempt < maxRetries) {
        logger.info(`Retrying in 1 second...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  logger.error(`Failed to send ${type} after ${maxRetries} attempts`);
  return false;
}

// Enhanced sendMultipleAttachments function with improved error handling
async function sendMultipleAttachments(api, jid, attachments, type = "image", text = null) {
  try {
    // Validate inputs
    if (!api || !jid || !attachments) {
      logger.error("Invalid parameters for sendMultipleAttachments");
      if (text) {
        await api.sendMessage(jid, { text: text });
      }
      return false;
    }

    // If attachments are URLs (like thumbnail URLs), send them directly
    if (Array.isArray(attachments) && typeof attachments[0] === 'string') {
      // Filter out empty or invalid URLs
      const validUrls = attachments.filter(url => url && url.trim() && isValidUrl(url));
      
      if (validUrls.length === 0) {
        logger.error("No valid URLs found in attachments");
        if (text) {
          await api.sendMessage(jid, { text: text });
        }
        return false;
      }

      // Try to send text first, then images separately
      try {
        // Send text first
        if (text) {
          await api.sendMessage(jid, { text: text });
        }

        // Send images one by one with proper error handling
        let sentCount = 0;
        const maxImages = Math.min(validUrls.length, 3); // Limit to 3 images to avoid spam
        
        for (let i = 0; i < maxImages; i++) {
          try {
            logger.info(`Attempting to send image ${i + 1}/${maxImages}: ${validUrls[i]}`);
            
            // First try direct URL method (most reliable for images)
            try {
              const messageContent = {
                image: { url: validUrls[i] }
              };
              
              await api.sendMessage(jid, messageContent);
              sentCount++;
              logger.info(`Successfully sent image ${i + 1}/${maxImages}`);
              
              // Delay between messages to avoid rate limiting
              if (i < maxImages - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (directError) {
              logger.error(`Direct URL method failed for image ${i + 1}, trying stream method: ${directError.message}`);
              
              // Try stream method as fallback
              try {
                const stream = await getStreamFromURL(validUrls[i]);
                
                if (stream && stream.readable !== false) {
                  const messageContent = {
                    image: stream
                  };
                  
                  await api.sendMessage(jid, messageContent);
                  sentCount++;
                  logger.info(`Successfully sent image ${i + 1}/${maxImages} using stream method`);
                  
                  // Delay between messages to avoid rate limiting
                  if (i < maxImages - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                } else {
                  logger.error(`Invalid stream for image ${i + 1}: ${validUrls[i]}`);
                }
              } catch (streamError) {
                logger.error(`Stream method also failed for image ${i + 1}: ${streamError.message}`);
              }
            }
          } catch (error) {
            logger.error(`Error sending image ${i + 1}/${maxImages} (${validUrls[i]}): ${error.message}`);
          }
        }

        logger.info(`Successfully sent ${sentCount} images out of ${maxImages}`);
        return sentCount > 0;
        
      } catch (error) {
        logger.error(`Error in sendMultipleAttachments: ${error.message}`);
        // Final fallback to text only
        if (text) {
          try {
            await api.sendMessage(jid, { text: text });
          } catch (textError) {
            logger.error(`Failed to send even text: ${textError.message}`);
          }
        }
        return false;
      }
    }
    
    // Legacy format: send all attachments with individual captions
    let successCount = 0;
    for (const attachment of attachments) {
      const success = await sendAttachmentWithText(api, jid, attachment.path, attachment.caption || "", attachment.type || "image");
      if (success) successCount++;
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Send final text message if provided
    if (text) {
      await api.sendMessage(jid, { text: text });
    }
    
    return successCount > 0;
  } catch (error) {
    logger.error(`Error sending multiple attachments: ${error.message}`);
    return false;
  }
}

// Enhanced download function with fallback
async function downloadWithFallback(videoUrl, filepath, type = "audio") {
  return downloadWithYoutubeDL(videoUrl, filepath, type);
}

// URL validation function for YouTube
function validateYouTubeURL(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return youtubeRegex.test(url);
}

// File system utilities
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getDownloadsDir() {
  const downloadsDir = path.join(process.cwd(), "downloads");
  ensureDir(downloadsDir);
  return downloadsDir;
}

function getTempDir() {
  const tempDir = path.join(process.cwd(), "temp");
  ensureDir(tempDir);
  return tempDir;
}

function cleanupFile(filepath, delay = 5000) {
  setTimeout(() => {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (e) {
      console.log("Error deleting file:", e);
    }
  }, delay);
}

function sanitizeFilename(filename, maxLength = 50) {
  return filename.replace(/[^a-zA-Z0-9]/g, "_").substring(0, maxLength);
}

// Text formatting utilities
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Validation utilities
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Enhanced file size validation function
function isWithinSizeLimit(filepath, limitMB = 25) {
  try {
    const stats = fs.statSync(filepath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    logger.info(`File size: ${fileSizeInMB.toFixed(2)} MB (limit: ${limitMB} MB)`);
    return fileSizeInMB <= limitMB;
  } catch (error) {
    console.log("Error checking file size:", error.message);
    return false;
  }
}

// Enhanced media validation function
function validateMediaFile(filepath, type = "image") {
  try {
    if (!fs.existsSync(filepath)) {
      logger.error(`File does not exist: ${filepath}`);
      return false;
    }

    const stats = fs.statSync(filepath);
    if (stats.size === 0) {
      logger.error(`File is empty: ${filepath}`);
      return false;
    }

    // Check file size limits based on type
    let sizeLimit;
    switch (type) {
      case "image":
        sizeLimit = 5; // 5MB for images
        break;
      case "video":
        sizeLimit = 25; // 25MB for videos
        break;
      case "audio":
        sizeLimit = 10; // 10MB for audio
        break;
      default:
        sizeLimit = 25; // Default limit
    }

    const fileSizeInMB = stats.size / (1024 * 1024);
    if (fileSizeInMB > sizeLimit) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Enhanced cleanup function with better error handling
// ...existing code...

module.exports = {
  getExtFromMimeType,
  randomString,
  getStreamFromURL,
  sendAttachmentWithText,
  sendMultipleAttachments,
  downloadWithFallback,
  downloadWithYoutubeDL,
  validateYouTubeURL,
  ensureDir,
  getDownloadsDir,
  getTempDir,
  cleanupFile,
  sanitizeFilename,
  formatFileSize,
  formatDuration,
  isValidUrl,
  isWithinSizeLimit,
  validateMediaFile
};
