const { getStreamFromURL, sendAttachmentWithText, sendMultipleAttachments } = require("../utils/utils");

class MessageWrapper {
  constructor(sock, msg, config, logger) {
    this.sock = sock;
    this.msg = msg;
    this.config = config;
    this.logger = logger;
    this.threadID = msg.key.remoteJid;
    this.messageID = msg.key.id;
    this.senderID = msg.key.participant || msg.key.remoteJid;
    this.isGroup = msg.key.remoteJid.endsWith('@g.us');
    
    // Extract message body
    this.body = msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                "";
  }

  /**
   * Send a message to the current thread
   * @param {string|object} content - Text content or message object
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async send(content, options = {}) {
    try {
      let messageContent = {};
      
      if (typeof content === 'string') {
        messageContent.text = content;
      } else if (typeof content === 'object' && content.body) {
        // GoatBot V2 style message object
        messageContent.text = content.body;
        
        // Handle attachments
        if (content.attachment) {
          return await this.sendWithAttachment(content.body, content.attachment, options);
        }
      } else if (typeof content === 'object') {
        messageContent = { ...content };
      }

      // Apply additional options
      if (options.quoted !== false && !options.noQuote) {
        messageContent.quoted = this.msg;
      }

      const result = await this.sock.sendMessage(this.threadID, messageContent);
      
      if (this.config.logMessages) {
        this.logger.info(`📤 Message sent to ${this.threadID}: "${messageContent.text || 'Media message'}"`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in message.send:", error);
      throw error;
    }
  }

  /**
   * Reply to the current message
   * @param {string|object} content - Text content or message object
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async reply(content, options = {}) {
    try {
      let messageContent = {};
      
      if (typeof content === 'string') {
        messageContent.text = content;
      } else if (typeof content === 'object' && content.body) {
        // GoatBot V2 style message object
        messageContent.text = content.body;
        
        // Handle attachments
        if (content.attachment) {
          return await this.sendWithAttachment(content.body, content.attachment, { quoted: this.msg, ...options });
        }
      } else if (typeof content === 'object') {
        messageContent = { ...content };
      }

      // Always quote the original message in replies
      messageContent.quoted = this.msg;

      const result = await this.sock.sendMessage(this.threadID, messageContent);
      
      if (this.config.logMessages) {
        this.logger.info(`📤 Reply sent to ${this.threadID}: "${messageContent.text || 'Media message'}"`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in message.reply:", error);
      throw error;
    }
  }

  /**
   * Send message with attachment(s)
   * @param {string} text - Text content
   * @param {string|Array} attachment - Single attachment or array of attachments
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Sent message info
   */
  async sendWithAttachment(text, attachment, options = {}) {
    try {
      // Helper to detect type
      const detectType = (att) => {
        if (typeof att === 'string') {
          const ext = att.split('.').pop().toLowerCase();
          if (/^https?:\/\//.test(att)) {
            if (ext.match(/(jpg|jpeg|png|gif|webp)$/)) return 'image';
            if (ext.match(/(mp4|mkv|mov|webm)$/)) return 'video';
            if (ext.match(/(mp3|m4a|ogg|wav)$/)) return 'audio';
            if (ext.match(/(pdf|doc|docx|xls|xlsx|ppt|pptx)$/)) return 'document';
          } else {
            if (ext.match(/(jpg|jpeg|png|gif|webp)$/)) return 'image';
            if (ext.match(/(mp4|mkv|mov|webm)$/)) return 'video';
            if (ext.match(/(mp3|m4a|ogg|wav)$/)) return 'audio';
            if (ext.match(/(pdf|doc|docx|xls|xlsx|ppt|pptx)$/)) return 'document';
          }
        }
        // If it's a stream, fallback to image unless specified
        return 'image';
      };

      if (Array.isArray(attachment)) {
        // Multiple attachments
        const attachmentData = [];
        for (const att of attachment) {
          try {
            let type = detectType(att);
            let obj;
            if (typeof att === 'string') {
              if (/^https?:\/\//.test(att)) {
                obj = { url: att };
              } else {
                const fs = require('fs');
                obj = fs.existsSync(att) ? fs.createReadStream(att) : { url: att };
              }
            } else if (att && typeof att === 'object' && att.readable !== undefined) {
              obj = att;
            } else {
              this.logger.error(`Invalid attachment type: ${typeof att}`, att);
              continue;
            }
            attachmentData.push({ type, obj });
          } catch (error) {
            this.logger.error(`Error processing attachment ${att}:`, error);
          }
        }
        if (attachmentData.length > 0) {
          if (text) {
            const textMessage = { text: text };
            if (options.quoted) textMessage.quoted = options.quoted;
            await this.sock.sendMessage(this.threadID, textMessage);
          }
          for (const { type, obj } of attachmentData) {
            const attachmentMessage = {};
            attachmentMessage[type] = obj;
            if (options.quoted && !text) attachmentMessage.quoted = options.quoted;
            await this.sock.sendMessage(this.threadID, attachmentMessage);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return { success: true, count: attachmentData.length };
        } else {
          const messageContent = { text: text || "❌ Failed to process attachments" };
          if (options.quoted) messageContent.quoted = options.quoted;
          return await this.sock.sendMessage(this.threadID, messageContent);
        }
      } else {
        // Single attachment
        try {
          let type = detectType(attachment);
          let obj;
          if (typeof attachment === 'string') {
            if (/^https?:\/\//.test(attachment)) {
              obj = { url: attachment };
            } else {
              const fs = require('fs');
              if (fs.existsSync(attachment)) {
                try {
                  obj = fs.createReadStream(attachment);
                  // Extra validation for readable stream
                  if (!obj || typeof obj.pipe !== 'function' || typeof obj.read !== 'function') {
                    this.logger.error(`Attachment stream is not a valid readable stream for file: ${attachment}`);
                    const messageContent = { text: text || `❌ Invalid stream for file: ${attachment}` };
                    if (options.quoted) messageContent.quoted = options.quoted;
                    return await this.sock.sendMessage(this.threadID, messageContent);
                  }
                } catch (streamErr) {
                  this.logger.error(`Failed to create stream for file: ${attachment}`, streamErr);
                  const messageContent = { text: text || `❌ Failed to read file: ${attachment}` };
                  if (options.quoted) messageContent.quoted = options.quoted;
                  return await this.sock.sendMessage(this.threadID, messageContent);
                }
              } else {
                this.logger.error(`File does not exist: ${attachment}`);
                const messageContent = { text: text || `❌ File not found: ${attachment}` };
                if (options.quoted) messageContent.quoted = options.quoted;
                return await this.sock.sendMessage(this.threadID, messageContent);
              }
            }
          } else if (attachment && typeof attachment === 'object' && attachment.readable !== undefined) {
            // Validate readable stream object
            if (typeof attachment.pipe !== 'function' || typeof attachment.read !== 'function') {
              this.logger.error(`Provided stream object is not a valid readable stream`, attachment);
              const messageContent = { text: text || "❌ Invalid stream object for attachment" };
              if (options.quoted) messageContent.quoted = options.quoted;
              return await this.sock.sendMessage(this.threadID, messageContent);
            }
            obj = attachment;
          } else {
            this.logger.error(`Invalid attachment type: ${typeof attachment}`, attachment);
            const messageContent = { text: text || "❌ Invalid attachment type" };
            if (options.quoted) messageContent.quoted = options.quoted;
            return await this.sock.sendMessage(this.threadID, messageContent);
          }
          // Ensure obj is defined and valid
          if (!obj) {
            this.logger.error(`Attachment object is undefined or null for ${type}: ${attachment}`);
            const messageContent = { text: text || `❌ Failed to process attachment (undefined object)` };
            if (options.quoted) messageContent.quoted = options.quoted;
            return await this.sock.sendMessage(this.threadID, messageContent);
          }
          // For audio/video, ensure stream is valid
          if ((type === 'audio' || type === 'video') && (typeof obj.pipe !== 'function' || typeof obj.read !== 'function')) {
            this.logger.error(`Attachment stream is not a valid readable stream for ${type}: ${attachment}`);
            const messageContent = { text: text || `❌ Invalid stream for ${type}: ${attachment}` };
            if (options.quoted) messageContent.quoted = options.quoted;
            return await this.sock.sendMessage(this.threadID, messageContent);
          }
          const messageContent = {};
          messageContent[type] = obj;
          if (type === 'image' || type === 'video') messageContent.caption = text || undefined;
          if (options.quoted) messageContent.quoted = options.quoted;
          return await this.sock.sendMessage(this.threadID, messageContent);
        } catch (error) {
          this.logger.error("Error sending single attachment:", error);
          const messageContent = { text: text || "❌ Failed to process attachment" };
          if (options.quoted) messageContent.quoted = options.quoted;
          return await this.sock.sendMessage(this.threadID, messageContent);
        }
      }
    } catch (error) {
      this.logger.error("Error in sendWithAttachment:", error);
      throw error;
    }
  }

  /**
   * React to the current message
   * @param {string} emoji - Emoji to react with
   * @returns {Promise<object>} - Reaction result
   */
  async react(emoji) {
    try {
      const result = await this.sock.sendMessage(this.threadID, {
        react: { 
          text: emoji, 
          key: this.msg.key 
        }
      });
      
      if (this.config.logMessages) {
        this.logger.info(`👍 Reaction sent: ${emoji} to message ${this.messageID}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in message.react:", error);
      throw error;
    }
  }

  /**
   * Delete/unsend the current message
   * @returns {Promise<object>} - Delete result
   */
  async unsend() {
    try {
      const result = await this.sock.sendMessage(this.threadID, {
        delete: this.msg.key
      });
      
      if (this.config.logMessages) {
        this.logger.info(`🗑️ Message deleted: ${this.messageID}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in message.unsend:", error);
      throw error;
    }
  }

  /**
   * Edit a message (WhatsApp limitation - can only edit text messages)
   * @param {string} newText - New text content
   * @param {object} messageKey - Message key to edit (optional, defaults to current message)
   * @returns {Promise<object>} - Edit result
   */
  async edit(newText, messageKey = null) {
    try {
      const result = await this.sock.sendMessage(this.threadID, {
        text: newText,
        edit: messageKey || this.msg.key
      });
      
      if (this.config.logMessages) {
        this.logger.info(`✏️ Message edited: ${this.messageID}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error in message.edit:", error);
      throw error;
    }
  }

  /**
   * Send a typing indicator
   * @returns {Promise<void>}
   */
  async typing() {
    try {
      await this.sock.sendPresenceUpdate('composing', this.threadID);
    } catch (error) {
      this.logger.error("Error in message.typing:", error);
    }
  }

  /**
   * Send a recording indicator
   * @returns {Promise<void>}
   */
  async recording() {
    try {
      await this.sock.sendPresenceUpdate('recording', this.threadID);
    } catch (error) {
      this.logger.error("Error in message.recording:", error);
    }
  }

  /**
   * Mark messages as read
   * @returns {Promise<void>}
   */
  async markAsRead() {
    try {
      await this.sock.readMessages([this.msg.key]);
      
      if (this.config.logMessages) {
        this.logger.info(`👁️ Message marked as read: ${this.messageID}`);
      }
    } catch (error) {
      this.logger.error("Error in message.markAsRead:", error);
    }
  }

  /**
   * Get message info
   * @returns {object} - Message information
   */
  getMessageInfo() {
    return {
      messageID: this.messageID,
      threadID: this.threadID,
      senderID: this.senderID,
      body: this.body,
      isGroup: this.isGroup,
      timestamp: this.msg.messageTimestamp,
      type: this.getMessageType(),
      mentions: this.getMentions(),
      isReply: this.isReply(),
      quotedMessage: this.getQuotedMessage()
    };
  }

  /**
   * Get message type
   * @returns {string} - Message type
   */
  getMessageType() {
    if (this.msg.message?.conversation) return 'text';
    if (this.msg.message?.extendedTextMessage) return 'text';
    if (this.msg.message?.imageMessage) return 'image';
    if (this.msg.message?.videoMessage) return 'video';
    if (this.msg.message?.audioMessage) return 'audio';
    if (this.msg.message?.documentMessage) return 'document';
    if (this.msg.message?.stickerMessage) return 'sticker';
    if (this.msg.message?.locationMessage) return 'location';
    if (this.msg.message?.contactMessage) return 'contact';
    return 'unknown';
  }

  /**
   * Get mentioned users
   * @returns {Array} - Array of mentioned user IDs
   */
  getMentions() {
    const mentions = [];
    
    if (this.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
      mentions.push(...this.msg.message.extendedTextMessage.contextInfo.mentionedJid);
    }
    
    // Extract mentions from text using @mention pattern
    const mentionPattern = /@(\d+)/g;
    let match;
    while ((match = mentionPattern.exec(this.body)) !== null) {
      const mentionedId = match[1] + '@s.whatsapp.net';
      if (!mentions.includes(mentionedId)) {
        mentions.push(mentionedId);
      }
    }
    
    return mentions;
  }

  /**
   * Check if message is a reply
   * @returns {boolean} - True if message is a reply
   */
  isReply() {
    return !!(this.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
              this.msg.message?.imageMessage?.contextInfo?.quotedMessage ||
              this.msg.message?.videoMessage?.contextInfo?.quotedMessage);
  }

  /**
   * Get quoted message info
   * @returns {object|null} - Quoted message info or null
   */
  getQuotedMessage() {
    const contextInfo = this.msg.message?.extendedTextMessage?.contextInfo ||
                       this.msg.message?.imageMessage?.contextInfo ||
                       this.msg.message?.videoMessage?.contextInfo;
    
    if (!contextInfo?.quotedMessage) return null;
    
    return {
      messageID: contextInfo.stanzaId,
      senderID: contextInfo.participant,
      message: contextInfo.quotedMessage,
      text: contextInfo.quotedMessage.conversation ||
            contextInfo.quotedMessage.extendedTextMessage?.text ||
            contextInfo.quotedMessage.imageMessage?.caption ||
            contextInfo.quotedMessage.videoMessage?.caption ||
            ""
    };
  }
}

module.exports = MessageWrapper;
