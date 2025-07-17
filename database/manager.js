const jsonDb = require("./json")
const mongoDb = require("./mongodb")
const sqliteDb = require("./sqlite")
const mysqlDb = require("./mysql")
let db

module.exports = {
  connect: async (config) => {
    switch (config.type) {
      case "mongodb":
        await mongoDb.connect(config.mongodb.uri)
        db = mongoDb
        break
      case "sqlite":
        await sqliteDb.connect(config.sqlite?.path || "database.db")
        db = sqliteDb
        break
      case "mysql":
        await mysqlDb.connect(config.mysql)
        db = mysqlDb
        break
      case "json":
      default:
        await jsonDb.connect()
        db = jsonDb
        break
    }
    console.log(`✅ Database connected: ${config.type || 'json'}`)
  },
  get: (key) => {
    if (!db) throw new Error("Database not connected.")
    return db.get(key)
  },
  set: (key, value) => {
    if (!db) throw new Error("Database not connected.")
    return db.set(key, value)
  },
  delete: (key) => {
    if (!db) throw new Error("Database not connected.")
    return db.delete(key)
  },
  
  getByPrefix: (prefix) => {
    if (!db) throw new Error("Database not connected.")
    return db.getByPrefix(prefix)
  },
  
  close: () => {
    if (!db) throw new Error("Database not connected.")
    if (db.close) {
      return db.close()
    }
  },
  // Add this new function to get database statistics
  getStats: () => {
    if (!db) throw new Error("Database not connected.");
    return db.getStats();
  },
  // User data methods
  getUserData: async (userId) => {
    if (!db) throw new Error("Database not connected.");
    return await db.get(`user_${userId}`);
  },
  setUserData: async (userId, userData) => {
    if (!db) throw new Error("Database not connected.");
    return await db.set(`user_${userId}`, userData);
  },
  getAllUsers: async () => {
    if (!db) throw new Error("Database not connected.");
    return await db.getByPrefix('user_');
  },
  // Thread data methods
  getThreadData: async (threadId) => {
    if (!db) throw new Error("Database not connected.");
    return await db.get(`thread_${threadId}`);
  },
  setThreadData: async (threadId, threadData) => {
    if (!db) throw new Error("Database not connected.");
    return await db.set(`thread_${threadId}`, threadData);
  },
  getAllThreads: async () => {
    if (!db) throw new Error("Database not connected.");
    return await db.getByPrefix('thread_');
  },
  // Message data methods
  getMessageData: async (messageId) => {
    if (!db) throw new Error("Database not connected.");
    return await db.get(`message_${messageId}`);
  },
  getThreadMessages: async (threadId) => {
    if (!db) throw new Error("Database not connected.");
    return await db.get(`thread_messages_${threadId}`) || [];
  },
  // Global data methods
  getGlobalData: async (key) => {
    if (!db) throw new Error("Database not connected.");
    return await db.get(`global_${key}`);
  },
  setGlobalData: async (key, value) => {
    if (!db) throw new Error("Database not connected.");
    return await db.set(`global_${key}`, value);
  },
  // Utility methods
  getAllKeys: async () => {
    if (!db) throw new Error("Database not connected.");
    return await db.getAllKeys();
  },
  has: async (key) => {
    if (!db) throw new Error("Database not connected.");
    return await db.has(key);
  },
  getAllData: async () => {
    if (!db) throw new Error("Database not connected.");
    return await db.getAllData();
  }
}