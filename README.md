# 🐐 GOAT WhatsApp Bot

A modular, extensible WhatsApp bot for Node.js, inspired by Goat-Bot V2.

## ✨ Features
- Modular plugin system (commands/events)
- Hot-reloading for plugins
- Robust authentication (QR & Pairing Code)
- Web dashboard for monitoring
- Database support (JSON & MongoDB)
- Error handling and logging

## 📦 Project Structure
```
Goat-WhatsApp-Bot/
├── bot/                # Core bot logic
├── database/           # Data storage (JSON, MongoDB)
├── libs/               # Utilities (logger, utils)
├── plugins/            # Commands & events
│   ├── commands/       # Command plugins
│   └── events/         # Event plugins
├── session/            # WhatsApp session files
├── dashboard/          # Web dashboard
├── config.json         # Bot config
├── index.js            # Main entry
├── Goat.js             # Loader
├── README.md           # Overview
├── DOCS.md             # Full docs
├── INSTALL.md          # Install guide
```

## 🚀 Quick Start
See [INSTALL.md](INSTALL.md) for full setup instructions.

## 📖 Documentation
See [DOCS.md](DOCS.md) for all commands, plugin API, and advanced usage.

## ✍️ Example: Command Plugin
```js
// plugins/commands/ping.js
module.exports = {
  config: {
    name: "ping",
    description: "Ping command",
  },
  onCmd: async ({ reply }) => reply("Pong!")
};
```

## ✍️ Example: Event Plugin
```js
// plugins/events/welcome.js
module.exports = {
  config: { name: "welcome" },
  onEvent: async ({ api, event }) => {
    if (event.action !== "add") return;
    for (const user of event.participants) {
      api.sendMessage(event.id, { text: `Welcome, @${user.split("@")[0]}!`, mentions: [user] });
    }
  }
};
```

## 🗄️ Example: Database Usage
```js
// database/manager.js
const fs = require("fs");
const dataPath = "./database/data.json";
module.exports = {
  get: () => JSON.parse(fs.readFileSync(dataPath)),
  set: (data) => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)),
};
```

## 🛠️ Customization
- Add new commands/events in `plugins/`
- Edit `config.json` for bot settings
- Use MongoDB by editing `database/mongodb.js`

## 🆘 Troubleshooting
- See [INSTALL.md](INSTALL.md) for dependency setup
- See [DOCS.md](DOCS.md) for command reference
- Check logs in `libs/logger.js`

---
Maintainer: @anbuinfosec

---

## Inspired by [Goat-Bot-V2](https://github.com/ntkhang03/Goat-Bot-V2)