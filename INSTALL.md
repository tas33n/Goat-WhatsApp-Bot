
# 🛠️ Installation Guide - Goat WhatsApp Bot

Follow these steps to get the bot running on your machine.

## 📦 Requirements

- Node.js >= 18.x — [Download here](https://nodejs.org/)
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

## 🧪 Development Mode (Auto-restart with file changes)

```bash
npm run dev
```

This uses [nodemon](https://nodemon.io) to reload on changes.

## 🐳 Optional: Run with Docker

```bash
docker build -t goat-whatsapp-bot .
docker run -it goat-whatsapp-bot
```

## ✅ Authentication Note

If you want to reuse the session, your credentials are stored locally in `auth/` folder. **Do not share it.**

---
