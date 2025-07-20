const { exec } = require('child_process');

module.exports = {
  config: {
    name: "shell",
    aliases: ["sh"],
    description: "Excute CLI.",
    role: 2, // Bot admin only
    countDown: 2,
  },
  onCmd: async ({ args, reply, message, user, config, logger, event }) => {
    exec(`${args.join(" ")}`, (error, stdout, stderr) => {
      if (error) {
        message.reply(`❎ | ${error}`);
        return;
      }

      const formattedOutput = stdout
        .trim()
        .split("\n")
        .map((line) => `${line}`)
        .join("\n");
      message.reply(formattedOutput);
    });
  },
};
