const db = require("../database/manager");

/**
 * Data utilities for user, thread, and message management
 */
class DataUtils {
  /**
   * Get user data with default values
   * @param {string} userId - User ID
   * @returns {Object} User data object
   */
  static async getUser(userId) {
    try {
      const userData = await db.getUserData(userId);
      
      // Default user data structure
      const defaultUser = {
        id: userId,
        name: 'Unknown',
        messageCount: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        isGroup: false,
        banned: false,
        warnings: 0,
        experience: 0,
        level: 1,
        currency: 0,
        inventory: {},
        settings: {
          language: 'en',
          notifications: true
        }
      };
      
      // Merge with retrieved data, ensuring all fields are present
      return userData ? { ...defaultUser, ...userData } : defaultUser;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  /**
   * Update user data
   * @param {string} userId - User ID
   * @param {Object} updates - Object with fields to update
   * @returns {boolean} Success status
   */
  static async updateUser(userId, updates) {
    try {
      const userData = await this.getUser(userId);
      if (!userData) return false;

      const updatedData = { ...userData, ...updates };
      await db.setUserData(userId, updatedData);
      return true;
    } catch (error) {
      console.error('Error updating user data:', error);
      return false;
    }
  }

  /**
   * Get all users from the database
   * @returns {Array} Array of user objects
   */
  static async getAllUsers() {
    try {
      const allUsers = await db.getAllUsers();
      return allUsers || [];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Get thread/group data with default values
   * @param {string} threadId - Thread ID
   * @returns {Object} Thread data object
   */
  static async getThread(threadId) {
    try {
      const threadData = await db.getThreadData(threadId);
      const isGroup = threadId.endsWith("@g.us");
      
      // Default thread data structure
      const defaultThreadData = {
        id: threadId,
        isGroup: isGroup,
        name: isGroup ? 'Unknown Group' : 'Private Chat',
        messageCount: 0,
        firstActivity: Date.now(),
        lastActivity: Date.now(),
        participants: [],
        settings: {
          welcomeMessage: true,
          antiSpam: false,
          adminOnly: false,
          language: 'en'
        },
        admins: [],
        banned: false,
        warnings: 0
      };

      // If no thread data exists, return default
      if (!threadData) {
        return defaultThreadData;
      }

      // Ensure settings object exists
      if (!threadData.settings) {
        threadData.settings = defaultThreadData.settings;
      }

      // Ensure all required settings exist
      if (threadData.settings.adminOnly === undefined) {
        threadData.settings.adminOnly = false;
      }

      return threadData;
    } catch (error) {
      console.error('Error getting thread data:', error);
      // Return default thread data instead of null
      return {
        id: threadId,
        isGroup: threadId.endsWith("@g.us"),
        name: threadId.endsWith("@g.us") ? 'Unknown Group' : 'Private Chat',
        messageCount: 0,
        firstActivity: Date.now(),
        lastActivity: Date.now(),
        participants: [],
        settings: {
          welcomeMessage: true,
          antiSpam: false,
          adminOnly: false,
          language: 'en'
        },
        admins: [],
        banned: false,
        warnings: 0
      };
    }
  }

  /**
   * Update thread data
   * @param {string} threadId - Thread ID
   * @param {Object} updates - Object with fields to update
   * @returns {boolean} Success status
   */
  static async updateThread(threadId, updates) {
    try {
      const threadData = await this.getThread(threadId);
      if (!threadData) return false;

      const updatedData = { ...threadData, ...updates };
      await db.setThreadData(threadId, updatedData);
      return true;
    } catch (error) {
      console.error('Error updating thread data:', error);
      return false;
    }
  }

  /**
   * Get recent messages from a thread
   * @param {string} threadId - Thread ID
   * @param {number} limit - Maximum number of messages to return
   * @returns {Array} Array of message objects
   */
  static async getRecentMessages(threadId, limit = 50) {
    try {
      const messageIds = await db.getThreadMessages(threadId);
      const recentIds = messageIds.slice(-limit);
      
      const messages = [];
      for (const messageId of recentIds) {
        const messageData = await db.getMessageData(messageId);
        if (messageData) {
          messages.push(messageData);
        }
      }
      
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Add experience points to a user
   * @param {string} userId - User ID
   * @param {number} exp - Experience points to add
   * @returns {Object} Updated user data with level information
   */
  static async addExperience(userId, exp = 1) {
    try {
      const userData = await this.getUser(userId);
      if (!userData) return null;

      userData.experience += exp;
      
      // Calculate level (simple formula: level = floor(sqrt(exp / 100)))
      const newLevel = Math.floor(Math.sqrt(userData.experience / 100)) + 1;
      const levelUp = newLevel > userData.level;
      
      userData.level = newLevel;
      
      await db.setUserData(userId, userData);
      
      return {
        ...userData,
        levelUp: levelUp,
        expGained: exp
      };
    } catch (error) {
      console.error('Error adding experience:', error);
      return null;
    }
  }

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {Object} User statistics
   */
  static async getUserStats(userId) {
    try {
      const userData = await this.getUser(userId);
      if (!userData) return null;

      const totalTime = Date.now() - userData.firstSeen;
      const daysActive = Math.floor(totalTime / (1000 * 60 * 60 * 24));
      
      return {
        messageCount: userData.messageCount,
        level: userData.level,
        experience: userData.experience,
        daysActive: daysActive,
        currency: userData.currency,
        warnings: userData.warnings,
        banned: userData.banned,
        lastSeen: userData.lastSeen,
        firstSeen: userData.firstSeen
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  /**
   * Get global bot statistics
   * @returns {Object} Global statistics
   */
  static async getGlobalStats() {
    try {
      const allUsers = await db.getAllUsers();
      const allThreads = await db.getAllThreads();
      
      const userCount = Object.keys(allUsers).length;
      const threadCount = Object.keys(allThreads).length;
      
      let totalMessages = 0;
      let groupCount = 0;
      
      for (const threadData of Object.values(allThreads)) {
        totalMessages += threadData.messageCount || 0;
        if (threadData.isGroup) groupCount++;
      }
      
      return {
        userCount: userCount,
        threadCount: threadCount,
        groupCount: groupCount,
        privateChats: threadCount - groupCount,
        totalMessages: totalMessages,
        uptime: Date.now() - global.GoatBot.startTime
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return null;
    }
  }

  /**
   * Clean old message data (keep only recent messages)
   * @param {number} daysToKeep - Number of days to keep messages
   * @returns {boolean} Success status
   */
  static async cleanOldMessages(daysToKeep = 30) {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const allKeys = await db.getAllKeys();
      
      let deletedCount = 0;
      
      for (const key of allKeys) {
        if (key.startsWith('message_')) {
          const messageData = await db.get(key);
          if (messageData && messageData.timestamp < cutoffTime) {
            await db.delete(key);
            deletedCount++;
          }
        }
      }
      
      console.log(`Cleaned ${deletedCount} old messages`);
      return true;
    } catch (error) {
      console.error('Error cleaning old messages:', error);
      return false;
    }
  }

  /**
   * Backup user data
   * @returns {Object} Backup data
   */
  static async backupUserData() {
    try {
      const allUsers = await db.getAllUsers();
      const allThreads = await db.getAllThreads();
      
      return {
        users: allUsers,
        threads: allThreads,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error backing up user data:', error);
      return null;
    }
  }
}

module.exports = DataUtils;
