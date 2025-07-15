const inquirer = require("inquirer")
const chalk = require("chalk")
const fs = require("fs-extra")
const path = require("path")
const { logger } = require("../libs/logger")

class AuthManager {
  constructor() {
    this.sessionPath = path.join(process.cwd(), "session")
    this.authMethod = null
    this.isInteractive = process.stdout.isTTY
    this.authPromise = null
    this.authResolver = null
    this.authRejecter = null
  }

  async checkSession() {
    try {
      const sessionExists = await fs.pathExists(this.sessionPath)
      if (!sessionExists) {
        logger.info("📱 No existing session found")
        return false
      }

      const files = await fs.readdir(this.sessionPath)
      const hasValidSession = files.some((file) => file.includes("creds.json"))

      if (hasValidSession) {
        // Additional validation: check if creds.json is valid
        const credsPath = path.join(this.sessionPath, "creds.json")
        try {
          const credsContent = await fs.readFile(credsPath, "utf8")
          const creds = JSON.parse(credsContent)
          
          // Basic validation of credentials structure
          if (creds && typeof creds === "object" && creds.noiseKey) {
            logger.info("✅ Valid session found")
            global.GoatBot.sessionValid = true
            return true
          } else {
            logger.warn("⚠️ Session file exists but appears corrupted")
            await this.clearSession()
            return false
          }
        } catch (error) {
          logger.warn("⚠️ Session file exists but is invalid:", error.message)
          await this.clearSession()
          return false
        }
      } else {
        logger.info("⚠️ Session folder exists but no valid credentials found")
        await this.clearSession()
        return false
      }
    } catch (error) {
      logger.error("❌ Error checking session:", error)
      return false
    }
  }

  async clearSession() {
    try {
      await fs.remove(this.sessionPath)
      logger.info("🗑️ Session cleared successfully")
      global.GoatBot.sessionValid = false
    } catch (error) {
      logger.error("❌ Error clearing session:", error)
      throw error
    }
  }

  async showAuthMenu() {
    return new Promise(async (resolve) => {
      // Clear console only if we're in interactive mode
      if (this.isInteractive) {
        console.clear()
      }

      console.log(chalk.cyan("\n" + "=".repeat(50)))
      console.log(chalk.cyan.bold("           🔐 AUTHENTICATION REQUIRED"))
      console.log(chalk.cyan("=".repeat(50)))
      console.log(chalk.yellow("Please choose your preferred authentication method:\n"))

      const choices = [
        {
          name: "📱 Pairing Code - Link with phone number",
          value: "pairing",
          short: "Pairing Code",
        },
        {
          name: "📷 QR Code - Scan with WhatsApp camera",
          value: "qr",
          short: "QR Code",
        },
        {
          name: "🗑️ Clear Session - Remove existing session data",
          value: "clear",
          short: "Clear Session",
        },
        {
          name: "❌ Exit - Close the application",
          value: "exit",
          short: "Exit",
        },
      ]

      try {
        // Set global status to waiting for auth
        global.GoatBot.connectionStatus = "waiting_for_auth"
        global.GoatBot.waitingForAuth = true

        // Check if we can use interactive prompts
        if (!this.isInteractive) {
          logger.warn("⚠️ Non-interactive environment detected, defaulting to QR code authentication")
          return resolve("qr")
        }

        const answer = await inquirer.prompt([
          {
            type: "list",
            name: "method",
            message: "Select authentication method:",
            choices: choices,
            pageSize: 4,
            prefix: "🐐",
            suffix: "",
          },
        ])

        resolve(answer.method)
      } catch (error) {
        if (error.isTtyError || !this.isInteractive) {
          logger.info("📱 Interactive prompts not available, defaulting to QR code authentication")
          resolve("qr")
        } else {
          logger.error("❌ Error in authentication menu:", error)
          // Fallback to QR code
          resolve("qr")
        }
      }
    })
  }

  async handlePairingCode() {
    console.log(chalk.cyan("\n" + "=".repeat(50)))
    console.log(chalk.cyan.bold("           📱 PAIRING CODE AUTHENTICATION"))
    console.log(chalk.cyan("=".repeat(50)))

    try {
      let phoneNumber

      if (this.isInteractive) {
        const phoneAnswer = await inquirer.prompt([
          {
            type: "input",
            name: "phone",
            message: "Enter your phone number (with country code, e.g., +1234567890):",
            validate: (input) => {
              const cleaned = input.replace(/\D/g, "")
              if (cleaned.length < 10 || cleaned.length > 15) {
                return "Please enter a valid phone number (10-15 digits)"
              }
              if (!input.startsWith("+")) {
                return "Please include the country code (e.g., +1234567890)"
              }
              return true
            },
            filter: (input) => {
              // Ensure it starts with + and contains only digits after
              const cleaned = input.replace(/[^\d+]/g, "")
              if (!cleaned.startsWith("+")) {
                return "+" + cleaned
              }
              return cleaned
            },
            prefix: "📞",
          },
        ])
        phoneNumber = phoneAnswer.phone
      } else {
        // Non-interactive fallback
        logger.error("❌ Cannot collect phone number in non-interactive environment")
        throw new Error("Interactive input required for pairing code authentication")
      }

      this.authMethod = "pairing"
      global.GoatBot.authMethod = "pairing"

      console.log(chalk.yellow("\n⏳ Generating pairing code..."))
      this.showPairingInstructions()

      return phoneNumber
    } catch (error) {
      logger.error("❌ Error in pairing code setup:", error)
      throw error
    }
  }

