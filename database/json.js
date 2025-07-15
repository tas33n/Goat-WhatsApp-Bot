const fs = require("fs").promises
const path = require("path")
const dbPath = path.join(__dirname, "data.json")

let data = {}

module.exports = {
  connect: async () => {
    try {
      const fileContent = await fs.readFile(dbPath, "utf-8")
      data = JSON.parse(fileContent)
    } catch (error) {
      if (error.code === "ENOENT") {
        await fs.writeFile(dbPath, JSON.stringify({}, null, 2))
      } else {
        console.error("Failed to load JSON database:", error)
      }
    }
  },
  get: (key) => Promise.resolve(data[key]),
  set: async (key, value) => {
    data[key] = value
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2))
  },
  delete: async (key) => {
    delete data[key]
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2))
  },
}
