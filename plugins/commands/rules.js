module.exports = {
	config: {
		name: "rules",
		version: "1.5",
		author: "@anbuinfosec",
		countDown: 5,
		role: 0,
		description: "Create/view/add/edit/change position/delete group rules",
		category: "group",
		guide: "{pn} [add | -a] <rule to add>: add rule for group."
			+ "\n{pn}: view group rules."
			+ "\n{pn} [edit | -e] <n> <content after edit>: edit rule number n."
			+ "\n{pn} [move | -m] <stt1> <stt2> swap position of rule number <stt1> and <stt2>."
			+ "\n{pn} [delete | -d] <n>: delete rule number n."
			+ "\n{pn} [remove | -r]: delete all rules of group."
			+ "\n"
			+ "\nExample:"
			+ "\n{pn} add don't spam"
			+ "\n{pn} move 1 3"
			+ "\n{pn} -e 1 don't spam message in group"
			+ "\n{pn} -r"
	},

	onStart: async function ({ message, event, args, threadsData, role }) {
		const { threadID } = event;
		const threadData = await threadsData.get(threadID);
		const rulesOfThread = threadData.data.rules || [];
		const totalRules = rulesOfThread.length;
		const type = (args[0] || "").toLowerCase();

		if (["add", "-a"].includes(type)) {
			if (role < 1)
				return message.reply("❌ Only administrators can use this command");
			if (!args[1])
				return message.reply("⚠️ Please enter rule content");
			rulesOfThread.push(args.slice(1).join(" "));
			try {
				await threadsData.set(threadID, rulesOfThread, "data.rules");
				message.reply("✅ Added new rule for group");
			}
			catch (err) {
				message.reply("❌ Error occurred while saving rules");
			}
		}
		else if (["edit", "-e"].includes(type)) {
			if (role < 1)
				return message.reply("❌ Only administrators can edit/delete rules");
			const stt = parseInt(args[1]);
			if (isNaN(stt))
				return message.reply("⚠️ Please enter valid number");
			if (!rulesOfThread[stt - 1])
				return message.reply(`⚠️ Rule number ${stt} does not exist, ${totalRules == 0 ? "⚠️ Your group has no rules" : `currently group has ${totalRules} rules`}`);
			if (!args[2])
				return message.reply(`⚠️ Please enter rule content to edit for rule number ${stt}`);
			const newContent = args.slice(2).join(" ");
			rulesOfThread[stt - 1] = newContent;
			try {
				await threadsData.set(threadID, rulesOfThread, "data.rules");
				message.reply(`✅ Edited rule number ${stt}`);
			}
			catch (err) {
				message.reply("❌ Error occurred while editing rule");
			}
		}
		else if (["move", "-m"].includes(type)) {
			if (role < 1)
				return message.reply("❌ Only administrators can edit/delete rules");
			const stt1 = parseInt(args[1]);
			const stt2 = parseInt(args[2]);
			if (isNaN(stt1) || isNaN(stt2))
				return message.reply("⚠️ Please enter valid number");
			if (!rulesOfThread[stt1 - 1] || !rulesOfThread[stt2 - 1])
				return message.reply(`⚠️ Rule number ${!rulesOfThread[stt1 - 1] ? stt1 : stt2} does not exist, ${totalRules == 0 ? "⚠️ Your group has no rules" : `currently group has ${totalRules} rules`}`);
			[rulesOfThread[stt1 - 1], rulesOfThread[stt2 - 1]] = [rulesOfThread[stt2 - 1], rulesOfThread[stt1 - 1]];
			try {
				await threadsData.set(threadID, rulesOfThread, "data.rules");
				message.reply(`✅ Moved rule number ${stt1} and ${stt2}`);
			}
			catch (err) {
				message.reply("❌ Error occurred while moving rules");
			}
		}
		else if (["delete", "-d"].includes(type)) {
			if (role < 1)
				return message.reply("❌ Only administrators can edit/delete rules");
			const stt = parseInt(args[1]);
			if (isNaN(stt))
				return message.reply("⚠️ Please enter valid number");
			if (!rulesOfThread[stt - 1])
				return message.reply(`⚠️ Rule number ${stt} does not exist, ${totalRules == 0 ? "⚠️ Your group has no rules" : `currently group has ${totalRules} rules`}`);
			rulesOfThread.splice(stt - 1, 1);
			try {
				await threadsData.set(threadID, rulesOfThread, "data.rules");
				message.reply(`✅ Deleted rule number ${stt}`);
			}
			catch (err) {
				message.reply("❌ Error occurred while deleting rule");
			}
		}
		else if (["remove", "-r"].includes(type)) {
			if (role < 1)
				return message.reply("❌ Only administrators can edit/delete rules");
			return message.reply("⚠️ Are you sure you want to delete all group rules?\nReact to this message to confirm", (err, info) => {
				global.GoatBot.onReaction.set(info.messageID, {
					commandName: "rules",
					messageID: info.messageID,
					author: event.senderID
				});
			});
		}
		else {
			if (totalRules == 0)
				return message.reply("⚠️ Your group has no rules");
			let msg = `📋 Group rules ${threadData.threadName || "Unknown"}:\n`;
			for (let i = 0; i < rulesOfThread.length; i++) {
				msg += `${i + 1}. ${rulesOfThread[i]}\n`;
			}
			return message.reply(msg);
		}
	},

	onReaction: async function ({ message, event, Reaction, threadsData }) {
		const { threadID, userID } = event;
		if (userID != Reaction.author)
			return;
		try {
			await threadsData.set(threadID, [], "data.rules");
			message.reply("✅ Deleted all group rules");
		}
		catch (err) {
			message.reply("❌ Error occurred while removing all rules");
		}
	}
};