  showPairingInstructions() {
    console.log(chalk.cyan("\n📋 Pairing Code Instructions:"))
    console.log(chalk.white("┌─────────────────────────────────────────────────────┐"))
    console.log(chalk.white("│ 1. Open WhatsApp on your phone                     │"))
    console.log(chalk.white("│ 2. Go to Settings > Linked Devices                 │"))
    console.log(chalk.white("│ 3. Tap 'Link a Device'                             │"))
    console.log(chalk.white("│ 4. Select 'Link with Phone Number Instead'         │"))
    console.log(chalk.white("│ 5. Enter the pairing code shown below              │"))
    console.log(chalk.white("└─────────────────────────────────────────────────────┘"))
    console.log(chalk.cyan("=".repeat(50)))
  }

  async handleQRCode() {
    console.log(chalk.cyan("\n" + "=".repeat(50)))
    console.log(chalk.cyan.bold("           📷 QR CODE AUTHENTICATION"))
    console.log(chalk.cyan("=".repeat(50)))

    this.authMethod = "qr"
    global.GoatBot.authMethod = "qr"

    console.log(chalk.yellow("⏳ Generating QR code..."))
    this.showQRInstructions()

    return null
  }

  showQRInstructions() {
    console.log(chalk.cyan("\n📋 QR Code Instructions:"))
    console.log(chalk.white("┌─────────────────────────────────────────────────────┐"))
    console.log(chalk.white("│ 1. Open WhatsApp on your phone                     │"))
    console.log(chalk.white("│ 2. Go to Settings > Linked Devices                 │"))
    console.log(chalk.white("│ 3. Tap 'Link a Device'                             │"))
    console.log(chalk.white("│ 4. Scan the QR code shown below                    │"))
    console.log(chalk.white("└─────────────────────────────────────────────────────┘"))
    console.log(chalk.cyan("=".repeat(50)))
  }

  async handleClearSession() {
    console.log(chalk.cyan("\n" + "=".repeat(50)))
    console.log(chalk.cyan.bold("           🗑️ CLEARING SESSION"))
    console.log(chalk.cyan("=".repeat(50)))

    try {
      await this.clearSession()
      console.log(chalk.green("✅ Session cleared successfully"))
      console.log(chalk.yellow("🔄 Restarting authentication process..."))
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      logger.error("❌ Error clearing session:", error)
      throw error
    }
  }

  showConnectionStatus(status) {
    const statusMessages = {
      connecting: "🔄 Connecting to WhatsApp...",
      connected: "✅ Connected to WhatsApp!",
      disconnected: "❌ Disconnected from WhatsApp",
      reconnecting: "🔄 Reconnecting...",
      timeout: "⏰ Connection timeout",
      qr_ready: "📷 QR Code ready for scanning",
      pairing_ready: "📱 Pairing code ready",
      authentication: "🔐 Authenticating...",
      waiting_for_auth: "⏳ Waiting for authentication...",
    }

    const message = statusMessages[status] || `📊 Status: ${status}`
    console.log(chalk.cyan(`\n${message}`))
    
    // Update global status
    global.GoatBot.connectionStatus = status
  }

  showSuccess() {
    console.log(chalk.green("\n" + "=".repeat(50)))
    console.log(chalk.green.bold("           ✅ AUTHENTICATION SUCCESSFUL"))
    console.log(chalk.green("=".repeat(50)))
    console.log(chalk.yellow("🎉 WhatsApp connection established!"))
    console.log(chalk.cyan("🚀 Bot is now ready to use"))
    console.log(chalk.magenta("📊 Dashboard: http://localhost:3000"))
    console.log(chalk.green("=".repeat(50)))
  }

  showError(message, error = null) {
    console.log(chalk.red("\n" + "=".repeat(50)))
    console.log(chalk.red.bold("           ❌ AUTHENTICATION ERROR"))
    console.log(chalk.red("=".repeat(50)))
    console.log(chalk.yellow(`⚠️ ${message}`))
    
    if (error) {
      console.log(chalk.gray(`📝 Details: ${error.message}`))
    }
    
    console.log(chalk.cyan("🔄 Please try again or choose a different method"))
    console.log(chalk.red("=".repeat(50)))
  }

  // Method to create a promise that resolves when authentication is complete
  createAuthPromise() {
    if (this.authPromise) {
      return this.authPromise
    }

    this.authPromise = new Promise((resolve, reject) => {
      this.authResolver = resolve
      this.authRejecter = reject
    })

    return this.authPromise
  }

  // Method to resolve the authentication promise
  resolveAuth(success = true, data = null) {
    if (this.authResolver) {
      this.authResolver({ success, data })
      this.authPromise = null
      this.authResolver = null
      this.authRejecter = null
    }
  }

  // Method to reject the authentication promise
  rejectAuth(error) {
    if (this.authRejecter) {
      this.authRejecter(error)
      this.authPromise = null
      this.authResolver = null
      this.authRejecter = null
    }
  }

  // Method to check if authentication is in progress
  isAuthInProgress() {
    return this.authPromise !== null
  }

  // Method to get current authentication status
  getAuthStatus() {
    return {
      method: this.authMethod,
      isInteractive: this.isInteractive,
      sessionValid: global.GoatBot.sessionValid,
      waitingForAuth: global.GoatBot.waitingForAuth,
      connectionStatus: global.GoatBot.connectionStatus,
      inProgress: this.isAuthInProgress()
    }
  }
}

module.exports = AuthManager