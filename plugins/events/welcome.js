module.exports = {
  config: {
    name: "welcome",
    author: "You",
    version: "1.0",
    category: "events",
  },

  onEvent: async ({ api, event, db }) => {
    const { id, action, participants } = event
    if (action !== "add" || !participants) return

    for (const user of participants) {
      try {
        const welcomeMessage = `Hello @${user.split("@")[0]}! Welcome to our group.`
        await api.sendMessage(id, {
          text: welcomeMessage,
          mentions: [user],
        })
      } catch (e) {
        console.log(e)
      }
    }
  },
}
