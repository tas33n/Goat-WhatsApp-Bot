module.exports = {
	config: {
		name: "unsend",
		aliases: ["uns"],
		version: "1.2",
		author: "@anbuinfosec",
		countDown: 5,
		role: 0,
		description: "Unsend bot's message by replying to it",
		category: "utility",
		guide: "{pn}: Reply to bot's message to unsend it"
			+ "\n{pn} <number>: Unsend bot's last <number> messages"
	},

	onStart: async function ({ message, event, args, api }) {
		const { messageReply, threadID } = event;
		const botID = api.getCurrentUserID();
		
		if (messageReply) {
			if (messageReply.senderID != botID) {
				return message.reply("❌ This is not bot's message");
			}
			
			try {
				await api.unsendMessage(messageReply.messageID);
				return message.reply("✅ Message unsent");
			} catch (err) {
				return message.reply("❌ Cannot unsend this message");
			}
		}
		
		if (args[0]) {
			const num = parseInt(args[0]);
			if (isNaN(num) || num < 1 || num > 10) {
				return message.reply("❌ Invalid number");
			}
			
			// This would require storing recent bot messages
			// For now, just show syntax error
			return message.reply("❌ Please reply to bot's message or enter number of messages to unsend");
		}
		
		return message.reply("❌ Please reply to bot's message or enter number of messages to unsend");
	}
};
