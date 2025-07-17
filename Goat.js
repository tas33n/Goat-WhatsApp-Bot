require("module-alias/register");
const chalk = require("chalk");
const { logger } = require("./libs/logger");
const config = require("./config.json");
const db = require("./database/manager");
const express = require("express");
const cors = require("cors");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs-extra");
const chokidar = require("chokidar");
const os = require("os");
const { connect, AUTH_ERROR } = require("./bot/connect");
const { loadPlugins, loadCommand, unloadCommand, loadEvent, unloadEvent } = require("./bot/loader");
const OTPService = require("./libs/otpService");
const QRCode = require("qrcode");

// Initialize global configuration system
const GoatConfig = require("./libs/goatConfig");

// Track restart attempts to prevent infinite loops
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;

const banner = `
 ██████╗  █████╗  █████╗ ████████╗ ██╗   ██╗  ███╗
██╔════╝ ██╔══██╗██╔══██╗╚══██╔══╝ ██║   ██║ ████║
██║  ██╗ ██║  ██║███████║   ██║    ╚██╗ ██╔╝██╔██║
██║  ╚██╗██║  ██║██╔══██║   ██║     ╚████╔╝ ╚═╝██║
 ╚██████╔╝╚█████╔╝██║  ██║   ██║      ╚██╔╝  ███████╗
  ╚═════╝  ╚════╝ ╚═╝  ╚═╝   ╚═╝       ╚═╝   ╚══════╝
    Created by @anbuinfosec & @tas33n
`;

const compactBanner = `
█▀▀ █▀█ ▄▀█ ▀█▀   █▄▄ █▀█ ▀█▀   █ █ ▄█
█▄█ █▄█ █▀█  █    █▄█ █▄█  █    ▀▄▀  █
Created by @anbuinfosec & @tas33n
`;

const gradient = require("gradient-string");

function centerText(text, length) {
  const width = process.stdout.columns;
  const leftPadding = Math.floor((width - (length || text.length)) / 2);
  const rightPadding = width - leftPadding - (length || text.length);
  const paddedString = ' '.repeat(leftPadding > 0 ? leftPadding : 0) + text + ' '.repeat(rightPadding > 0 ? rightPadding : 0);
  console.log(paddedString);
}

function createLine(content, isMaxWidth = false) {
  const widthConsole = process.stdout.columns > 50 ? 50 : process.stdout.columns;
  if (!content) {
    return Array(isMaxWidth ? process.stdout.columns : widthConsole).fill("─").join("");
  } else {
    content = ` ${content.trim()} `;
    const lengthContent = content.length;
    const lengthLine = isMaxWidth ? process.stdout.columns - lengthContent : widthConsole - lengthContent;
    let left = Math.floor(lengthLine / 2);
    if (left < 0 || isNaN(left)) left = 0;
    const lineOne = Array(left).fill("─").join("");
    return lineOne + content + lineOne;
  }
}

function printBanner() {
  console.clear();
  
  // Print top line
  console.log(gradient("#f5af19", "#f12711")(createLine(null, true)));
  console.log();
  
  // Choose banner based on console width
  const maxWidth = process.stdout.columns;
  const selectedBanner = maxWidth > 60 ? banner : compactBanner;
  
  // Print main banner
  const bannerLines = selectedBanner.trim().split('\n');
  for (const line of bannerLines) {
    const textColor = gradient("#FA8BFF", "#2BD2FF", "#2BFF88")(line);
    centerText(textColor, line.length);
  }
  
  // Print subtitle
  const currentVersion = require("./package.json").version;
  const vvv = currentVersion.charAt(0);

  const subtitle = `GoatBot V${vvv}@${currentVersion} - A simple WhatsApp bot with advanced features`;
  const subTitleArray = [];
  
  let subTitle = subtitle;
  if (subTitle.length > maxWidth) {
    while (subTitle.length > maxWidth) {
      let lastSpace = subTitle.slice(0, maxWidth).lastIndexOf(' ');
      lastSpace = lastSpace === -1 ? maxWidth : lastSpace;
      subTitleArray.push(subTitle.slice(0, lastSpace).trim());
      subTitle = subTitle.slice(lastSpace).trim();
    }
    if (subTitle) subTitleArray.push(subTitle);
  } else {
    subTitleArray.push(subTitle);
  }
  
  const author = "Created by @anbuinfosec & @tas33n with ♡";
  const srcUrl = "Source code: https://github.com/anbuinfosec/Goat-WhatsApp-Bot";
  const supportMsg = "FOR EDUCATIONAL PURPOSES ONLY";
  
  for (const t of subTitleArray) {
    const textColor2 = gradient("#9F98E8", "#AFF6CF")(t);
    centerText(textColor2, t.length);
  }
  
  centerText(gradient("#9F98E8", "#AFF6CF")(author), author.length);
  centerText(gradient("#9F98E8", "#AFF6CF")(srcUrl), srcUrl.length);
  centerText(gradient("#f5af19", "#f12711")(supportMsg), supportMsg.length);
  
  console.log();
  console.log(gradient("#f5af19", "#f12711")(createLine(null, true)));
}

