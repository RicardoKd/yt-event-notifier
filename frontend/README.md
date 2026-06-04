# YouTube Event Notifier - Frontend

This is the React + TypeScript frontend for the YouTube Event Notifier. It provides a simple web interface for Telegram group admins to manage their stream schedules and YouTube connection.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Environment Variables:
   - `VITE_API_URL`: The base URL of the backend worker (e.g., `http://localhost:8787`). If not set, it defaults to the same domain as the frontend.

## Deployment

The frontend is deployed to Cloudflare Pages.

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy using Wrangler:
   ```bash
   npx wrangler pages deploy dist --project-name yt-event-notifier-web
   ```

## Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Vanilla CSS / Theme UI
- **Deployment**: Cloudflare Pages
