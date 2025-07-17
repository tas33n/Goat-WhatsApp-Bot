const { getStreamFromURL, sendAttachmentWithText, sendMultipleAttachments } = require("../utils/utils");

class APIWrapper {
  constructor(sock, config, logger) {
    this.sock = sock;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Send a message to a specific thread
   * @param {string} threadID - Thread ID to send message to
   * @param {string|object} content - Message content
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async sendMessage(threadID, content, options = {}) {
    try {
      let messageContent = {};
      
      if (typeof content === 'string') {
        messageContent.text = content;
      } else if (typeof content === 'object' && content.body) {
        // GoatBot V2 style message object
        messageContent.text = content.body;
        
        // Handle attachments
        if (content.attachment) {
          return await this.sendMessageWithAttachment(threadID, content.body, content.attachment, options);
        }
      } else if (typeof content === 'object') {
        messageContent = { ...content };
      }

      // Apply additional options
      if (options.quoted) {
        messageContent.quoted = options.quoted;
      }

      const result = await this.sock.sendMessage(threadID, messageContent);
      
      if (this.config.logMessages) {
        this.logger.info(`📤 API message sent to ${threadID}: "${messageContent.text || 'Media message'}"`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.sendMessage:", error);
      throw error;
    }
  }

  /**
   * Send message with attachment(s)
   * @param {string} threadID - Thread ID
   * @param {string} text - Text content
   * @param {string|Array} attachment - Single attachment or array of attachments
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async sendMessageWithAttachment(threadID, text, attachment, options = {}) {
    try {
      if (Array.isArray(attachment)) {
        // Multiple attachments
        const attachmentStreams = [];
        
        for (const att of attachment) {
          try {
            const stream = await getStreamFromURL(att);
            if (stream) {
              attachmentStreams.push(stream);
            }
          } catch (error) {
            this.logger.error(`Error getting stream for attachment ${att}:`, error);
          }
        }
        
        if (attachmentStreams.length > 0) {
          // Send text first if provided
          if (text) {
            const textMessage = { text: text };
            if (options.quoted) {
              textMessage.quoted = options.quoted;
            }
            await this.sock.sendMessage(threadID, textMessage);
          }
          
          // Send attachments
          for (const stream of attachmentStreams) {
            const attachmentMessage = { image: stream };
            if (options.quoted && !text) {
              attachmentMessage.quoted = options.quoted;
            }
            await this.sock.sendMessage(threadID, attachmentMessage);
            
            // Small delay between attachments
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          return { success: true, count: attachmentStreams.length };
        } else {
          // Fallback to text only
          const messageContent = { text: text || "❌ Failed to process attachments" };
          if (options.quoted) {
            messageContent.quoted = options.quoted;
          }
          return await this.sock.sendMessage(threadID, messageContent);
        }
      } else {
        // Single attachment
        try {
          const stream = await getStreamFromURL(attachment);
          
          if (stream) {
            const messageContent = {
              image: stream,
              caption: text || undefined
            };
            
            if (options.quoted) {
              messageContent.quoted = options.quoted;
            }
            
            return await this.sock.sendMessage(threadID, messageContent);
          } else {
            // Fallback to text only
            const messageContent = { text: text || "❌ Failed to process attachment" };
            if (options.quoted) {
              messageContent.quoted = options.quoted;
            }
            return await this.sock.sendMessage(threadID, messageContent);
          }
        } catch (error) {
          this.logger.error("Error sending single attachment:", error);
          // Fallback to text only
          const messageContent = { text: text || "❌ Failed to process attachment" };
          if (options.quoted) {
            messageContent.quoted = options.quoted;
          }
          return await this.sock.sendMessage(threadID, messageContent);
        }
      }
    } catch (error) {
      this.logger.error("Error in sendMessageWithAttachment:", error);
      throw error;
    }
  }

  /**
   * React to a message
   * @param {string} threadID - Thread ID
   * @param {string} emoji - Emoji to react with
   * @param {object} messageKey - Message key to react to
   * @returns {Promise<object>} - Reaction result
   */
  async react(threadID, emoji, messageKey) {
    try {
      const result = await this.sock.sendMessage(threadID, {
        react: { 
          text: emoji, 
          key: messageKey 
        }
      });
      
      if (this.config.logMessages) {
        this.logger.info(`👍 API reaction sent: ${emoji} to message ${messageKey.id}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.react:", error);
      throw error;
    }
  }

  /**
   * Delete/unsend a message
   * @param {string} threadID - Thread ID
   * @param {object} messageKey - Message key to delete
   * @returns {Promise<object>} - Delete result
   */
  async unsendMessage(threadID, messageKey) {
    try {
      const result = await this.sock.sendMessage(threadID, {
        delete: messageKey
      });
      
      if (this.config.logMessages) {
        this.logger.info(`🗑️ API message deleted: ${messageKey.id}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.unsendMessage:", error);
      throw error;
    }
  }

  /**
   * Edit a message
   * @param {string} threadID - Thread ID
   * @param {string} newText - New text content
   * @param {object} messageKey - Message key to edit
   * @returns {Promise<object>} - Edit result
   */
  async editMessage(threadID, newText, messageKey) {
    try {
      const result = await this.sock.sendMessage(threadID, {
        text: newText,
        edit: messageKey
      });
      
      if (this.config.logMessages) {
        this.logger.info(`✏️ API message edited: ${messageKey.id}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.editMessage:", error);
      throw error;
    }
  }

  /**
   * Send typing indicator
   * @param {string} threadID - Thread ID
   * @returns {Promise<void>}
   */
  async sendTyping(threadID) {
    try {
      await this.sock.sendPresenceUpdate('composing', threadID);
    } catch (error) {
      this.logger.error("Error in api.sendTyping:", error);
    }
  }

  /**
   * Send recording indicator
   * @param {string} threadID - Thread ID
   * @returns {Promise<void>}
   */
  async sendRecording(threadID) {
    try {
      await this.sock.sendPresenceUpdate('recording', threadID);
    } catch (error) {
      this.logger.error("Error in api.sendRecording:", error);
    }
  }

  /**
   * Mark messages as read
   * @param {string} threadID - Thread ID
   * @param {Array} messageKeys - Array of message keys to mark as read
   * @returns {Promise<void>}
   */
  async markAsRead(threadID, messageKeys) {
    try {
      await this.sock.readMessages(messageKeys);
      
      if (this.config.logMessages) {
        this.logger.info(`👁️ API messages marked as read: ${messageKeys.length} messages`);
      }
    } catch (error) {
      this.logger.error("Error in api.markAsRead:", error);
    }
  }

  /**
   * Get group metadata
   * @param {string} groupID - Group ID
   * @returns {Promise<object>} - Group metadata
   */
  async getGroupMetadata(groupID) {
    try {
      const metadata = await this.sock.groupMetadata(groupID);
      return metadata;
    } catch (error) {
      this.logger.error("Error in api.getGroupMetadata:", error);
      throw error;
    }
  }

  /**
   * Update group participants
   * @param {string} groupID - Group ID
   * @param {Array} participants - Array of participant IDs
   * @param {string} action - Action (add, remove, promote, demote)
   * @returns {Promise<object>} - Update result
   */
  async updateGroupParticipants(groupID, participants, action) {
    try {
      const result = await this.sock.groupParticipantsUpdate(groupID, participants, action);
      
      if (this.config.logMessages) {
        this.logger.info(`👥 API group participants updated: ${action} for ${participants.length} users`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.updateGroupParticipants:", error);
      throw error;
    }
  }

  /**
   * Update group settings
   * @param {string} groupID - Group ID
   * @param {string} setting - Setting to update (announcement, locked, etc.)
   * @returns {Promise<object>} - Update result
   */
  async updateGroupSettings(groupID, setting) {
    try {
      const result = await this.sock.groupSettingUpdate(groupID, setting);
      
      if (this.config.logMessages) {
        this.logger.info(`⚙️ API group settings updated: ${setting} for ${groupID}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.updateGroupSettings:", error);
      throw error;
    }
  }

  /**
   * Send image message
   * @param {string} threadID - Thread ID
   * @param {string} imageUrl - Image URL
   * @param {string} caption - Caption text
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async sendImage(threadID, imageUrl, caption = "", options = {}) {
    try {
      const stream = await getStreamFromURL(imageUrl);
      
      if (!stream) {
        throw new Error("Failed to get image stream");
      }
      
      const messageContent = {
        image: stream,
        caption: caption || undefined
      };
      
      if (options.quoted) {
        messageContent.quoted = options.quoted;
      }
      
      const result = await this.sock.sendMessage(threadID, messageContent);
      
      if (this.config.logMessages) {
        this.logger.info(`📷 API image sent to ${threadID}: "${caption || 'No caption'}"`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.sendImage:", error);
      throw error;
    }
  }

  /**
   * Send video message
   * @param {string} threadID - Thread ID
   * @param {string} videoUrl - Video URL
   * @param {string} caption - Caption text
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async sendVideo(threadID, videoUrl, caption = "", options = {}) {
    try {
      const stream = await getStreamFromURL(videoUrl);
      
      if (!stream) {
        throw new Error("Failed to get video stream");
      }
      
      const messageContent = {
        video: stream,
        caption: caption || undefined
      };
      
      if (options.quoted) {
        messageContent.quoted = options.quoted;
      }
      
      const result = await this.sock.sendMessage(threadID, messageContent);
      
      if (this.config.logMessages) {
        this.logger.info(`📹 API video sent to ${threadID}: "${caption || 'No caption'}"`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.sendVideo:", error);
      throw error;
    }
  }

  /**
   * Send audio message
   * @param {string} threadID - Thread ID
   * @param {string} audioUrl - Audio URL
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async sendAudio(threadID, audioUrl, options = {}) {
    try {
      const stream = await getStreamFromURL(audioUrl);
      
      if (!stream) {
        throw new Error("Failed to get audio stream");
      }
      
      const messageContent = {
        audio: stream,
        mimetype: 'audio/mpeg'
      };
      
      if (options.quoted) {
        messageContent.quoted = options.quoted;
      }
      
      const result = await this.sock.sendMessage(threadID, messageContent);
      
      if (this.config.logMessages) {
        this.logger.info(`🎵 API audio sent to ${threadID}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.sendAudio:", error);
      throw error;
    }
  }

  /**
   * Send document message
   * @param {string} threadID - Thread ID
   * @param {string} documentUrl - Document URL
   * @param {string} fileName - File name
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async sendDocument(threadID, documentUrl, fileName, options = {}) {
    try {
      const stream = await getStreamFromURL(documentUrl);
      
      if (!stream) {
        throw new Error("Failed to get document stream");
      }
      
      const messageContent = {
        document: stream,
        fileName: fileName || 'document',
        mimetype: 'application/octet-stream'
      };
      
      if (options.quoted) {
        messageContent.quoted = options.quoted;
      }
      
      const result = await this.sock.sendMessage(threadID, messageContent);
      
      if (this.config.logMessages) {
        this.logger.info(`📄 API document sent to ${threadID}: "${fileName || 'document'}"`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in api.sendDocument:", error);
      throw error;
    }
  }

  /**
   * Get user info
   * @param {string} userID - User ID
   * @returns {Promise<object>} - User info
   */
  async getUserInfo(userID) {
    try {
      const info = await this.sock.onWhatsApp(userID);
      return info;
    } catch (error) {
      this.logger.error("Error in api.getUserInfo:", error);
      throw error;
    }
  }

  /**
   * Get connection state
   * @returns {object} - Connection state
   */
  getConnectionState() {
    return {
      connection: this.sock.ws?.readyState,
      isConnected: this.sock.ws?.readyState === 1,
      user: this.sock.user
    };
  }
}

module.exports = APIWrapper;
