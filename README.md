<p align="center">
  <img src="https://i.postimg.cc/zGnbd4RS/photo-2025-07-20-15-54-10.jpg" alt="Goat WhatsApp Bot Banner">
</p>

<h1 align="center">🐐 Goat WhatsApp Bot</h1>
<p align="center">
A clean, modular, and production-ready WhatsApp chatbot using personal accounts via Baileys.
</p>

<p align="center">
  <a href="https://nodejs.org/en/">
    <img src="https://img.shields.io/badge/Node.js-%3E%3D20.x-brightgreen.svg?style=flat-square" alt="Node.js >= 20">
  </a>
  <a href="https://github.com/tas33n/Goat-WhatsApp-Bot">
    <img src="https://img.shields.io/github/repo-size/tas33n/Goat-WhatsApp-Bot?style=flat-square&label=Repo+Size" alt="Repo Size">
  </a>
  <a href="https://github.com/tas33n/Goat-WhatsApp-Bot/stargazers">
    <img src="https://img.shields.io/github/stars/tas33n/Goat-WhatsApp-Bot?style=flat-square" alt="GitHub Stars">
  </a>
  <a href="https://github.com/tas33n/Goat-WhatsApp-Bot/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License">
  </a>
</p>

---

## 🧠 About

Goat WhatsApp Bot was built with a single goal: to offer a lightweight, stable, and developer-friendly chatbot platform for WhatsApp. It’s crafted from the ground up with clarity, modularity, and maintainability in mind — making it easier for developers to understand, extend, and collaborate on.

With clean, fully readable code (no obfuscation or encryption), this project is designed to help developers of all levels learn, modify, and extend it with confidence.

> **🎯 Built for Developers. Shared with the Community.**


---

## 📋 Features

- 🔌 **Modular Plugin System** – Drop-in commands & event files.
- ⚙️ **Hot Reload** – Update without restarting the bot.
- 🔐 **Pairing/QR Login** – Choose your auth flow.
- 💻 **Dashboard UI** – Real-time stats, settings & more.
- 🧠 **Smart Commands** – Prebuilt utilities, media, tools.
- 🌍 **Multilingual Support** – Easily extend to other languages.
- 📁 **JSON DB (Pluggable)** – Add MongoDB, SQLite, etc.
- 📜 **Built-in Logger** – Simple and effective console outputs.

---

# 🛠️ Installation Guide

Follow these steps to get the bot running on your machine.

## 📦 Requirements

- Node.js >= 20.x — [Download here](https://nodejs.org/)
- Git (optional but recommended)
- WhatsApp account (use a secondary or throwaway account)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/tas33n/Goat-WhatsApp-Bot.git
cd Goat-WhatsApp-Bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Bot

```bash
npm start
```

The bot will prompt you to scan a QR code (for the first time login).

## 🐳 Optional: Run with Docker

A ready-to-use `Dockerfile` is included with Node.js 20 and FFmpeg preinstalled.

```bash
# Build the Docker image
docker build -t goat-whatsapp-bot .

# Run the bot container interactively
docker run -it goat-whatsapp-bot

# Run the bot with persistent session
docker run -it -p 3000:3000 -v $(pwd)/session:/app/session goat-whatsapp-bot

```

## ✅ Authentication Note

If you want to reuse the session, your credentials are stored locally in `session/` folder. **Do not share it.**

---

## 🧩 Plugin System

### ✏️ Creating a Command

```js
// plugins/commands/ping.js
module.exports = {
  config: {
    name: "ping",
    aliases: ["p"],
    description: "Check bot responsiveness.",
    author: "Tas33n",
    cooldown: 5,
    role: 0,
    category: "utility"
  },
  onCmd: async ({ reply }) => {
    reply("Pong!");
  }
};
````

### 🧠 Event Listener Example

```js
// plugins/events/welcome.js
module.exports = {
  config: {
    name: "welcome",
    author: "Anbuinfosec",
    category: "events"
  },
  onEvent: async ({ api, event }) => {
    if (event.action !== "add") return;
    for (const user of event.participants) {
      api.sendMessage(event.id, {
        text: `👋 Welcome @${user.split("@")[0]}`,
        mentions: [user]
      });
    }
  }
};
```
For detailed documentation, see [DOCS.md](./DOCS.md)

---

## 📸 Previews

<details>
<summary>🤖 Bot Commands</summary>

* **Bot sample commands** <img src="https://i.postimg.cc/HsptyzGZ/photo-2025-07-20-14-50-50.jpg" width="400px">

</details>

<details>
<summary>📊 Dashboard UI</summary>

* **Admin Login Page** <img src="https://i.postimg.cc/sxz4K9M2/photo-2025-07-20-14-50-46.jpg" width="400px">
* **Bot Dashboard** <img src="https://i.postimg.cc/MHYbLMBm/photo-2025-07-20-14-50-36.jpg" width="400px">
* **Admin command dashboard** <img src="https://i.postimg.cc/Pfb4Jc7v/photo-2025-07-20-14-50-42.jpg" width="400px">

</details>

---

## 🙋‍♂️ Contributing

We welcome contributions from developers of all skill levels! Whether it's fixing bugs, suggesting features, or improving documentation — your input makes this project better.

Please feel free to [open an issue](https://github.com/tas33n/Goat-WhatsApp-Bot/issues) or submit a pull request.

---

## 🚫 Respect the Project & Credits

This project is licensed under the MIT License, which allows you to use and modify it freely. However, **please do not remove author credits or attempt to rebrand this project as your own.**

Doing so hurts community collaboration and makes it harder to track real improvements. If you want to build on this, we encourage you to fork it **and credit the original authors** so others know where the foundation came from.

Let’s build better tools — together.

---

## 🙌 Authors

* 👨‍💻 Lead Author: [Tas33n](https://github.com/tas33n)
* 🛡 Co-Author: [Anbuinfosec](https://github.com/Anbuinfosec)

---

## 🙏 Acknowledgements

* 🐐 [GoatBot V2](https://github.com/ntkhang03/Goat-Bot-V2) – A Messenger chatbot project that inspired the modular plugin-based architecture and command flow.
* 📡 [Baileys](https://github.com/WhiskeySockets/Baileys) – For their awesome WhatsApp Web API library that powers the bot.
* 🤖 [ChatGPT](https://openai.com/chatgpt) – For help with writing, refactoring, and improving documentation, Docker setup, and best practices.

---

## 💰 Support & Donations

If you find this project helpful and want to support further development, donations are appreciated 🙏

### 🏦 Binance Pay
Binance ID: **471390205**

### 💵 USDT (TRC-20)
`TR95UPDfsB1Ammyj4w62xDuAJEA8wH5GSz`

### 💸 Litecoin (LTC)
`LeaKUHCiAhRa6U3jrQa4bCAvaAfniJ6pXP`

### 💸 Bitcoin (BTC)
`16NyoNtkDk8uHejqNsKkhpc8RyPEEfu1m9`

---

## 📜 License

This project is licensed under the MIT License – see the [LICENSE](./LICENSE) file.