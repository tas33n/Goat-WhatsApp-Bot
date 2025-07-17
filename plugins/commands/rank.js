const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "rank",
        aliases: ["level", "exp", "xp"],
        description: "View user rank and experience",
        guide: "{pn} [@user]",
        author: "@anbuinfosec",
        role: 0,
        cooldown: 5,
        countDown: 5,
        category: "info"
    },

    onStart: async ({ message, event, args, user, thread, utils, api, getLang }) => {
        try {
            const { threadID, senderID } = event;
            let targetID = senderID;
            
            // Check if user tagged someone
            if (event.mentions && Object.keys(event.mentions).length > 0) {
                targetID = Object.keys(event.mentions)[0];
            }
            
            // Get user data
            const userData = await user.getUser(targetID);
            const userName = userData.name || "Unknown";
            
            // Calculate level and experience
            const experience = userData.exp || 0;
            const level = Math.floor(experience / 100) + 1;
            const expForNext = (level * 100) - experience;
            const expProgress = experience - ((level - 1) * 100);
            
            // Get rank position
            const allUsers = await user.getAllUsers();
            const sortedUsers = allUsers.sort((a, b) => (b.exp || 0) - (a.exp || 0));
            const rank = sortedUsers.findIndex(u => u.uid === targetID) + 1;
            
            // Create progress bar
            const progressBar = createProgressBar(expProgress, 100);
            
            // Use language system if available
            const getText = getLang || ((key, ...args) => {
                const texts = {
                    userRank: "🏆 RANK INFORMATION 🏆\n\n👤 User: %1\n📊 Level: %2\n⭐ Experience: %3 XP\n🎯 Rank: #%4\n📈 Progress: %5/100 XP\n%6\n🔥 Next Level: %7 XP needed\n\n💡 Tip: Stay active to earn more XP!",
                    userNotFound: "User not found in database"
                };
                let text = texts[key] || key;
                args.forEach((arg, index) => {
                    text = text.replace(new RegExp(`%${index + 1}`, 'g'), arg);
                });
                return text;
            });
            
            const rankMessage = getText('userRank', userName, level, experience, rank, expProgress, progressBar, expForNext);
            
            // Use reply function if available, otherwise use message
            if (typeof reply === 'function') {
                await reply(rankMessage);
            } else {
                await message.reply(rankMessage);
            }
            
        } catch (error) {
            console.error("Error in rank command:", error);
            const errorText = "❌ Error retrieving rank information. Please try again.";
            if (typeof reply === 'function') {
                await reply(errorText);
            } else {
                await message.reply(errorText);
            }
        }
    }
};

function createProgressBar(current, max, length = 20) {
    const percentage = Math.round((current / max) * 100);
    const filledLength = Math.round((current / max) * length);
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `[${filled}${empty}] ${percentage}%`;
}
