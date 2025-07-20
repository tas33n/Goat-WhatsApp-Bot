
# 📖 Goat WhatsApp Bot Documentation

This document provides an overview of the bot architecture, plugin system, and advanced usage.

## 🧠 Architecture

```
Goat-WhatsApp-Bot/
├── plugins/
│   ├── commands/     # All command plugins
│   └── events/       # All event listeners
├── core/             # Auth, handlers, loader
├── auth/             # WhatsApp session data
├── dashboard/        # Web dashboard interface
├── config.json       # Configurable settings
├── bot.js            # Entrypoint
```

## 🔌 Plugin System

### Command Structure

Create a file inside `plugins/commands/`:

```js
module.exports = {
  config: {
    name: "ping",
    description: "Ping command",
    aliases: ["p"],
    author: "Tas33n",
    cooldown: 5,
    role: 0,
    category: "utility"
  },
  onCmd: async ({ reply }) => {
    reply("Pong!");
  }
};
```

### Event Listener Structure

Inside `plugins/events/`:

```js
module.exports = {
  config: {
    name: "welcome",
    author: "Anbuinfosec",
    category: "events"
  },
  onEvent: async ({ api, event }) => {
    // Handle new participants
  }
};
```

## 🌐 Dashboard

- `/dashboard` - Overview and stats
- `/login` - Secure login panel
- `/settings` - Bot toggles, plugin control

> Built with simple HTML/CSS + JS, no frontend framework.

## 🧩 Extending

- Add DB integrations by modifying `core/database.js`
- Add more languages in `/languages` directory
- Customize welcome/leave messages in `config.json`

## 📄 Contributing

Pull requests are welcome! Follow these guidelines:
- Format code with Prettier
- Add JSDoc to new files
- Include your name in plugin author

---
