const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "user",
        aliases: ["u", "profile"],
        description: "User management and profile commands",
        guide: "{pn} [info|ban|unban|warn|clearwarns|money|exp] [user] [amount/reason]",
        author: "@anbuinfosec",
        role: 0,
        cooldown: 3,
        countDown: 3,
        category: "utility"
    },

    onStart: async ({ reply, event, args, user, role, utils, api, getLang }) => {
        try {
            const getText = getLang || ((key, ...args) => {
                const texts = {
                    missingAction: "❌ Please specify an action: info, ban, unban, warn, clearwarns, money, exp",
                    noPermission: "❌ You don't have permission to use this action",
                    userNotFound: "❌ User not found",
                    missingUser: "❌ Please mention a user or reply to their message",
                    missingAmount: "❌ Please specify an amount",
                    missingReason: "❌ Please provide a reason",
                    userBanned: "✅ User has been banned. Reason: %1",
                    userUnbanned: "✅ User has been unbanned",
                    userWarned: "⚠️ User has been warned. Total warnings: %1\nReason: %2",
                    warningsCleared: "✅ All warnings cleared for user",
                    moneyAdded: "✅ Added $%1 to user's balance. New balance: $%2",
                    moneyRemoved: "✅ Removed $%1 from user's balance. New balance: $%2",
                    expAdded: "✅ Added %1 XP to user. New total: %2 XP",
                    expRemoved: "✅ Removed %1 XP from user. New total: %2 XP",
                    userInfo: "👤 USER PROFILE\n\n🏷️ Name: %1\n🆔 ID: %2\n📊 Level: %3\n⭐ Experience: %4 XP\n💰 Money: $%5\n⚠️ Warnings: %6\n🚫 Banned: %7\n📅 First Seen: %8\n📅 Last Seen: %9\n📨 Messages: %10"
                };
                let text = texts[key] || key;
                args.forEach((arg, index) => {
                    text = text.replace(new RegExp(`%${index + 1}`, 'g'), arg);
                });
                return text;
            });

            const currentUser = await user.getUser();
            const userRole = await role.getRole();

            if (!args[0]) {
                return await reply(getText('missingAction'));
            }

            const action = args[0].toLowerCase();
            let targetUser = event.senderID;

            // Get target user from mentions or reply
            if (event.mentions && Object.keys(event.mentions).length > 0) {
                targetUser = Object.keys(event.mentions)[0];
            } else if (event.messageReply) {
                targetUser = event.messageReply.senderID;
            } else if (args[1] && args[1].includes('@')) {
                targetUser = args[1].replace('@', '');
            }

            switch (action) {
                case 'info':
                    await showUserInfo(targetUser, user, reply, getText);
                    break;

                case 'ban':
                    if (userRole < 1) {
                        return await reply(getText('noPermission'));
                    }
                    if (targetUser === event.senderID) {
                        return await reply("❌ You cannot ban yourself");
                    }
                    await banUser(targetUser, args.slice(1).join(' ') || 'No reason provided', user, reply, getText);
                    break;

                case 'unban':
                    if (userRole < 1) {
                        return await reply(getText('noPermission'));
                    }
                    await unbanUser(targetUser, user, reply, getText);
                    break;

                case 'warn':
                    if (userRole < 1) {
                        return await reply(getText('noPermission'));
                    }
                    if (targetUser === event.senderID) {
                        return await reply("❌ You cannot warn yourself");
                    }
                    const reason = args.slice(1).join(' ');
                    if (!reason) {
                        return await reply(getText('missingReason'));
                    }
                    await warnUser(targetUser, reason, user, reply, getText);
                    break;

                case 'clearwarns':
                    if (userRole < 1) {
                        return await reply(getText('noPermission'));
                    }
                    await clearWarnings(targetUser, user, reply, getText);
                    break;

                case 'money':
                    if (userRole < 2) {
                        return await reply(getText('noPermission'));
                    }
                    const amount = parseInt(args[1]);
                    if (isNaN(amount)) {
                        return await reply(getText('missingAmount'));
                    }
                    await manageMoney(targetUser, amount, user, reply, getText);
                    break;

                case 'exp':
                    if (userRole < 2) {
                        return await reply(getText('noPermission'));
                    }
                    const expAmount = parseInt(args[1]);
                    if (isNaN(expAmount)) {
                        return await reply(getText('missingAmount'));
                    }
                    await manageExp(targetUser, expAmount, user, reply, getText);
                    break;

                default:
                    await reply(getText('missingAction'));
            }

        } catch (error) {
            console.error("Error in user command:", error);
            await reply("❌ An error occurred while processing the user command.");
        }
    }
};

async function showUserInfo(userId, user, reply, getText) {
    try {
        const userData = await user.getUser(userId);
        
        if (!userData) {
            return await reply(getText('userNotFound'));
        }

        const level = Math.floor((userData.exp || 0) / 100) + 1;
        const warnings = userData.warnings ? userData.warnings.length : 0;
        const banned = userData.banned ? 'Yes' : 'No';
        const firstSeen = userData.firstSeen ? new Date(userData.firstSeen).toLocaleDateString() : 'Unknown';
        const lastSeen = userData.lastSeen ? new Date(userData.lastSeen).toLocaleDateString() : 'Unknown';

        const info = getText('userInfo',
            userData.name || 'Unknown',
            userData.id || userId,
            level,
            userData.exp || 0,
            userData.money || 0,
            warnings,
            banned,
            firstSeen,
            lastSeen,
            userData.messageCount || 0
        );

        await reply(info);

    } catch (error) {
        await reply(getText('userNotFound'));
    }
}

async function banUser(userId, reason, user, reply, getText) {
    try {
        await user.ban(userId, reason);
        await reply(getText('userBanned', reason));
    } catch (error) {
        await reply(getText('userNotFound'));
    }
}

async function unbanUser(userId, user, reply, getText) {
    try {
        await user.unban(userId);
        await reply(getText('userUnbanned'));
    } catch (error) {
        await reply(getText('userNotFound'));
    }
}

async function warnUser(userId, reason, user, reply, getText) {
    try {
        const warningCount = await user.warn(userId, reason);
        await reply(getText('userWarned', warningCount, reason));
    } catch (error) {
        await reply(getText('userNotFound'));
    }
}

async function clearWarnings(userId, user, reply, getText) {
    try {
        await user.updateUser(userId, { warnings: [] });
        await reply(getText('warningsCleared'));
    } catch (error) {
        await reply(getText('userNotFound'));
    }
}

async function manageMoney(userId, amount, user, reply, getText) {
    try {
        const userData = await user.getUser(userId);
        const currentMoney = userData.money || 0;
        const newMoney = currentMoney + amount;
        
        await user.updateUser(userId, { money: newMoney });
        
        if (amount > 0) {
            await reply(getText('moneyAdded', amount, newMoney));
        } else {
            await reply(getText('moneyRemoved', Math.abs(amount), newMoney));
        }
    } catch (error) {
        await reply(getText('userNotFound'));
    }
}

async function manageExp(userId, amount, user, reply, getText) {
    try {
        const userData = await user.getUser(userId);
        const currentExp = userData.exp || 0;
        const newExp = Math.max(0, currentExp + amount);
        
        await user.updateUser(userId, { exp: newExp });
        
        if (amount > 0) {
            await reply(getText('expAdded', amount, newExp));
        } else {
            await reply(getText('expRemoved', Math.abs(amount), newExp));
        }
    } catch (error) {
        await reply(getText('userNotFound'));
    }
}
