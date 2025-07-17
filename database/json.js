const fs = require("fs").promises
const path = require("path")
const { initializeDatabase } = require("./init")

const dbPath = path.join(__dirname, "/data/data.json")
const threadPath = path.join(__dirname, "/data/thread.json")
const userPath = path.join(__dirname, "/data/user.json")

let data = {}
let threads = {}
let users = {}

module.exports = {
  connect: async () => {
    try {
      initializeDatabase()
      
      const fileContent = await fs.readFile(dbPath, "utf-8")
      data = JSON.parse(fileContent)
      
      try {
        const threadContent = await fs.readFile(threadPath, "utf-8")
        threads = JSON.parse(threadContent)
      } catch (error) {
        if (error.code === "ENOENT") {
          threads = {}
          await fs.writeFile(threadPath, JSON.stringify(threads, null, 2))
        }
      }
      
      try {
        const userContent = await fs.readFile(userPath, "utf-8")
        users = JSON.parse(userContent)
      } catch (error) {
        if (error.code === "ENOENT") {
          users = {}
          await fs.writeFile(userPath, JSON.stringify(users, null, 2))
        }
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        initializeDatabase()
        const fileContent = await fs.readFile(dbPath, "utf-8")
        data = JSON.parse(fileContent)
      } else {
        console.error("Failed to load JSON database:", error)
      }
    }
  },
  
  get: (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      return Promise.resolve(threads[threadId])
    }
    if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      return Promise.resolve(users[userId])
    }
    return Promise.resolve(data[key])
  },
  
  set: async (key, value) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      threads[threadId] = value
      await fs.writeFile(threadPath, JSON.stringify(threads, null, 2))
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      users[userId] = value
      await fs.writeFile(userPath, JSON.stringify(users, null, 2))
    } else {
      data[key] = value
      await fs.writeFile(dbPath, JSON.stringify(data, null, 2))
    }
  },
  
  delete: async (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      delete threads[threadId]
      await fs.writeFile(threadPath, JSON.stringify(threads, null, 2))
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      delete users[userId]
      await fs.writeFile(userPath, JSON.stringify(users, null, 2))
    } else {
      delete data[key]
      await fs.writeFile(dbPath, JSON.stringify(data, null, 2))
    }
  },
  
  getStats: () => {
    return Promise.resolve({
      users: Object.keys(users).length,
      threads: Object.keys(threads).length,
      data: Object.keys(data).length,
      total: Object.keys(users).length + Object.keys(threads).length + Object.keys(data).length
    })
  },
  
  getByPrefix: async (prefix) => {
    if (prefix === "user_") {
      return Promise.resolve(users)
    }
    if (prefix === "thread_") {
      return Promise.resolve(threads)
    }
    const result = {}
    for (const key in data) {
      if (key.startsWith(prefix)) {
        result[key] = data[key]
      }
    }
    return Promise.resolve(result)
  },
  
  getAllKeys: () => {
    return Promise.resolve([
      ...Object.keys(users).map(k => `user_${k}`),
      ...Object.keys(threads).map(k => `thread_${k}`),
      ...Object.keys(data)
    ])
  },
  
  has: (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      return Promise.resolve(threads.hasOwnProperty(threadId))
    }
    if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      return Promise.resolve(users.hasOwnProperty(userId))
    }
    return Promise.resolve(data.hasOwnProperty(key))
  },
  
  getAllData: () => {
    return Promise.resolve({ data, threads, users })
  }
}