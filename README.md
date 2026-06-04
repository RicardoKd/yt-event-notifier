# YouTube Event Notifier

A self-hosted Telegram bot that helps YouTube channel owners notify their Telegram groups and channels about upcoming live streams. Admins configure a weekly stream schedule inside Telegram. The bot checks YouTube for the corresponding broadcast (creating it if needed), sends a reminder before it starts, and a "now live" alert when it goes live.

Built as a monorepo for Cloudflare Workers (Backend) and Cloudflare Pages (Frontend).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup Guide](#setup-guide)
5. [First-Time Bot Configuration](#first-time-bot-configuration)
6. [Commands Reference](#commands-reference)
7. [Environment Variables Reference](#environment-variables-reference)
8. [Local Development](#local-development)
9. [Contributing](#contributing)

---

## Overview

yt-event-notifier is a Python bot that bridges a YouTube channel's live stream schedule with one or more Telegram groups. Admins define a recurring weekly schedule (e.g. "every Tuesday at 18:00") directly via Telegram commands. Before each scheduled stream the bot locates the matching YouTube broadcast — creating it automatically if auto-create is enabled — and sends a configurable reminder message to the group. When the stream goes live, the bot sends a second "now live" alert. The bot supports multiple independent Telegram groups, each connected to its own YouTube channel via OAuth 2.0, with its own schedule, timezone, and message templates.

---

## Architecture

### Infrastructure

The application is hosted entirely on Cloudflare:
- **Backend**: Cloudflare Workers (Python/FastAPI)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Cloudflare Pages (Vite/React)
- **Scheduling**: Cloudflare Cron Triggers

```
Telegram
   |
   | HTTPS webhook (POST /telegram/webhook)
   v
Cloudflare Worker (FastAPI) <--- Cron Trigger (every 15 min)
   |
   | OAuth callback (GET /oauth/callback)
   | API Endpoints (GET/POST /api/...)
   |
   |---> YouTube Live Streaming API (OAuth 2.0)
   |---> Cloudflare D1 (SQLite database)
   |---> Telegram Bot API
```

### Background Polling

Cloudflare Cron Triggers control the polling cadence (default: every 15 minutes). On each trigger, the Worker checks all registered groups for upcoming streams and sends necessary notifications.

### Database

Cloudflare D1 provides a globally distributed SQLite database. The `streams` table holds only upcoming and active entries; records for streams that have ended are deleted on the next poll cycle.

---

## Project Structure

```
yt-event-notifier/
├── backend/                # Cloudflare Worker (Python)
│   ├── main.py             # Entry point — FastAPI routes & Cloudflare event handlers
│   ├── engine.py           # Core logic — stream check, reminders, live detection, cleanup
│   ├── bot/                # Telegram bot command handlers
│   ├── db/                 # D1 database client and queries
│   └── youtube/            # YouTube API and OAuth integration
├── frontend/               # Cloudflare Pages (Vite/React)
│   ├── src/
│   │   ├── api/            # API client for the backend
│   │   ├── components/     # UI components
│   │   └── hooks/          # React hooks
│   └── package.json
├── wrangler.toml           # Cloudflare Worker configuration
├── pyproject.toml          # Python dependencies
├── prd.md                  # Product Requirements Document
├── README.md
└── LICENSE
```

---

## Prerequisites

Before starting setup, ensure you have access to the following:

- **Cloudflare Account** with Workers and D1 enabled.
- **Google Cloud project** with the YouTube Data API v3 enabled and OAuth 2.0 credentials (web application type) created.
- **Telegram bot token** from [@BotFather](https://t.me/BotFather).
- **Node.js** and **Python 3.12** installed locally.

---

## Setup Guide

### 1. Cloudflare D1 Setup

1. Create a D1 database:
   ```bash
   npx wrangler d1 create yt-event-notifier-db
   ```
2. Note the `database_id` and update your `wrangler.toml`.
3. Initialize the schema:
   ```bash
   npx wrangler d1 execute yt-event-notifier-db --file=backend/db/schema.sql
   ```
   *(Note: You may need to export the schema from `backend/db/schema.py` to a SQL file first if it doesn't exist)*

### 2. Google Cloud & Telegram Setup

Follow the standard steps to create a Google Cloud Project with YouTube API enabled and a Telegram Bot via @BotFather.

### 3. Deploy the Backend (Worker)

1. Set secret environment variables in Cloudflare:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
2. Update `wrangler.toml` with your `GOOGLE_REDIRECT_URI` and other vars.
3. Deploy:
   ```bash
   npx wrangler deploy
   ```

### 4. Deploy the Frontend (Pages)

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Deploy to Cloudflare Pages (via Dashboard or CLI):
   ```bash
   npx wrangler pages deploy dist --project-name yt-event-notifier-web
   ```

---

## Local Development

### Backend

1. Start the Worker locally with D1:
   ```bash
   npx wrangler dev
   ```

### Frontend

1. Start the Vite dev server:
   ```bash
   cd frontend
   npm run dev
   ```
   Ensure `VITE_API_URL` is set if the worker is running on a different port.

---

## Contributing

Contributions are welcome. Please follow the standard pull request process.
