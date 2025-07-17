/**
 * Sleeps for a specified amount of time.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Get user name from various sources
 * @param {string} userId - The user ID
 * @param {Object} message - The message object (optional)
 * @param {Object} api - The WhatsApp API instance (optional)
 * @returns {Promise<string>} - The user's name
 */
async function getUserName(userId, message = null, api = null) {
  try {
    // Try to get from database first
    const DataUtils = require("./dataUtils");
    const userData = await DataUtils.getUser(userId);
    
    if (userData && userData.name && userData.name !== 'Unknown') {
      return userData.name;
    }
    
    // If message is provided, try to get from message context
    if (message) {
      // Check if it's the message sender
      const senderId = getUserId(message);
      if (senderId === userId && message.pushName) {
        // Update database with the name
        await DataUtils.updateUser(userId, { name: message.pushName });
        return message.pushName;
      }
      
      // Check mentioned users in the message
      const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mentionedJid && mentionedJid.includes(userId)) {
        // Try to get from group participant info if available
        const threadId = getThreadId(message);
        if (threadId.endsWith("@g.us") && api) {
          try {
            const groupMetadata = await api.groupMetadata(threadId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            if (participant && participant.notify) {
              // Update database with the name
              await DataUtils.updateUser(userId, { name: participant.notify });
              return participant.notify;
            }
          } catch (error) {
            console.error('Error getting group metadata:', error);
          }
        }
      }
    }
    
    // If API is provided, try to get from WhatsApp directly
    if (api) {
      try {
        const contactInfo = await api.onWhatsApp(userId);
        if (contactInfo && contactInfo.length > 0) {
          const contact = contactInfo[0];
          if (contact.notify) {
            // Update database with the name
            await DataUtils.updateUser(userId, { name: contact.notify });
            return contact.notify;
          }
        }
      } catch (error) {
        console.error('Error getting contact info from API:', error);
      }
    }
    
    // Extract name from phone number as last resort
    const phoneNumber = userId.replace(/@.*$/, '');
    if (phoneNumber && phoneNumber.length > 5) {
      const fallbackName = `User ${phoneNumber.slice(-4)}`;
      return fallbackName;
    }
    
    return 'Unknown';
  } catch (error) {
    console.error('Error getting user name:', error);
    return 'Unknown';
  }
}

/**
 * Check if a user is an admin
 * @param {string} userId - The user ID to check
 * @param {Object} config - The bot configuration
 * @returns {boolean} - True if user is admin
 */
function isAdmin(userId, config) {
  if (!userId || !config || !config.admins) return false;
  
  // Normalize user ID (remove @lid and @s.whatsapp.net suffixes for comparison)
  const normalizedUserId = userId.replace(/@(lid|s\.whatsapp\.net)$/, '');
  
  return config.admins.some(adminId => {
    const normalizedAdminId = adminId.replace(/@(lid|s\.whatsapp\.net)$/, '');
    return normalizedAdminId === normalizedUserId || adminId === userId;
  });
}

/**
 * Check if a user is a group admin
 * @param {string} userId - The user ID to check
 * @param {Object} threadData - The thread data
 * @returns {boolean} - True if user is group admin
 */
function isGroupAdmin(userId, threadData) {
  if (!userId || !threadData || !threadData.admins) return false;
  return threadData.admins.includes(userId);
}

/**
 * Get user ID from message
 * @param {Object} message - The message object
 * @returns {string} - The sender's user ID
 */
function getUserId(message) {
  return message.key.participant || message.key.remoteJid;
}

/**
 * Get thread ID from message
 * @param {Object} message - The message object
 * @returns {string} - The thread ID
 */
function getThreadId(message) {
  return message.key.remoteJid;
}

/**
 * Check if message is from a group
 * @param {Object} message - The message object
 * @returns {boolean} - True if from group
 */
function isGroupMessage(message) {
  return message.key.remoteJid.endsWith("@g.us");
}

/**
 * Format phone number to WhatsApp ID
 * @param {string} phoneNumber - The phone number
 * @returns {string} - The WhatsApp ID
 */
function formatPhoneToWhatsAppId(phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Extract mentioned users from message
 * @param {Object} message - The message object
 * @returns {Array} - Array of mentioned user IDs
 */
function getMentions(message) {
  return message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

/**
 * Format uptime duration
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration string
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

module.exports = {
  sleep,
  isAdmin,
  isGroupAdmin,
  getUserId,
  getUserName,
  getThreadId,
  isGroupMessage,
  formatPhoneToWhatsAppId,
  getMentions,
  formatUptime
}
