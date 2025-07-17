const mysql = require("mysql2/promise")

let connection

module.exports = {
  connect: async (config) => {
    connection = await mysql.createConnection(config)
    
    // Create tables if they don't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS threads (
        id VARCHAR(255) PRIMARY KEY,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS data (
        id VARCHAR(255) PRIMARY KEY,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
  },
  
  get: async (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      const [rows] = await connection.execute("SELECT data FROM threads WHERE id = ?", [threadId])
      return rows.length > 0 ? rows[0].data : undefined
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      const [rows] = await connection.execute("SELECT data FROM users WHERE id = ?", [userId])
      return rows.length > 0 ? rows[0].data : undefined
    } else {
      const [rows] = await connection.execute("SELECT data FROM data WHERE id = ?", [key])
      return rows.length > 0 ? rows[0].data : undefined
    }
  },
  
  set: async (key, value) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      await connection.execute(
        "INSERT INTO threads (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP",
        [threadId, JSON.stringify(value)]
      )
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      await connection.execute(
        "INSERT INTO users (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP",
        [userId, JSON.stringify(value)]
      )
    } else {
      await connection.execute(
        "INSERT INTO data (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP",
        [key, JSON.stringify(value)]
      )
    }
  },
  
  delete: async (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      await connection.execute("DELETE FROM threads WHERE id = ?", [threadId])
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      await connection.execute("DELETE FROM users WHERE id = ?", [userId])
    } else {
      await connection.execute("DELETE FROM data WHERE id = ?", [key])
    }
  },
  
  getByPrefix: async (prefix) => {
    if (prefix === "user_") {
      const [rows] = await connection.execute("SELECT id, data FROM users")
      const result = {}
      rows.forEach(row => {
        result[row.id] = row.data
      })
      return result
    } else if (prefix === "thread_") {
      const [rows] = await connection.execute("SELECT id, data FROM threads")
      const result = {}
      rows.forEach(row => {
        result[row.id] = row.data
      })
      return result
    } else {
      const [rows] = await connection.execute("SELECT id, data FROM data WHERE id LIKE ?", [`${prefix}%`])
      const result = {}
      rows.forEach(row => {
        result[row.id] = row.data
      })
      return result
    }
  },
  
  getAllKeys: async () => {
    const [userRows] = await connection.execute("SELECT id FROM users")
    const [threadRows] = await connection.execute("SELECT id FROM threads")
    const [dataRows] = await connection.execute("SELECT id FROM data")
    
    return [
      ...userRows.map(row => `user_${row.id}`),
      ...threadRows.map(row => `thread_${row.id}`),
      ...dataRows.map(row => row.id)
    ]
  },
  
  has: async (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      const [rows] = await connection.execute("SELECT COUNT(*) as count FROM threads WHERE id = ?", [threadId])
      return rows[0].count > 0
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      const [rows] = await connection.execute("SELECT COUNT(*) as count FROM users WHERE id = ?", [userId])
      return rows[0].count > 0
    } else {
      const [rows] = await connection.execute("SELECT COUNT(*) as count FROM data WHERE id = ?", [key])
      return rows[0].count > 0
    }
  },
  
  getAllData: async () => {
    const [userRows] = await connection.execute("SELECT id, data FROM users")
    const [threadRows] = await connection.execute("SELECT id, data FROM threads")
    const [dataRows] = await connection.execute("SELECT id, data FROM data")
    
    const result = { data: {}, threads: {}, users: {} }
    
    userRows.forEach(row => {
      result.users[row.id] = row.data
    })
    
    threadRows.forEach(row => {
      result.threads[row.id] = row.data
    })
    
    dataRows.forEach(row => {
      result.data[row.id] = row.data
    })
    
    return result
  },
  
  getStats: async () => {
    const [userCount] = await connection.execute("SELECT COUNT(*) as count FROM users")
    const [threadCount] = await connection.execute("SELECT COUNT(*) as count FROM threads")
    const [dataCount] = await connection.execute("SELECT COUNT(*) as count FROM data")
    
    return {
      users: userCount[0].count,
      threads: threadCount[0].count,
      data: dataCount[0].count,
      total: userCount[0].count + threadCount[0].count + dataCount[0].count
    }
  },
  
  close: async () => {
    if (connection) {
      await connection.end()
    }
  }
}
