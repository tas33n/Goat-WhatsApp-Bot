const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

class ModuleManager {
  constructor() {
    this.packagePath = path.join(process.cwd(), "package.json");
    this.installedModules = new Set();
    this.failedModules = new Set();
  }

  /**
   * Check if a module is installed
   * @param {string} moduleName - Name of the module to check
   * @returns {boolean} True if module is installed
   */
  isModuleInstalled(moduleName) {
    try {
      require.resolve(moduleName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Install a module using npm
   * @param {string} moduleName - Name of the module to install
   * @param {boolean} isDev - Whether to install as dev dependency
   * @returns {Promise<boolean>} Success status
   */
  async installModule(moduleName, isDev = false) {
    return new Promise((resolve, reject) => {
      const command = isDev ? 
        `npm install --save-dev ${moduleName}` : 
        `npm install ${moduleName}`;

      console.log(`📦 Installing module: ${moduleName}...`);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Failed to install ${moduleName}:`, error.message);
          this.failedModules.add(moduleName);
          resolve(false);
        } else {
          console.log(`✅ Successfully installed ${moduleName}`);
          this.installedModules.add(moduleName);
          resolve(true);
        }
      });
    });
  }

  /**
   * Auto-install missing modules from a list of required modules
   * @param {string[]} requiredModules - Array of module names to check and install
   * @returns {Promise<object>} Object with success and failed module lists
   */
  async autoInstallModules(requiredModules) {
    const missingModules = [];
    const results = {
      success: [],
      failed: [],
      alreadyInstalled: []
    };

    // Check which modules are missing
    for (const moduleName of requiredModules) {
      if (!this.isModuleInstalled(moduleName)) {
        missingModules.push(moduleName);
      } else {
        results.alreadyInstalled.push(moduleName);
      }
    }

    if (missingModules.length === 0) {
      console.log("✅ All required modules are already installed");
      return results;
    }

    console.log(`🔍 Found ${missingModules.length} missing modules: ${missingModules.join(", ")}`);

    // Install missing modules
    for (const moduleName of missingModules) {
      try {
        const success = await this.installModule(moduleName);
        if (success) {
          results.success.push(moduleName);
        } else {
          results.failed.push(moduleName);
        }
      } catch (error) {
        console.error(`❌ Error installing ${moduleName}:`, error);
        results.failed.push(moduleName);
      }
    }

    return results;
  }

  /**
   * Check and install modules required by a specific command file
   * @param {string} commandPath - Path to the command file
   * @returns {Promise<boolean>} Success status
   */
  async checkCommandDependencies(commandPath) {
    try {
      const content = fs.readFileSync(commandPath, "utf8");
      const requiredModules = [];

      // Extract require statements
      const requireRegex = /require\s*\(\s*['"](.*?)['"]\s*\)/g;
      let match;

      while ((match = requireRegex.exec(content)) !== null) {
        const moduleName = match[1];
        
        // Skip local modules (starting with ./ or ../)
        if (!moduleName.startsWith(".") && !moduleName.startsWith("/")) {
          // Skip built-in Node.js modules
          const builtInModules = [
            "fs", "path", "os", "crypto", "url", "util", "events", "stream",
            "buffer", "child_process", "cluster", "dgram", "dns", "domain",
            "http", "https", "net", "punycode", "querystring", "readline",
            "repl", "tls", "tty", "vm", "zlib", "assert", "constants",
            "module", "process", "timers", "console", "string_decoder"
          ];
          
          if (!builtInModules.includes(moduleName)) {
            requiredModules.push(moduleName);
          }
        }
      }

      if (requiredModules.length > 0) {
        // Only show checking message if modules are missing
        const missingModules = [];
        for (const moduleName of requiredModules) {
          if (!this.isModuleInstalled(moduleName)) {
            missingModules.push(moduleName);
          }
        }
        
        if (missingModules.length > 0) {
          console.log(`🔍 Installing missing dependencies for ${path.basename(commandPath)}: ${missingModules.join(", ")}`);
          const results = await this.autoInstallModules(requiredModules);
          
          if (results.failed.length > 0) {
            console.error(`❌ Failed to install some modules for ${path.basename(commandPath)}: ${results.failed.join(", ")}`);
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error(`❌ Error checking dependencies for ${commandPath}:`, error);
      return false;
    }
  }

  /**
   * Scan all command files and auto-install missing dependencies
   * @returns {Promise<boolean>} Success status
   */
  async scanAndInstallAllDependencies() {
    const commandsPath = path.join(process.cwd(), "plugins", "commands");
    const eventsPath = path.join(process.cwd(), "plugins", "events");
    
    const allFiles = [];
    
    try {
      // Scan command files
      if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
        allFiles.push(...commandFiles.map(file => path.join(commandsPath, file)));
      }
      
      // Scan event files
      if (fs.existsSync(eventsPath)) {
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
        allFiles.push(...eventFiles.map(file => path.join(eventsPath, file)));
      }
      
      console.log(`🔍 Scanning ${allFiles.length} plugin files for dependencies...`);
      
      let allSuccess = true;
      for (const filePath of allFiles) {
        const success = await this.checkCommandDependencies(filePath);
        if (!success) {
          allSuccess = false;
        }
      }
      
      return allSuccess;
    } catch (error) {
      console.error("❌ Error scanning plugin dependencies:", error);
      return false;
    }
  }

  /**
   * Get installation statistics
   * @returns {object} Statistics object
   */
  getStats() {
    return {
      installed: Array.from(this.installedModules),
      failed: Array.from(this.failedModules),
      installedCount: this.installedModules.size,
      failedCount: this.failedModules.size
    };
  }
}

module.exports = ModuleManager;
