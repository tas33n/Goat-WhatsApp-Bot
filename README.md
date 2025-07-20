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

We explored many WhatsApp bot repositories but found most to be bloated, buggy, or unusable. So we built our own from scratch — clean, modular, and reliable.

**Inspired by:**  
- [GoatBot V2](https://github.com/ntkhang03/Goat-Bot-V2)  
- [Baileys](https://github.com/WhiskeySockets/Baileys)

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

## 🚀 Getting Started

For step-by-step installation, see [INSTALL.md](./INSTALL.md)

For detailed documentation, see [DOCS.md](./DOCS.md)

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

## 🙌 Authors

* 👨‍💻 Lead Author: [Tas33n](https://github.com/tas33n)
* 🛡 Co-Author: [Anbuinfosec](https://github.com/Anbuinfosec)

---

## 🙏 Acknowledgements

* 🐐 [GoatBot V2](https://github.com/ntkhang03/Goat-Bot-V2)
* 📡 [Baileys](https://github.com/WhiskeySockets/Baileys)

---

## 📜 License

This project is licensed under the MIT License – see the [LICENSE](./LICENSE) file.