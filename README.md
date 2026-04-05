# Tab Out

**Keep tabs on your tabs.**

Tab Out replaces your Chrome new tab page with a mission dashboard: it groups your open tabs into named "missions" using AI, so you can see exactly what you're working on — and close what you're not.

---

## What it does

- **Groups your open tabs into missions** using the DeepSeek AI — tabs about the same topic cluster together automatically
- **Shows them on your new tab page** so every new tab is a reminder of what's actually open
- **Lets you close tabs** with a satisfying swoosh and confetti when a mission is done
- **Detects duplicate tabs** so you don't end up with five copies of the same page
- **Works entirely locally** — your browsing data never leaves your machine; the AI call sends only tab titles and URLs to DeepSeek

---

## Prerequisites

- **macOS** — the auto-start feature uses macOS Launch Agents
- **Node.js 18+** — [download here](https://nodejs.org)
- **Google Chrome**
- **DeepSeek API key** — clustering costs fractions of a cent; [get one here](https://platform.deepseek.com)

---

## Quick Setup

**1. Clone the repo**

```bash
git clone https://github.com/YOUR_USERNAME/tab-out.git
cd tab-out
```

**2. Install dependencies**

```bash
npm install
```

**3. Run the install script**

```bash
npm run install-service
```

This creates the `~/.mission-control/` data directory, writes a default config file, and installs a macOS Launch Agent so the server starts automatically when you log in.

**4. Add your DeepSeek API key**

Open `~/.mission-control/config.json` in any text editor and paste your key:

```json
{
  "deepseekApiKey": "sk-your-key-here"
}
```

**5. Start the server**

```bash
npm start
```

(After the Launch Agent is loaded, this happens automatically on login — you only need `npm start` the first time or after a manual stop.)

**6. Load the Chrome extension**

1. Open Chrome and go to `chrome://extensions`
2. Toggle on **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder inside this repo

**7. Open a new tab**

You'll see Tab Out. That's it.

---

## How it works

Tab Out has two modes:

| Mode | What happens |
|------|-------------|
| **Static (default)** | Opens instantly. Tabs grouped by domain. No AI call needed. |
| **AI mode** | Click "Organize with AI". DeepSeek clusters your tabs into named missions. Results are cached — same set of tabs = instant load next time. |

In the background, the server re-reads your Chrome browsing history every 30 minutes and updates the mission database. The extension badge on your toolbar shows your current mission count, color-coded by stress level (green → amber → red).

---

## Configuration

The config file lives at `~/.mission-control/config.json`. You can override any of these:

```json
{
  "deepseekApiKey": "",
  "port": 3456,
  "refreshIntervalMinutes": 30,
  "batchSize": 200,
  "historyDays": 7,
  "deepseekBaseUrl": "https://api.deepseek.com",
  "deepseekModel": "deepseek-chat"
}
```

| Field | Default | What it does |
|-------|---------|-------------|
| `deepseekApiKey` | *(empty)* | Your DeepSeek API key — required for AI clustering |
| `port` | `3456` | The local port the dashboard server runs on |
| `refreshIntervalMinutes` | `30` | How often the server re-analyzes your browsing history |
| `batchSize` | `200` | How many history entries to process per refresh cycle |
| `historyDays` | `7` | How far back to look in your Chrome history |
| `deepseekBaseUrl` | `https://api.deepseek.com` | API endpoint (change if using a proxy) |
| `deepseekModel` | `deepseek-chat` | Which DeepSeek model to use for clustering |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Database | better-sqlite3 (fast, local, no setup) |
| AI clustering | DeepSeek API (OpenAI-compatible) |
| Chrome extension | Manifest V3 |
| Auto-start | macOS Launch Agent |

---

## Project structure

```
tab-out/
├── extension/        # Chrome extension (new tab override)
│   ├── manifest.json
│   ├── newtab.html   # The iframe shell that loads the dashboard
│   ├── newtab.js     # Bridge between the extension and the dashboard
│   └── background.js # Service worker that updates the toolbar badge
├── dashboard/        # The actual dashboard UI served by Express
│   ├── index.html
│   ├── style.css
│   └── app.js        # All dashboard logic
├── server/           # The Express backend
│   ├── index.js      # Server entry point
│   ├── config.js     # Config loader (reads ~/.mission-control/config.json)
│   ├── db.js         # SQLite database setup and queries
│   ├── routes.js     # API endpoints
│   └── clustering.js # DeepSeek AI integration
└── scripts/
    └── install.js    # One-time setup script
```

---

## License

MIT
