const axios = require('axios');

module.exports = {
	config: {
		name: "translate",
		aliases: ["trans"],
		version: "1.5",
		author: "@anbuinfosec",
		countDown: 5,
		role: 0,
		description: "Translate text to the desired language",
		category: "utility",
		guide: "{pn} <text>: Translate text to the language of your chat box or the default language of the bot"
			+ "\n{pn} <text> -> <ISO 639-1>: Translate text to the desired language"
			+ "\nor you can reply a message to translate the content of that message"
			+ "\nExample:"
			+ "\n{pn} hello -> vi"
	},

	onStart: async function ({ message, event, args, threadsData, commandName }) {
		const { body = "" } = event;
		let content;
		let langCodeTrans;
		const langOfThread = "en"; // Default to English

		if (event.messageReply) {
			content = event.messageReply.body;
			let lastIndexSeparator = body.lastIndexOf("->");
			if (lastIndexSeparator == -1)
				lastIndexSeparator = body.lastIndexOf("=>");

			if (lastIndexSeparator != -1 && (body.length - lastIndexSeparator == 4 || body.length - lastIndexSeparator == 5))
				langCodeTrans = body.slice(lastIndexSeparator + 2);
			else if ((args[0] || "").match(/\w{2,3}/))
				langCodeTrans = args[0].match(/\w{2,3}/)[0];
			else
				langCodeTrans = langOfThread;
		}
		else {
			content = event.body;
			let lastIndexSeparator = content.lastIndexOf("->");
			if (lastIndexSeparator == -1)
				lastIndexSeparator = content.lastIndexOf("=>");

			if (lastIndexSeparator != -1 && (content.length - lastIndexSeparator == 4 || content.length - lastIndexSeparator == 5)) {
				langCodeTrans = content.slice(lastIndexSeparator + 2);
				content = content.slice(content.indexOf(args[0]), lastIndexSeparator);
			}
			else
				langCodeTrans = langOfThread;
		}

		if (!content)
			return message.reply("❌ Please provide text to translate");
		
		try {
			const { text, lang } = await translate(content.trim(), langCodeTrans.trim());
			return message.reply(`${text}\n\n🌐 Translate from ${lang} to ${langCodeTrans}`);
		} catch (err) {
			return message.reply("❌ An error occurred while translating the text");
		}
	}
};

async function translate(text, langCode) {
	const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(text)}`);
	return {
		text: res.data[0].map(item => item[0]).join(''),
		lang: res.data[2]
	};
}
