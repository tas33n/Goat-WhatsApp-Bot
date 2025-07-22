const fs = require("fs-extra");
const path = require("path");
const DataUtils = require("../../libs/dataUtils");

module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "h", "commands", "cmd"],
    version: "1.18",
    author: "@anbuinfosec",
    countDown: 5,
    role: 0,
    shortDescription: {
      vi: "Xem cách dùng lệnh",
      en: "View command usage",
    },
    longDescription: {
      vi: "Xem cách sử dụng của các lệnh",
      en: "View command usage",
    },
    category: "info",
    guide: {
      vi:
        "   {pn} [để trống | <số trang> | <tên lệnh>]" +
        "\n   {pn} <command name> [-u | usage | -g | guide]: chỉ hiển thị phần hướng dẫn sử dụng lệnh" +
        "\n   {pn} <command name> [-i | info]: chỉ hiển thị phần thông tin về lệnh" +
        "\n   {pn} <command name> [-r | role]: chỉ hiển thị phần quyền hạn của lệnh" +
        "\n   {pn} <command name> [-a | alias]: chỉ hiển thị phần tên viết tắt của lệnh",
      en:
        "{pn} [empty | <page number> | <command name>]" +
        "\n   {pn} <command name> [-u | usage | -g | guide]: only show command usage" +
        "\n   {pn} <command name> [-i | info]: only show command info" +
        "\n   {pn} <command name> [-r | role]: only show command role" +
        "\n   {pn} <command name> [-a | alias]: only show command alias",
    },
    priority: 1,
  },

  langs: {
    en: {
      help:
        "%1𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖⧕\nCurrently, the bot has %2 commands that can be used\n» Type %3help <command name> to view the details of how to use that command\n» %4\n𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖⧕",
      commandNotFound: 'დ Command "%1" does not exist',
      getInfoCommand:
        "➟ Name: %1\n➟ Aliases: %2\n➟ Version: %3\n➟ Role: %4\n➟ Info: %5\n╭───── Guide ⭔\n╰ ◈ %6",
      onlyInfo:
        "╭─── Help Menu ⭔\n╰ ◈ Name: %1\n╰ ◈ Aliases: %2\n╰ ◈ Version %3\n╰ ◈ Role: %4\n╰ ◈ Info: %5\n",
      onlyUsage: "𝄖𝄖𝄖𝄖𝄖⌜Usage⌟𝄖𝄖𝄖𝄖𝄖⧕\nდ %1\n𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖𝄖⧕",
      onlyAlias:
        "╭───── ALIAS ⭔\n╰ ◈ Other names: %1\n╰ ◈ Other names in your group: %2",
      onlyRole: "╭───── ROLE ⭔\n╰ ◈ Role: %1",
      doNotHave: "Not provided!",
      roleText0: "0 (All users)",
      roleText1: "1 (Group admins)",
      roleText2: "2 (Bot admin)",
      roleText0setRole: "0 (set role, all users)",
      roleText1setRole: "1 (set role, group administrators)",
      pageNotFound: "Page %1 does not exist",
    },
  },

  onCmd: async function ({ api, message, args, db, logger, config, reply, event }) {
    try {
      console.log(event)
      const senderJid = event.senderID;
      const threadID = event.threadID;
      const { isAdmin } = require("../../libs/utils");
      const role = isAdmin(senderJid, config) ? 2 : 0;
      const prefix = config.prefix;
      const nickNameBot = config.botName || "GoatBot";
      
      const commands = global.GoatBot.commands;
      const aliases = global.GoatBot.aliases;
      
      const commandName = (args[0] || "").toLowerCase();
      const command = commands.get(commandName) || commands.get(aliases.get(commandName));

      // Helper function to get language strings
      const getLang = (key, ...params) => {
        let text = this.langs.en[key] || key;
        params.forEach((param, index) => {
          text = text.replace(new RegExp(`%${index + 1}`, 'g'), param);
        });
        return text;
      };

      // Check if user is banned
      const userData = await DataUtils.getUser(senderJid);
      if (userData.banned) {
        return reply(`🚫 You are banned from using this bot.\n\nReason: ${userData.banReason || "No reason provided"}\nBan Date: ${userData.banDate ? new Date(userData.banDate).toLocaleString() : "Unknown"}`);
      }

      // Check user warnings
      if (userData.warnings >= 3) {
        return reply(`⚠️ You have ${userData.warnings} warnings. Please be careful with your behavior.`);
      }

      // ———————————————— LIST ALL COMMAND ——————————————— //
      if ((!command && !args[0]) || !isNaN(args[0])) {
        const arrayInfo = [];
        let msg = "";

        for (const [, value] of commands) {
          if (value.config.role > 1 && role < value.config.role) continue; // if role of command > role of user => skip
          const indexCategory = arrayInfo.findIndex(
            (item) =>
              (item.category || "NO CATEGORY") ==
              (value.config.category?.toLowerCase() || "NO CATEGORY")
          );

          if (indexCategory != -1)
            arrayInfo[indexCategory].names.push(value.config.name);
          else
            arrayInfo.push({
              category: value.config.category?.toLowerCase() || "NO CATEGORY",
              names: [value.config.name],
            });
        }
        arrayInfo.sort((a, b) => (a.category < b.category ? -1 : 1));
        arrayInfo.forEach((data, index) => {
          const categoryUpcase = `${
            index == 0 ? `╭` : `╭──`
          }─── ${data.category.toUpperCase()} ${index == 0 ? "⭓" : "⭔"}`;
          data.names = data.names.sort().map((item) => (item = `╰ ◈ ${item}`));
          msg += `${categoryUpcase}\n${data.names.join("\n")}\n`;
        });
        
        // Get user's name for the help message
        const userName = userData.name || "User";
        const userGreeting = `Hello ${userName}! 👋\n\n`;
        
        const helpMessage = getLang("help", userGreeting + msg, commands.size, prefix, nickNameBot);
        const msgSend = await reply(helpMessage);
        
        // Auto-delete after 3 minutes
        setTimeout(async () => {
          try {
            if (msgSend && msgSend.key) {
              await api.sendMessage(threadID, { delete: msgSend.key });
            }
          } catch (error) {
            console.log("Error deleting message:", error);
          }
        }, 180000);
      }
      // ———————————— COMMAND DOES NOT EXIST ———————————— //
      else if (!command && args[0]) {
        return reply(getLang("commandNotFound", args[0]));
      }
      // ————————————————— INFO COMMAND ————————————————— //
      else {
        const configCommand = command.config;

        let guide = configCommand.guide?.en || configCommand.guide || "No guide provided";
        if (typeof guide == "string") guide = { body: guide };
        const guideBody = guide.body
          .replace(/\{prefix\}|\{p\}/g, prefix)
          .replace(/\{name\}|\{n\}/g, configCommand.name)
          .replace(/\{pn\}/g, prefix + configCommand.name);

        const aliasesString = configCommand.aliases
          ? configCommand.aliases.join(", ")
          : getLang("doNotHave");
        const aliasesThisGroup = getLang("doNotHave"); // Can be expanded for group-specific aliases

        let roleOfCommand = configCommand.role;
        const roleText =
          roleOfCommand == 0
            ? getLang("roleText0")
            : roleOfCommand == 1
            ? getLang("roleText1")
            : getLang("roleText2");

        const description = configCommand.description || configCommand.longDescription?.en || getLang("doNotHave");

        let formSendMessage = {};
        let sendWithAttachment = false;

        if (args[1]?.match(/^-g|guide|-u|usage$/)) {
          formSendMessage.body = getLang(
            "onlyUsage",
            guideBody.split("\n").join("\n╰ ◈  ")
          );
          sendWithAttachment = true;
        } else if (args[1]?.match(/^-a|alias|aliase|aliases$/)) {
          formSendMessage.body = getLang(
            "onlyAlias",
            aliasesString,
            aliasesThisGroup
          );
        } else if (args[1]?.match(/^-r|role$/)) {
          formSendMessage.body = getLang("onlyRole", roleText);
        } else if (args[1]?.match(/^-i|info$/)) {
          formSendMessage.body = getLang(
            "onlyInfo",
            configCommand.name,
            aliasesString,
            configCommand.version || "1.0.0",
            roleText,
            description
          );
        } else {
          formSendMessage.body = getLang(
            "getInfoCommand",
            configCommand.name,
            aliasesString,
            configCommand.version || "1.0.0",
            roleText,
            description,
            guideBody.split("\n").join("\n╰ ◈ ")
          );
          sendWithAttachment = true;
        }

        const msgSend = await reply(formSendMessage.body);
        
        // Auto-delete after 3 minutes
        setTimeout(async () => {
          try {
            if (msgSend && msgSend.key) {
              await api.sendMessage(threadID, { delete: msgSend.key });
            }
          } catch (error) {
            console.log("Error deleting message:", error);
          }
        }, 180000);
      }
    } catch (error) {
      logger.error("Error in help command:", error);
      await reply("❌ An error occurred while generating the help message.");
    }
  }
};

function checkLangObject(data, langCode) {
  if (typeof data == "string") return data;
  if (typeof data == "object" && !Array.isArray(data))
    return data[langCode] || data.en || undefined;
  return undefined;
}

function cropContent(content, max) {
  if (content.length > max) {
    content = content.slice(0, max - 3);
    content = content + "...";
  }
  return content;
}
