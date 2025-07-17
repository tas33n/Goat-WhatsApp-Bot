module.exports = {
	config: {
		name: "uid",
		version: "1.2",
		author: "@anbuinfosec",
		countDown: 5,
		role: 0,
		description: "Get user ID of tagged person or yourself",
		category: "info",
		guide: "{pn}: get your user ID"
			+ "\n{pn} @tag: get user ID of tagged person"
			+ "\n{pn} reply: get user ID of replied message sender"
	},

	onStart: async function ({ message, event, args }) {

		const { senderID, threadID } = event;
		
		// Check for reply (quoted message)
		if (event.quotedParticipant) {
			return message.reply(`👤 ID: ${event.quotedParticipant}`);
		}

		// Check for mentions (array)
		if (Array.isArray(event.mentions) && event.mentions.length > 0) {
			let msg = "";
			for (const id of event.mentions) {
				msg += `👤 ID: ${id}\n`;
			}
			return message.reply(msg.trim());
		}
		
		if (args[0]) {
			const targetID = args[0];
			if (!isNaN(targetID)) {
				try {
					return message.reply(`👤 ID: ${targetID}`);
				} catch (err) {
					return message.reply("❌ User not found");
				}
			}
		}
		
		return message.reply(`👤 ID: ${senderID}`);
	}
};
