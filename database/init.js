const fs = require('fs');
const path = require('path');

/**
 * Initialize database structure with proper schema
 */
function initializeDatabase() {
  const dbPath = path.join(__dirname, '/data/data.json');
  
  // Default database structure
  const defaultData = {
    // Global bot settings
    global_settings: {
      initialized: true,
      version: "1.0.0",
      createdAt: Date.now(),
      totalUsers: 0,
      totalThreads: 0,
      totalMessages: 0
    },
    
    // Sample data structure (will be populated as users interact)
    // user_[userId]: {
    //   id: string,
    //   name: string,
    //   messageCount: number,
    //   firstSeen: timestamp,
    //   lastSeen: timestamp,
    //   experience: number,
    //   level: number,
    //   currency: number,
    //   warnings: number,
    //   banned: boolean,
    //   settings: object
    // },
    
    // thread_[threadId]: {
    //   id: string,
    //   isGroup: boolean,
    //   name: string,
    //   messageCount: number,
    //   firstActivity: timestamp,
    //   lastActivity: timestamp,
    //   participants: array,
    //   settings: object,
    //   warnings: number,
    //   banned: boolean
    // },
    
    // message_[messageId]: {
    //   id: string,
    //   body: string,
    //   sender: string,
    //   threadId: string,
    //   timestamp: timestamp,
    //   type: string,
    //   quoted: boolean,
    //   mentions: array
    // }
  };
  
  try {
    // Check if database already exists
    if (fs.existsSync(dbPath)) {
      const existingData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      
      // Only add global settings if they don't exist
      if (!existingData.global_settings) {
        existingData.global_settings = defaultData.global_settings;
        fs.writeFileSync(dbPath, JSON.stringify(existingData, null, 2));
        console.log('✅ Database updated with global settings');
      } else {
        console.log('✅ Database already initialized');
      }
    } else {
      // Create new database
      fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
      console.log('✅ Database initialized with default structure');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    return false;
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
