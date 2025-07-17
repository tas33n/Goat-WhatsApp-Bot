# 🐐 GOAT WhatsApp Bot Documentation

## Overview
A modular WhatsApp bot for Node.js, supporting plugins, media, and database.

## Command System
- Place command files in `plugins/commands/`
- Each command exports a config and handler

### Example Command
```js
module.exports = {
  config: {
    name: "ping",
    description: "Ping command",
  },
  onCmd: async ({ reply }) => reply("Pong!")
};
```

## Event System
- Place event files in `plugins/events/`
- Each event exports a config and handler

### Example Event
```js
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

## Database
- JSON: `database/data.json`, `database/manager.js`
- MongoDB: `database/mongodb.js`

### Example Usage
```js
const db = require("../database/manager.js");
const data = db.get();
db.set({ ...data, newKey: "value" });
```

## Session Management
- Session files in `session/`
- Credentials auto-managed

## Configuration
- Edit `config.json` for prefix, admins, etc.