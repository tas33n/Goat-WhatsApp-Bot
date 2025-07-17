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
      if (Array.isArray(attachment)) {
        // Multiple attachments
        const attachmentStreams = [];
        
        for (const att of attachment) {
          try {
            // Check if attachment is already a stream object or a URL
            if (typeof att === 'string') {
              // It's a URL, convert to stream
              const stream = await getStreamFromURL(att);
              if (stream) {
                attachmentStreams.push(stream);
              }
            } else if (att && typeof att === 'object' && att.readable !== undefined) {
              // It's already a stream object
              attachmentStreams.push(att);
            } else {
              this.logger.error(`Invalid attachment type: ${typeof att}`, att);
            }
          } catch (error) {
            this.logger.error(`Error processing attachment ${att}:`, error);
          }
        }
        
        if (attachmentStreams.length > 0) {
          // Send text first if provided
          if (text) {
            const textMessage = { text: text };
            if (options.quoted) {
              textMessage.quoted = options.quoted;
            }
            await this.sock.sendMessage(this.threadID, textMessage);
          }
          
          // Send attachments
          for (const stream of attachmentStreams) {
            const attachmentMessage = { image: stream };
            if (options.quoted && !text) {
              attachmentMessage.quoted = options.quoted;
            }
            await this.sock.sendMessage(this.threadID, attachmentMessage);
            
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
          return await this.sock.sendMessage(this.threadID, messageContent);
        }
      } else {
        // Single attachment
        try {
          let attachmentStream;
          
          // Check if attachment is already a stream object or a URL
          if (typeof attachment === 'string') {
            // It's a URL, convert to stream
            attachmentStream = await getStreamFromURL(attachment);
          } else if (attachment && typeof attachment === 'object' && attachment.readable !== undefined) {
            // It's already a stream object
            attachmentStream = attachment;
          } else {
            this.logger.error(`Invalid attachment type: ${typeof attachment}`, attachment);
            // Fallback to text only
            const messageContent = { text: text || "❌ Invalid attachment type" };
            if (options.quoted) {
              messageContent.quoted = options.quoted;
            }
            return await this.sock.sendMessage(this.threadID, messageContent);
          }
          
          if (attachmentStream) {
            const messageContent = {
              image: attachmentStream,
              caption: text || undefined
            };
            
            if (options.quoted) {
              messageContent.quoted = options.quoted;
            }
            
            return await this.sock.sendMessage(this.threadID, messageContent);
          } else {
            // Fallback to text only
            const messageContent = { text: text || "❌ Failed to process attachment" };
            if (options.quoted) {
              messageContent.quoted = options.quoted;
            }
            return await this.sock.sendMessage(this.threadID, messageContent);
          }
        } catch (error) {
          this.logger.error("Error sending single attachment:", error);
          // Fallback to text only
          const messageContent = { text: text || "❌ Failed to process attachment" };
          if (options.quoted) {
            messageContent.quoted = options.quoted;
          }
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