printBanner();

// Global runtime state
global.GoatBot = {
  commands: new Map(),
  aliases: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  startTime: Date.now(),
  stats: {
    messagesProcessed: 0,
    commandsExecuted: 0,
    errors: 0,
  },
  isConnected: false,
  connectionStatus: "initializing",
  authMethod: null,
  sessionValid: false,
  initialized: false,
  qrCode: null,
  pairingCode: null,
  lastError: null,
  startAuthentication: async function() {
    try {
      this.connectionStatus = "connecting";
      this.qrCode = null;
      this.pairingCode = null;
      this.lastError = null;
      
      // Import the connect function
      const { connect } = require("./bot/connect");
      
      // Start the connection process
      await connect();
      
      return true;
    } catch (error) {
      this.lastError = error.message;
      this.connectionStatus = "error";
      logger.error("Error starting authentication:", error);
      return false;
    }
  }
};

// Initialize global utils
global.utils = require("./utils/utils");

// Temporarily silence logger during authentication
const originalLoggerLevel = logger.level;
logger.setLevel("debug");

async function promptLoginMethod() {
  printBanner();
  console.log(chalk.cyan("\n" + "=".repeat(50)));
  console.log(chalk.cyan.bold("           🔐 AUTHENTICATION REQUIRED"));
  console.log(chalk.cyan("=".repeat(50)));
  console.log(chalk.yellow("Please select a login method:\n"));

  const choices = [
    { name: "📷 QR code (recommended)", value: "qr" },
    { name: "📱 Pair-code login", value: "paircode" },
    { name: "📂 Re-import legacy session file", value: "session-file" },
    { name: "❌ Exit", value: "exit" },
  ];

  try {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "method",
        message: "Select authentication method:",
        choices,
        pageSize: 4,
        prefix: "🐐",
      },
    ]);

    if (answer.method === "exit") {
      console.log(chalk.yellow("👋 Exiting as requested by user."));
      process.exit(0);
    }
    return answer.method;
  } catch (error) {
    // Log error to console (bypassing silent mode) for debugging
    console.error(chalk.red("❌ Error in promptLoginMethod:"), error.message);
    global.GoatBot.stats.errors++;
    throw error; // Re-throw to handle in ensureAuthenticated
  }
}

// Express dashboard
let app, server;

// Session store for dashboard authentication
const dashboardSessions = new Map();

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function isValidSession(sessionId) {
  const session = dashboardSessions.get(sessionId);
  if (!session) return false;
  
  const now = Date.now();
  if (now - session.createdAt > (config.dashboard.sessionTimeout || 1800000)) {
    dashboardSessions.delete(sessionId);
    return false;
  }
  
  return true;
}

function requireAuth(req, res, next) {
  // Check for token-based auth first
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    const authTokens = global.GoatBot.authTokens || new Map();
    const tokenData = authTokens.get(token);
    
    if (tokenData && Date.now() <= tokenData.expiryTime) {
      req.user = { authenticated: true };
      return next();
    }
    
    // Token is invalid or expired
    if (tokenData) {
      authTokens.delete(token);
    }
  }
  
  // Fall back to session-based auth
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (!sessionId || !isValidSession(sessionId)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  next();
}

