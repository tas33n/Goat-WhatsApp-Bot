/*
Name: Goat-WhatsApp-Bot
Description: A WhatsApp bot built with Node.js, designed to automate tasks and provide various functionalities
Author: Mohammad Alamin & Taseen
Version: 1.0.0
License: MIT
Repository: https://github.com/anbuinfosec/Goat-WhatsApp-Bot
*/

const { spawn } = require("child_process")
const path = require("path")
const { logger } = require("./libs/logger")

function startBot() {
  console.clear()
  const child = spawn("node", ["Goat.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
  })

  child.on("close", (code) => {
    if (code === 2) {
      logger.info("🔄 Restarting bot...")
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
