# 🐐 INSTALL.md

## Prerequisites
- Node.js v18+
- npm
- Python (for yt-dlp)
- Git

## Project Structure
```
Goat-WhatsApp-Bot/
├── bot/
├── database/
├── libs/
├── plugins/
├── session/
├── dashboard/
├── config.json
├── index.js
├── Goat.js
├── README.md
├── DOCS.md
├── INSTALL.md
```

## Installation Steps
1. **Clone the repository**
   ```sh
   git clone https://github.com/anbuinfosec/Goat-WhatsApp-Bot.git
   cd Goat-WhatsApp-Bot
   ```
2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Configure your WhatsApp session**
   - Run the bot and follow the QR code instructions.
   - Session files will be saved in the `session/` folder.

## Running the Bot
```sh
node index.js
```

## Customization
- Edit `config.json` for bot settings
- Add new plugins in `plugins/`
- Use MongoDB by editing `database/mongodb.js`

## Credits
- Inspired by [Goat-Bot-V2](https://github.com/ntkhang03/Goat-Bot-V2)