function initializeApp() {
  if (app) return app;
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "dashboard")));

  // Request OTP endpoint
  app.post('/api/auth/request-otp', async (req, res) => {
    try {
      if (!global.GoatBot.sock || !global.GoatBot.isConnected) {
        return res.status(503).json({ error: 'Bot is not connected to WhatsApp' });
      }

      const result = await OTPService.generateAndSendOTP(global.GoatBot.sock, config);
      
      res.json({
        success: true,
        message: 'OTP sent to admin(s)',
        expiryTime: result.expiryTime,
        sendResults: result.sendResults
      });
    } catch (error) {
      console.error('Error generating OTP:', error);
      res.status(500).json({ error: 'Failed to generate OTP' });
    }
  });

  // Verify OTP and login endpoint
  app.post('/api/auth/verify-otp', (req, res) => {
    try {
      const { otp } = req.body;
      
      if (!otp) {
        return res.status(400).json({ error: 'OTP is required' });
      }

      const verification = OTPService.verifyOTP('dashboard_login', otp);
      
      if (verification.success) {
        const sessionId = generateSessionId();
        dashboardSessions.set(sessionId, {
          createdAt: Date.now(),
          lastAccessed: Date.now()
        });
        
        res.json({
          success: true,
          sessionId,
          expiresIn: config.dashboard.sessionTimeout || 1800000
        });
      } else {
        res.status(401).json({ error: verification.error });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({ error: 'Failed to verify OTP' });
    }
  });

  // Legacy password login endpoint (kept for backward compatibility)
  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    
    if (password === config.dashboard.adminPassword) {
      const sessionId = generateSessionId();
      dashboardSessions.set(sessionId, {
        createdAt: Date.now(),
        lastAccessed: Date.now()
      });
      
      res.json({ 
        success: true, 
        sessionId,
        expiresIn: config.dashboard.sessionTimeout || 1800000
      });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  });

  // Get OTP status endpoint
  app.get('/api/auth/otp-status', (req, res) => {
    try {
      const status = OTPService.getOTPStatus('dashboard_login');
      res.json(status);
    } catch (error) {
      console.error('Error getting OTP status:', error);
      res.status(500).json({ error: 'Failed to get OTP status' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    if (sessionId) {
      dashboardSessions.delete(sessionId);
    }
    res.json({ success: true });
  });

  // Check session endpoint
  app.get('/api/auth/check', (req, res) => {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const valid = sessionId && isValidSession(sessionId);
    res.json({ valid });
  });

  // Token-based authentication endpoints
  app.post('/api/auth/request-otp', async (req, res) => {
    try {
      if (!global.GoatBot.sock || !global.GoatBot.isConnected) {
        return res.status(503).json({ 
          success: false, 
          message: 'Bot is not connected to WhatsApp' 
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiryTime = Date.now() + (5 * 60 * 1000); // 5 minutes
      
      // Store OTP globally (not per phone number)
      global.GoatBot.dashboardOTP = {
        otp,
        expiryTime,
        attempts: 0
      };

      // Get admin numbers from config
      const adminIds = config.admins || [];
      const sendResults = [];

      // Send OTP to all admins
      const message = `🔐 Dashboard Login Request\n\nOTP: ${otp}\n\nThis OTP will expire in 5 minutes.\n\nSomeone is trying to access the dashboard. If this wasn't you, please ignore this message.`;
      
      for (const adminId of adminIds) {
        try {
          await global.GoatBot.sock.sendMessage(adminId, { 
            text: message 
          });
          sendResults.push({ id: adminId, success: true });
        } catch (sendError) {
          console.error(`Error sending OTP to ${adminId}:`, sendError);
          sendResults.push({ id: adminId, success: false, error: sendError.message });
        }
      }

      const successCount = sendResults.filter(r => r.success).length;
      
      if (successCount > 0) {
        res.json({
          success: true,
          message: `OTP sent to ${successCount} admin(s)`,
          expiryTime: expiryTime,
          sendResults: sendResults
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send OTP to any admin' 
        });
      }
    } catch (error) {
      console.error('Error in request-otp:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  // Password login endpoint
  app.post('/api/auth/login-password', (req, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Password is required' 
        });
      }

      // Check password against config
      if (password !== config.dashboard.adminPassword) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid password' 
        });
      }

      // Generate token
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      global.GoatBot.authTokens = global.GoatBot.authTokens || new Map();
      global.GoatBot.authTokens.set(token, {
        createdAt: Date.now(),
        expiryTime,
        method: 'password'
      });

      res.json({
        success: true,
        token: token,
        expiryTime: expiryTime,
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Error in login-password:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    try {
      const { otp } = req.body;
      
      if (!otp) {
        return res.status(400).json({ 
          success: false, 
          message: 'OTP is required' 
        });
      }

      const otpData = global.GoatBot.dashboardOTP;
      
      if (!otpData) {
        return res.status(401).json({ 
          success: false, 
          message: 'OTP not found or expired' 
        });
      }

      // Check if OTP is expired
      if (Date.now() > otpData.expiryTime) {
        delete global.GoatBot.dashboardOTP;
        return res.status(401).json({ 
          success: false, 
          message: 'OTP expired' 
        });
      }

      // Check attempts
      if (otpData.attempts >= 3) {
        delete global.GoatBot.dashboardOTP;
        return res.status(401).json({ 
          success: false, 
          message: 'Too many failed attempts' 
        });
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        otpData.attempts++;
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid OTP' 
        });
      }

      // OTP is valid - generate token
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      global.GoatBot.authTokens = global.GoatBot.authTokens || new Map();
      global.GoatBot.authTokens.set(token, {
        createdAt: Date.now(),
        expiryTime
      });

      // Clean up OTP
      delete global.GoatBot.dashboardOTP;

      res.json({
        success: true,
        token: token,
        expiryTime: expiryTime,
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Error in verify-otp:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  app.get('/api/auth/verify', (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.json({ valid: false });
      }

      const authTokens = global.GoatBot.authTokens || new Map();
      const tokenData = authTokens.get(token);
      
      if (!tokenData) {
        return res.json({ valid: false });
      }

      // Check if token is expired
      if (Date.now() > tokenData.expiryTime) {
        authTokens.delete(token);
        return res.json({ valid: false });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error('Error in verify token:', error);
      res.json({ valid: false });
    }
  });

  // WhatsApp authentication endpoints
  app.post('/api/whatsapp/auth/request-code', requireAuth, async (req, res) => {
    try {
      if (global.GoatBot.isConnected) {
        return res.json({
          success: false,
          message: 'Bot is already connected to WhatsApp'
        });
      }

      // Start authentication process
      await global.GoatBot.startAuthentication();
      
      res.json({
        success: true,
        message: 'WhatsApp authentication started. Please scan the QR code or enter the pairing code.',
        qrCode: global.GoatBot.qrCode || null,
        pairingCode: global.GoatBot.pairingCode || null
      });
    } catch (error) {
      console.error('Error starting WhatsApp auth:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start WhatsApp authentication'
      });
    }
  });

  app.get('/api/whatsapp/auth/status', requireAuth, (req, res) => {
    try {
      res.json({
        connected: global.GoatBot.isConnected || false,
        connectionStatus: global.GoatBot.connectionStatus || 'disconnected',
        qrCode: global.GoatBot.qrCode || null,
        pairingCode: global.GoatBot.pairingCode || null,
        lastError: global.GoatBot.lastError || null
      });
    } catch (error) {
      console.error('Error getting WhatsApp auth status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get WhatsApp authentication status'
      });
    }
  });

  app.post('/api/whatsapp/auth/disconnect', requireAuth, async (req, res) => {
    try {
      if (global.GoatBot.sock) {
        await global.GoatBot.sock.logout();
      }
      
      global.GoatBot.isConnected = false;
      global.GoatBot.connectionStatus = 'disconnected';
      
      res.json({
        success: true,
        message: 'Disconnected from WhatsApp'
      });
    } catch (error) {
      console.error('Error disconnecting from WhatsApp:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect from WhatsApp'
      });
    }
  });

  app.post('/api/whatsapp/auth/restart', requireAuth, async (req, res) => {
    try {
      logger.info('🔄 Restarting WhatsApp authentication...');
      
      // Clear session files
      const sessionPath = path.join(__dirname, 'session');
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      
      // Close existing connection
      if (global.GoatBot.sock) {
        global.GoatBot.sock.end();
      }
      
      // Reset state
      global.GoatBot.isConnected = false;
      global.GoatBot.connectionStatus = 'disconnected';
      global.GoatBot.qrCode = null;
      global.GoatBot.waitingForAuth = true;
      
      // Start new authentication process
      setTimeout(async () => {
        try {
          await connect({ method: 'qr' });
        } catch (error) {
          logger.error('Error starting new authentication:', error);
        }
      }, 2000);
      
      res.json({
        success: true,
        message: 'WhatsApp authentication restarted. Please check the authentication tab for QR code.'
      });
    } catch (error) {
      console.error('Error restarting WhatsApp auth:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restart WhatsApp authentication'
      });
    }
  });

  // Public basic status endpoint (no auth required)
  app.get('/api/status/basic', (req, res) => {
    try {
      res.json({
        status: global.GoatBot.connectionStatus,
        isConnected: global.GoatBot.isConnected,
        uptime: Date.now() - global.GoatBot.startTime,
        initialized: global.GoatBot.initialized,
        botName: global.GoatBot.user?.name || config.botName || "GoatBot",
        authRequired: true
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Protected status endpoint
  app.get("/api/status", requireAuth, async (req, res) => {
    try {
      const dbStats = await db.getStats();
      const uptime = Date.now() - global.GoatBot.startTime;
      
      res.json({
        status: global.GoatBot.connectionStatus,
        isConnected: global.GoatBot.isConnected,
        uptime: uptime,
        uptimeFormatted: formatUptime(uptime),
        stats: global.GoatBot.stats,
        commands: Array.from(global.GoatBot.commands.keys()),
        events: Array.from(global.GoatBot.events.keys()),
        authMethod: global.GoatBot.authMethod,
        sessionValid: global.GoatBot.sessionValid,
        initialized: global.GoatBot.initialized,
        botInfo: {
          name: global.GoatBot.user?.name || config.botName || "GoatBot",
          number: global.GoatBot.user?.id?.split(":")[0] || "Not available",
          prefix: config.prefix,
          version: require("./package.json").version
        },
        database: {
          type: config.database.type,
          stats: dbStats
        },
        system: {
          platform: process.platform,
          nodeVersion: process.version,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Protected commands endpoint
  app.get("/api/commands", requireAuth, (req, res) => {
    try {
      let commands = [];
      
      if (global.GoatBot?.commands) {
        // Get commands from global.GoatBot.commands
        commands = Array.from(global.GoatBot.commands.entries()).map(([name, cmd]) => ({
          name,
          description: cmd.config?.description || cmd.description || "No description available",
          aliases: cmd.config?.aliases || cmd.aliases || [],
          category: cmd.config?.category || cmd.category || "general",
          permissions: cmd.config?.permissions || cmd.permissions || [],
          cooldown: cmd.config?.cooldown || cmd.cooldown || 0,
          usage: cmd.config?.usage || cmd.usage || `${config.prefix}${name}`,
          guide: cmd.config?.guide || cmd.guide || "No guide available"
        }));
      } else {
        // Fallback: read from files
        const commandFiles = fs.readdirSync('./plugins/commands').filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
          try {
            const command = require(`./plugins/commands/${file}`);
            commands.push({
              name: command.config?.name || file.replace('.js', ''),
              description: command.config?.description || 'No description available',
              usage: command.config?.usage || 'N/A',
              category: command.config?.category || 'General',
              role: command.config?.role || 0,
              enabled: command.config?.enabled !== false
            });
          } catch (error) {
            logger.error(`Error loading command ${file}:`, error);
          }
        }
      }
      
      res.json({ 
        total: commands.length,
        commands: commands
      });
    } catch (error) {
      logger.error('Error fetching commands:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Protected events endpoint
  app.get("/api/events", requireAuth, (req, res) => {
    const events = Array.from(global.GoatBot.events.entries()).map(([name, event]) => ({
      name,
      description: event.config?.description || event.description || "No description available",
      type: event.config?.type || event.type || "message"
    }));
    
    res.json(events);
  });

  // Protected logs endpoint
  app.get("/api/logs", requireAuth, (req, res) => {
    try {
      // Get logs from global GoatBot logs array
      const logs = global.GoatBot.logs || [];
      const recentLogs = logs.slice(-100); // Last 100 log entries
      res.json({ logs: recentLogs });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Protected users endpoint
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await db.getAllUsers();
      const users = Array.isArray(allUsers) ? allUsers : Object.values(allUsers || {});
      
      const totalUsers = users.length;
      const activeUsers = users.filter(user => user && user.isActive !== false).length;
      const bannedUsers = users.filter(user => user && user.banned === true).length;
      
      res.json({
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        users: users.map(user => ({
          id: user.id,
          name: user.name || 'Unknown',
          messageCount: user.messageCount || 0,
          exp: user.exp || 0,
          level: user.level || 1,
          banned: user.banned || false,
          role: user.role || 0,
          lastSeen: user.lastSeen || null
        }))
      });
    } catch (error) {
      logger.error('Error fetching users:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Protected groups endpoint
  app.get("/api/groups", requireAuth, async (req, res) => {
    try {
      const allThreads = await db.getAllThreads();
      const threads = Array.isArray(allThreads) ? allThreads : Object.values(allThreads || {});
      const groups = threads.filter(thread => thread && thread.isGroup);
      
      const totalGroups = groups.length;
      const activeGroups = groups.filter(group => group && group.isActive !== false).length;
      
      res.json({
        total: totalGroups,
        active: activeGroups,
        groups: groups.map(group => ({
          id: group.id,
          name: group.name || 'Unknown Group',
          memberCount: group.memberCount || 0,
          messageCount: group.messageCount || 0,
          isActive: group.isActive !== false,
          settings: group.settings || {},
          createdAt: group.createdAt || null
        }))
      });
    } catch (error) {
      logger.error('Error fetching groups:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Protected system stats endpoint
  app.get("/api/system", requireAuth, (req, res) => {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      res.json({
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        platform: process.platform,
        architecture: os.arch(),
        nodeVersion: process.version,
        pid: process.pid,
        loadAverage: os.loadavg()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bot info endpoint
  app.get("/api/bot/info", requireAuth, async (req, res) => {
    try {
      const formatUptime = (seconds) => {
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
      };
      
      const getCommandCount = () => {
        try {
          const commandFiles = fs.readdirSync('./plugins/commands').filter(file => file.endsWith('.js'));
          return commandFiles.length;
        } catch (error) {
          return 0;
        }
      };
      
      const getEventCount = () => {
        try {
          const eventFiles = fs.readdirSync('./plugins/events').filter(file => file.endsWith('.js'));
          return eventFiles.length;
        } catch (error) {
          return 0;
        }
      };
      
      const getAdminCount = async () => {
        try {
          const users = await db.getAllUsers();
          const userArray = Array.isArray(users) ? users : Object.values(users || {});
          return userArray.filter(user => user && user.role >= 2).length;
        } catch (error) {
          return 0;
        }
      };
      
      const botInfo = {
        name: "Goat Bot",
        version: "1.0.0",
        status: "Online",
        uptime: formatUptime(process.uptime()),
        commandsLoaded: getCommandCount(),
        eventsLoaded: getEventCount(),
        lastRestart: global.GoatBot?.startTime || new Date().toISOString(),
        adminUsers: await getAdminCount()
      };
      
      res.json(botInfo);
    } catch (error) {
      logger.error('Error fetching bot info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Analytics endpoint
  app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
      const stats = global.GoatBot.stats || {};
      const uptime = Date.now() - (global.GoatBot.startTime || Date.now());
      
      // Get user statistics
      const users = await db.getAllUsers();
      const userArray = Array.isArray(users) ? users : Object.values(users || {});
      
      // Get group statistics (threads are groups)
      const threads = await db.getAllThreads();
      const threadArray = Array.isArray(threads) ? threads : Object.values(threads || {});
      
      // Calculate analytics
      const analytics = {
        overview: {
          totalUsers: userArray.length,
          activeUsers: userArray.filter(user => user && user.lastActive && 
            (Date.now() - user.lastActive) < 7 * 24 * 60 * 60 * 1000).length,
          totalGroups: threadArray.length,
          activeGroups: threadArray.filter(thread => thread && thread.lastActive && 
            (Date.now() - thread.lastActive) < 7 * 24 * 60 * 60 * 1000).length,
          totalMessages: stats.totalMessages || 0,
          commandsExecuted: stats.commandsExecuted || 0,
          uptime: uptime
        },
        messagesToday: stats.messagesToday || 0,
        commandsUsed: stats.commandsUsed || 0,
        activeSessions: (global.GoatBot.authTokens?.size || 0) + (dashboardSessions?.size || 0),
        topCommands: stats.topCommands || [],
        userGrowth: {
          daily: stats.dailyUserGrowth || 0,
          weekly: stats.weeklyUserGrowth || 0,
          monthly: stats.monthlyUserGrowth || 0
        },
        messageStats: {
          textMessages: stats.textMessages || 0,
          mediaMessages: stats.mediaMessages || 0,
          stickerMessages: stats.stickerMessages || 0
        }
      };
      
      res.json(analytics);
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Settings endpoint
  app.get("/api/settings", requireAuth, (req, res) => {
    try {
      const settings = {
        botName: config.botName || "Goat Bot",
        prefix: config.prefix || ".",
        adminOnly: config.adminOnly || false,
        autoRestart: config.autoRestart || false,
        logLevel: config.logLevel || "info",
        database: {
          type: config.database.type || "json",
          connected: global.GoatBot.databaseConnected || false
        },
        dashboard: {
          enabled: config.dashboard.enabled || true,
          port: config.dashboard.port || 3000,
          sessionTimeout: config.dashboard.sessionTimeout || 1800000
        },
        features: {
          antiSpam: config.features?.antiSpam || false,
          autoReply: config.features?.autoReply || false,
          welcome: config.features?.welcome || true,
          antiLink: config.features?.antiLink || false
        },
        permissions: {
          adminNumbers: config.dashboard.adminNumbers || [],
          allowedGroups: config.allowedGroups || [],
          bannedUsers: config.bannedUsers || []
        }
      };
      
      res.json(settings);
    } catch (error) {
      logger.error('Error fetching settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Analytics overview endpoint
  app.get("/api/analytics/overview", requireAuth, async (req, res) => {
    try {
      const stats = global.GoatBot.stats || {};
      const uptime = Date.now() - (global.GoatBot.startTime || Date.now());
      
      const overview = {
        totalMessages: stats.totalMessages || 0,
        messagesToday: stats.messagesToday || 0,
        commandsUsed: stats.commandsUsed || 0,
        activeSessions: (global.GoatBot.authTokens?.size || 0) + (dashboardSessions?.size || 0),
        uptime: uptime,
        errorCount: stats.errors || 0,
        successRate: stats.successRate || 100
      };
      
      res.json(overview);
    } catch (error) {
      logger.error('Error fetching analytics overview:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/restart", requireAuth, (_, res) => {
    res.json({ message: "Forcing auth re-initialisation…" });
    invalidateSessionAndRestart();
  });

  app.get("/", (_, res) => res.sendFile(path.join(__dirname, "dashboard", "index.html")));
  return app;
}

function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function startServer() {
  if (server) return;
  const PORT = process.env.PORT || config.dashboard.port || 3000;
  const app = initializeApp();
  server = app.listen(PORT, () =>
    logger.info(`📊 Dashboard available at http://localhost:${PORT}`)
  );

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      logger.error(`❌ Port ${PORT} is already in use.`);
      process.exit(1);
    }
    logger.error("❌ Server error:", error);
  });
}

// Database
async function connectDatabase() {
  try {
    await db.connect(config.database);
    // logger.info("✅ Database connected successfully.");
    return true;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    global.GoatBot.stats.errors++;
    return false;
  }
}

// Auth-aware connection logic

async function ensureAuthenticated() {
  const sessionPath = path.join(__dirname, "session");

  // Check and create session folder silently
  try {
    if (!(await fs.pathExists(sessionPath))) {
      await fs.mkdir(sessionPath);
      global.GoatBot.sessionValid = false;
      global.GoatBot.connectionStatus = "awaiting-login";
      global.GoatBot.authMethod = await promptLoginMethod();
    }
  } catch (error) {
    // Log to console for debugging, bypassing silent mode
    console.error(chalk.red("❌ Failed to create session folder:"), error.message);
    global.GoatBot.stats.errors++;
    // Instead of restarting, retry authentication
    global.GoatBot.connectionStatus = "awaiting-login";
    global.GoatBot.authMethod = await promptLoginMethod();
  }

  while (true) {
    try {
      global.GoatBot.connectionStatus = "connecting";
      await connect({ method: global.GoatBot.authMethod });
      global.GoatBot.isConnected = true;
      global.GoatBot.sessionValid = true;
      global.GoatBot.connectionStatus = "connected";
      restartAttempts = 0; // Reset restart attempts on success
      return;
    } catch (err) {
      // Log error to console for debugging, bypassing silent mode
      console.error(chalk.red("❌ Connection error:"), err.message);
      global.GoatBot.stats.errors++;
      if (err === AUTH_ERROR || err.message === "Session expired") {
        global.GoatBot.isConnected = false;
        global.GoatBot.sessionValid = false;
        global.GoatBot.connectionStatus = "awaiting-login";
        global.GoatBot.authMethod = await promptLoginMethod();
      } else {
        if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
          console.error(
            chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`)
          );
          process.exit(1);
        }
        restartAttempts++;
        console.error(
          chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`)
        );
        gracefulRestart();
      }
    }
  }
}

function invalidateSessionAndRestart() {
  global.GoatBot.sessionValid = false;
  global.GoatBot.authMethod = null;
  global.GoatBot.connectionStatus = "awaiting-login";
  logger.warn("🔄 Session invalidated by request – restarting auth flow…");
  ensureAuthenticated().catch((e) => {
    console.error(chalk.red("❌ ensureAuthenticated failed after manual restart:"), e.message);
    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
      console.error(
        chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`)
      );
      process.exit(1);
    }
    restartAttempts++;
    console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
    gracefulRestart();
  });
}

function gracefulRestart() {
  console.log(
    chalk.yellow(
      `🔄 Initiating graceful restart (attempt ${restartAttempts + 1}/${MAX_RESTART_ATTEMPTS}) …`
    )
  );
  if (server) {
    server.close(() => console.log(chalk.yellow("🔌 Server closed.")));
  }
  process.exit(2);
}

function watchPlugins() {
  const pluginPath = path.join(__dirname, "plugins");
  const watcher = chokidar.watch(pluginPath, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on("add", (filePath) => {
    // Only process .js files
    if (!filePath.endsWith('.js')) return;
    
    logger.info(`➕ New file detected: ${path.basename(filePath)}`);
    if (filePath.includes("commands")) {
      loadCommand(filePath, logger);
    } else if (filePath.includes("events")) {
      loadEvent(filePath, logger);
    }
  });

  watcher.on("change", (filePath) => {
    // Only process .js files
    if (!filePath.endsWith('.js')) return;
    
    logger.info(`✏️ File changed: ${path.basename(filePath)}`);
    if (filePath.includes("commands")) {
      unloadCommand(filePath, logger);
      loadCommand(filePath, logger);
    } else if (filePath.includes("events")) {
      unloadEvent(filePath, logger);
      loadEvent(filePath, logger);
    }
  });

  watcher.on("unlink", (filePath) => {
    // Only process .js files
    if (!filePath.endsWith('.js')) return;
    
    logger.info(`🗑️ File deleted: ${path.basename(filePath)}`);
    if (filePath.includes("commands")) {
      unloadCommand(filePath, logger);
    } else if (filePath.includes("events")) {
      unloadEvent(filePath, logger);
    }
  });

  logger.info("👀 Watching for plugin changes...");
}

async function start() {
  // Run session cleanup before starting
  // try {
  //   const { SessionCleaner } = require("./utils/sessionCleaner");
  //   const sessionCleaner = new SessionCleaner();
  //   await sessionCleaner.cleanCorruptedSessions();
  // } catch (error) {
  //   logger.warn("⚠️ Session cleanup failed:", error.message);
  // }
  
  // Defer database connection and dashboard start until after authentication
  await ensureAuthenticated();

  // Connect database
  if (!(await connectDatabase())) process.exit(1);
  
  // Store database in global object for access from other modules
  global.GoatBot.db = db;
  
  // Socket is already set in connect function, don't override it

  // Restore logger level after authentication
  logger.setLevel(originalLoggerLevel);

  // Load plugins first, then print summary
  await loadPlugins(logger);
  
  await printStartupSummary();

  // Auto-sync data after everything is initialized
  if (global.GoatBot.isConnected) {
    const SyncManager = require("./libs/syncManager");
    logger.info("🔄 Starting data sync...");
    
    try {
      // We need to get the socket from somewhere - let's store it in global
      if (global.GoatBot.sock) {
        const syncResult = await SyncManager.syncAllGroups(global.GoatBot.sock, global.GoatBot.db, logger);
        logger.info(`✅ Sync completed: ${syncResult.syncedGroups} groups, ${syncResult.syncedUsers} users`);
      }
    } catch (error) {
      logger.error("❌ Sync failed:", error);
    }
  }

  watchPlugins();

  // Start dashboard
  startServer();

  // Flag ready
  global.GoatBot.initialized = true;

  logger.info(chalk.yellow("" + "=".repeat(50)));
  logger.info(chalk.green("🎉 Bot is now online and ready to use!"));
  logger.info(chalk.yellow("=".repeat(50)));
}

async function printStartupSummary() {
  const { user, commands, events } = global.GoatBot;
  const botName = user.name || config.botName || "GoatBot";
  const botNumber = user.id?.split(":")[0] || "Not available";
  const dbStats = await db.getStats();

  logger.info(chalk.yellow("" + "=".repeat(50)));
  logger.info(chalk.cyan.bold(`           🐐 GOAT BOT INITIALIZED 🐐`));
  logger.info(chalk.yellow("=".repeat(50)));

  logger.info(chalk.white(`- Bot Name:     ${chalk.green(botName)}`));
  logger.info(chalk.white(`- Bot Number:   ${chalk.green(botNumber)}`));
  logger.info(chalk.white(`- Prefix:       ${chalk.green(config.prefix)}`));
  logger.info(chalk.white(`- Database:     ${chalk.green(config.database.type)}`));
  logger.info(chalk.white(`- DB Entries:   ${chalk.green(dbStats.total || dbStats.entries || 0)}`));

  logger.info(chalk.yellow("=".repeat(50)));
}

start().catch((err) => {
  console.error(chalk.red("❌ Unexpected top-level failure:"), err.message);
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
    process.exit(1);
  }
  restartAttempts++;
  console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
  gracefulRestart();
});

process.on("SIGINT", () => {
  logger.info("📴 Received SIGINT – shutting down gracefully …");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("📴 Received SIGTERM – shutting down gracefully …");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error(chalk.red("💥 Uncaught Exception:"), error.message);
  global.GoatBot.stats.errors++;
  
  // Handle YouTube download errors
  if (error.message?.includes("youtube-dl-exec") || error.message?.includes("yt-dlp")) {
    console.error(chalk.yellow("🎬 YouTube download error detected, continuing..."));
    return; // Don't restart for YouTube errors
  }
  
  // Handle session-related errors
  if (error.message?.includes("Bad MAC") || error.message?.includes("session") || error.message?.includes("decrypt")) {
    console.error(chalk.red("🔑 Session error detected, clearing session and restarting..."));
    
    // Clear session files
    const fs = require("fs-extra");
    const path = require("path");
    const sessionPath = path.join(__dirname, "session");
    
    fs.remove(sessionPath).then(() => {
      console.log(chalk.yellow("✅ Session files cleared"));
      process.exit(2); // Exit with restart code
    }).catch(() => {
      process.exit(2); // Exit with restart code anyway
    });
    
    return;
  }
  
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
    process.exit(1);
  }
  restartAttempts++;
  console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
  gracefulRestart();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    chalk.red("💥 Unhandled Rejection at:"),
    promise,
    "reason:",
    reason.message || reason
  );
  global.GoatBot.stats.errors++;
  
  // Handle session-related errors
  if (reason.message?.includes("Bad MAC") || reason.message?.includes("session") || reason.message?.includes("decrypt")) {
    console.error(chalk.red("🔑 Session error detected, clearing session and restarting..."));
    
    // Clear session files
    const fs = require("fs-extra");
    const path = require("path");
    const sessionPath = path.join(__dirname, "session");
    
    fs.remove(sessionPath).then(() => {
      console.log(chalk.yellow("✅ Session files cleared"));
      process.exit(2); // Exit with restart code
    }).catch(() => {
      process.exit(2); // Exit with restart code anyway
    });
    
    return;
  }
  
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(chalk.red(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Exiting.`));
    process.exit(1);
  }
  restartAttempts++;
  console.error(chalk.yellow(`⚠️ Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`));
  gracefulRestart();
});
