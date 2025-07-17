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

	onStart: async function ({ message, event, args, usersData }) {
		const { senderID, threadID } = event;
		
		if (event.messageReply) {
			const targetID = event.messageReply.senderID;
			const targetName = await usersData.getName(targetID);
			return message.reply(`👤 ID of ${targetName}: ${targetID}`);
		}
		
		if (Object.keys(event.mentions).length > 0) {
			let msg = "";
			for (const id in event.mentions) {
				const name = event.mentions[id].replace("@", "");
				msg += `👤 ID of ${name}: ${id}\n`;
			}
			return message.reply(msg.trim());
		}
		
		if (args[0]) {
			const targetID = args[0];
			if (!isNaN(targetID)) {
				try {
					const targetName = await usersData.getName(targetID);
					return message.reply(`👤 ID of ${targetName}: ${targetID}`);
				} catch (err) {
					return message.reply("❌ User not found");
				}
			}
		}
		
		const userName = await usersData.getName(senderID);
		return message.reply(`👤 ID of ${userName}: ${senderID}`);
	}
};
