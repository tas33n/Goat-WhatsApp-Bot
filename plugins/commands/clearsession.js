const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "clearsession",
    aliases: ["cs", "clear-session"],
    description: "Clear the current session and restart authentication",
    guide: "{pn}",
    author: "@anbuinfosec",
    category: "admin",
    role: 1,
    countDown: 10
  },
  onCmd: async ({ reply, logger }) => {
    try {
      await reply("🔄 Clearing session and restarting authentication...");
      
      // Clear session files
      const sessionPath = path.join(process.cwd(), "session");
      
      if (await fs.pathExists(sessionPath)) {
        await fs.remove(sessionPath);
        logger.info("✅ Session files cleared");
      }
      
      // Force restart
      setTimeout(() => {
        process.exit(2); // Exit with restart code
      }, 2000);
      
    } catch (error) {
      logger.error("Error clearing session:", error);
      await reply("❌ An error occurred while clearing the session.");
    }
  }
};
