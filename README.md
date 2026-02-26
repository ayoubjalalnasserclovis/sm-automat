# SM Automat — Social Media Video Views Tracker

Daily automation that scrapes video view counts from **YouTube**, **Instagram** & **TikTok** using [Apify](https://apify.com), stores them in **Google Sheets**, and displays them on a **live dashboard**.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Apify API   │────▶│ dailyUpdate  │────▶│ Google Sheet  │
│  (scrapers)  │     │  (Node.js)   │     │  (storage)   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                                          ┌─────▼─────┐
                                          │ Express   │
                                          │ Dashboard │
                                          └───────────┘
```

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure .env (see below)

# 3. Run daily scraper
npm run scrape

# 4. Start dashboard
npm start
# → http://localhost:3000
```

## Environment Variables

| Variable | Description |
|---|---|
| `APIFY_API_TOKEN` | Your Apify API token |
| `SPREADSHEET_ID` | Google Sheets spreadsheet ID |
| `GOOGLE_CREDENTIALS` | *(Cloud only)* JSON stringified service account credentials |
| `PORT` | *(Optional)* Server port, default 3000 |

## Scripts

| Command | Description |
|---|---|
| `npm run scrape` | Run all scrapers & write to Google Sheet |
| `npm run scrape:dry` | Dry run — print results without writing |
| `npm start` | Start the dashboard server |
| `npm run test:sheet` | Test Google Sheets connectivity |

## Tracked Channels

Edit `config.js` to add/remove channels:

- **YouTube**: `@Othmane_dot`
- **TikTok**: `@othmane.elz`
- **Instagram**: `othmane.elz`

## Deployment (Render)

1. Push this repo to GitHub
2. Create a **Web Service** on Render pointing to the repo
3. Set environment variables: `APIFY_API_TOKEN`, `SPREADSHEET_ID`, `GOOGLE_CREDENTIALS`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add a **Cron Job** on Render to run `npm run scrape` daily

## Google Sheet Setup

The sheet must have a tab called **"Views"** and be shared with:
`stoniz-whatsapp-to-hubspot@projet-stoniz.iam.gserviceaccount.com` (Editor)

Headers are auto-created: `Scrape Date | Platform | Video ID | Title | URL | Views | Likes | Post Date`
