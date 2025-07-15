const { spawn } = require("child_process")
const path = require("path")
const { logger } = require("./libs/logger")

function startBot() {
  // Clear console before starting to prevent duplicate output
  console.clear()

  const child = spawn("node", ["Goat.js"], {
    cwd: __dirname,
    stdio: "inherit", // This ensures the child process shares the same terminal
    shell: true,
  })

  child.on("close", (code) => {
    if (code === 2) {
      logger.info("🔄 Restarting bot...")
      // Add a small delay before restarting to ensure terminal is ready
      setTimeout(() => {
        startBot()
      }, 1000)
    }
  })

  child.on("error", (err) => {
    logger.error("❌ Failed to start bot process:", err)
  })
}

startBot()
