const JSConfuser = require("js-confuser");
const { readFile, writeFile } = require("fs/promises");
const path = require("path");

/**
 * @description An array of file paths to be obfuscated.
 * The script expects filenames to contain '.dev.js'.
 * Example: 'src/feature.dev.js' -> 'src/feature.js'
 * @type {string[]}
 */
const filesToObfuscate = ["bot/auth.dev.js", "bot/connect.dev.js"];

/**
 * @description js-confuser configuration for maximum protection.
 * These settings are chosen to make deobfuscation extremely difficult,
 * though they may impact performance.
 */
const obfuscationOptions = {
  target: "node",
  preset: "high", // Use the strongest preset

  // Ensures all possible control flow paths are flattened into a switch statement
  controlFlowFlattening: 1,

  // Hides global variables
  globalConcealing: true,

  // Encrypts all strings with RC4 encryption for strong protection
  stringConcealing: {
    mode: "rc4",
  },

  // Splits all strings into smaller parts
  stringSplitting: 1,

  // Injects a high amount of dead code to confuse analysis
  deadCode: 1,

  // Replaces numeric/string literals with complex expressions
  calculator: true,

  // Renames all possible variables and functions, including at the top scope
  renameGlobals: true,

  // Extracts object properties and places them into a separate, shuffled array
  objectExtraction: true,

  // Shuffles declarations around to obscure the original structure
  shuffle: {
    declarations: true,
    initializers: true,
  },
};

/**
 * @description Main function to process and obfuscate the files.
 */
async function obfuscateFiles() {
  console.log("Starting obfuscation process... 🛡️");

  for (const filePath of filesToObfuscate) {
    try {
      // 1. Validate file naming convention
      if (!filePath.includes(".dev.")) {
        console.warn(
          `⚠️  Warning: File '${filePath}' does not contain '.dev.' and will be skipped for renaming.`
        );
        // You could still obfuscate it and overwrite the original if needed,
        // but based on the prompt, we'll just show a warning.
        continue;
      }

      const inputPath = path.resolve(filePath);
      const outputPath = path.resolve(filePath.replace(".dev.js", ".js"));

      // 2. Read the source file
      console.log(`-> Reading: ${inputPath}`);
      const sourceCode = await readFile(inputPath, "utf8");

      // 3. Obfuscate the code
      console.log(`   Obfuscating...`);
      const obfuscationResult = await JSConfuser.obfuscate(
        sourceCode,
        obfuscationOptions
      );

      // 4. Write the obfuscated code to the new file
      await writeFile(outputPath, obfuscationResult.code);
      console.log(`✅  Success! Saved to: ${outputPath}\n`);
    } catch (error) {
      console.error(`❌ Error processing file '${filePath}':`, error.message);
    }
  }

  console.log("Obfuscation process completed. ✨");
}

// Execute the function
obfuscateFiles();
