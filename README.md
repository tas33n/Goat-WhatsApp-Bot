# 🐐 GOAT Bot

The ultimate modular WhatsApp bot, built for performance and extensibility.

## ✨ Core Features

  * **Modular Architecture**: Add new commands and events by simply creating files.
  * **Hot-Reloading**: The bot automatically reloads any plugins you change, no restart required.
  * **Robust Authentication**: Supports both QR Code and Pairing Code login.
  * **Web Dashboard**: A clean interface to monitor your bot's status and commands.
  * **Optimized Code**: A clean, readable, and performant CommonJS codebase.
  * **Database Support**: Out-of-the-box support for both JSON and MongoDB.

-----

## 🔧 Getting Started

### Prerequisites

  * Node.js (v18+)
  * Git

### Installation & Execution

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-repo/goat-bot.git
    cd goat-bot
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Configure the bot**:
    Edit `config.json` to set your bot's prefix and admin number.

4.  **Run the bot**:

    ```bash
    npm start
    ```

    Follow the prompts to connect your WhatsApp account.

-----

## ✍️ Creating Plugins

### New Command

Create a new file in `/plugins/commands`. The bot will load it automatically.

```javascript
// plugins/commands/example.js
module.exports = {
  config: {
    name: "example",
    description: "An example command.",
  },
  onCmd: async ({ reply }) => {
    return reply("This is an example command!");
  },
};
```

### New Event

Create a new file in `/plugins/events` to handle events like new users joining.

```javascript
// plugins/events/welcome.js
module.exports = {
  config: {
    name: "welcome",
  },
  onEvent: async ({ api, event }) => {
    if (event.action !== "add") return;
    for (const user of event.participants) {
      api.sendMessage(event.id, { text: `Welcome, @${user.split("@")[0]}!`, mentions: [user] });
    }
  },
};
```