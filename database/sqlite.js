const sqlite3 = require("sqlite3").verbose()
const path = require("path")

let db

module.exports = {
  connect: async (dbPath = "database.db") => {
    return new Promise((resolve, reject) => {
      const fullPath = path.join(__dirname, dbPath)
      db = new sqlite3.Database(fullPath, (err) => {
        if (err) {
          reject(err)
        } else {
          // Create tables if they don't exist
          db.serialize(() => {
            // Users table
            db.run(`
              CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `)
            
            // Threads table
            db.run(`
              CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `)
            
            // General data table
            db.run(`
              CREATE TABLE IF NOT EXISTS data (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `)
            
            resolve()
          })
        }
      })
    })
  },
  
  get: (key) => {
    return new Promise((resolve, reject) => {
      if (key.startsWith("thread_")) {
        const threadId = key.replace("thread_", "")
        db.get("SELECT data FROM threads WHERE id = ?", [threadId], (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row ? JSON.parse(row.data) : undefined)
          }
        })
      } else if (key.startsWith("user_")) {
        const userId = key.replace("user_", "")
        db.get("SELECT data FROM users WHERE id = ?", [userId], (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row ? JSON.parse(row.data) : undefined)
          }
        })
      } else {
        db.get("SELECT data FROM data WHERE id = ?", [key], (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row ? JSON.parse(row.data) : undefined)
          }
        })
      }
    })
  },
  
  set: (key, value) => {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(value)
      
      if (key.startsWith("thread_")) {
        const threadId = key.replace("thread_", "")
        db.run(
          `INSERT OR REPLACE INTO threads (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [threadId, jsonData],
          (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          }
        )
      } else if (key.startsWith("user_")) {
        const userId = key.replace("user_", "")
        db.run(
          `INSERT OR REPLACE INTO users (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [userId, jsonData],
          (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          }
        )
      } else {
        db.run(
          `INSERT OR REPLACE INTO data (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [key, jsonData],
          (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          }
        )
      }
    })
  },
  
  delete: (key) => {
    return new Promise((resolve, reject) => {
      if (key.startsWith("thread_")) {
        const threadId = key.replace("thread_", "")
        db.run("DELETE FROM threads WHERE id = ?", [threadId], (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      } else if (key.startsWith("user_")) {
        const userId = key.replace("user_", "")
        db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      } else {
        db.run("DELETE FROM data WHERE id = ?", [key], (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      }
    })
  },
  
  getByPrefix: (prefix) => {
    return new Promise((resolve, reject) => {
      if (prefix === "user_") {
        db.all("SELECT id, data FROM users", [], (err, rows) => {
          if (err) {
            reject(err)
          } else {
            const result = {}
            rows.forEach(row => {
              result[row.id] = JSON.parse(row.data)
            })
            resolve(result)
          }
        })
      } else if (prefix === "thread_") {
        db.all("SELECT id, data FROM threads", [], (err, rows) => {
          if (err) {
            reject(err)
          } else {
            const result = {}
            rows.forEach(row => {
              result[row.id] = JSON.parse(row.data)
            })
            resolve(result)
          }
        })
      } else {
        db.all("SELECT id, data FROM data WHERE id LIKE ?", [`${prefix}%`], (err, rows) => {
          if (err) {
            reject(err)
          } else {
            const result = {}
            rows.forEach(row => {
              result[row.id] = JSON.parse(row.data)
            })
            resolve(result)
          }
        })
      }
    })
  },
  
  getAllKeys: () => {
    return new Promise((resolve, reject) => {
      const keys = []
      
      db.all("SELECT id FROM users", [], (err, userRows) => {
        if (err) {
          reject(err)
          return
        }
        
        db.all("SELECT id FROM threads", [], (err, threadRows) => {
          if (err) {
            reject(err)
            return
          }
          
          db.all("SELECT id FROM data", [], (err, dataRows) => {
            if (err) {
              reject(err)
              return
            }
            
            userRows.forEach(row => keys.push(`user_${row.id}`))
            threadRows.forEach(row => keys.push(`thread_${row.id}`))
            dataRows.forEach(row => keys.push(row.id))
            
            resolve(keys)
          })
        })
      })
    })
  },
  
  has: (key) => {
    return new Promise((resolve, reject) => {
      if (key.startsWith("thread_")) {
        const threadId = key.replace("thread_", "")
        db.get("SELECT COUNT(*) as count FROM threads WHERE id = ?", [threadId], (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row.count > 0)
          }
        })
      } else if (key.startsWith("user_")) {
        const userId = key.replace("user_", "")
        db.get("SELECT COUNT(*) as count FROM users WHERE id = ?", [userId], (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row.count > 0)
          }
        })
      } else {
        db.get("SELECT COUNT(*) as count FROM data WHERE id = ?", [key], (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row.count > 0)
          }
        })
      }
    })
  },
  
  getAllData: () => {
    return new Promise((resolve, reject) => {
      const result = { data: {}, threads: {}, users: {} }
      
      db.all("SELECT id, data FROM users", [], (err, userRows) => {
        if (err) {
          reject(err)
          return
        }
        
        userRows.forEach(row => {
          result.users[row.id] = JSON.parse(row.data)
        })
        
        db.all("SELECT id, data FROM threads", [], (err, threadRows) => {
          if (err) {
            reject(err)
            return
          }
          
          threadRows.forEach(row => {
            result.threads[row.id] = JSON.parse(row.data)
          })
          
          db.all("SELECT id, data FROM data", [], (err, dataRows) => {
            if (err) {
              reject(err)
              return
            }
            
            dataRows.forEach(row => {
              result.data[row.id] = JSON.parse(row.data)
            })
            
            resolve(result)
          })
        })
      })
    })
  },
  
  getStats: () => {
    return new Promise((resolve, reject) => {
      let userCount = 0
      let threadCount = 0
      let dataCount = 0
      
      db.get("SELECT COUNT(*) as count FROM users", [], (err, userRow) => {
        if (err) {
          reject(err)
          return
        }
        userCount = userRow.count
        
        db.get("SELECT COUNT(*) as count FROM threads", [], (err, threadRow) => {
          if (err) {
            reject(err)
            return
          }
          threadCount = threadRow.count
          
          db.get("SELECT COUNT(*) as count FROM data", [], (err, dataRow) => {
            if (err) {
              reject(err)
              return
            }
            dataCount = dataRow.count
            
            resolve({
              users: userCount,
              threads: threadCount,
              data: dataCount,
              total: userCount + threadCount + dataCount
            })
          })
        })
      })
    })
  },
  
  close: () => {
    return new Promise((resolve) => {
      if (db) {
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err)
          }
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}
