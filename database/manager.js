const jsonDb = require("./json")
const mongoDb = require("./mongodb")
let db

module.exports = {
  connect: async (config) => {
    if (config.type === "mongodb") {
      await mongoDb.connect(config.mongodb.uri)
      db = mongoDb
    } else {
      await jsonDb.connect()
      db = jsonDb
    }
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
  // Add this new function to get database statistics
  getStats: () => {
    if (!db) throw new Error("Database not connected.");
    return db.getStats();
  }
}