module.exports = {
	config: {
		name: "uptime",
		version: "1.2",
		author: "@anbuinfosec",
		countDown: 5,
		role: 0,
		description: "View bot runtime information",
		category: "info",
		guide: "{pn}: View bot uptime and system information"
	},

	onStart: async function ({ message, event }) {
		const uptime = process.uptime();
		const memoryUsage = Math.round(process.memoryUsage().rss / 1024 / 1024);
		const cpuUsage = Math.round(process.cpuUsage().user / 1000);
		const totalCommands = global.commandsProcessed || 0;
		const os = require('os');
		
		const uptimeString = convertUptime(uptime);
		const osInfo = `${os.type()} ${os.release()}`;
		
		return message.reply(`⏰ Uptime: ${uptimeString}\n💾 Memory usage: ${memoryUsage} MB\n🔄 CPU usage: ${cpuUsage}%\n📊 Total commands processed: ${totalCommands}\n🌐 Operating system: ${osInfo}`);
	}
};

function convertUptime(uptime) {
	const days = Math.floor(uptime / 86400);
	const hours = Math.floor((uptime % 86400) / 3600);
	const minutes = Math.floor((uptime % 3600) / 60);
	const seconds = Math.floor(uptime % 60);
	
	let result = "";
	if (days > 0) result += `${days}d `;
	if (hours > 0) result += `${hours}h `;
	if (minutes > 0) result += `${minutes}m `;
	if (seconds > 0) result += `${seconds}s`;
	
	return result.trim() || "0s";
}
