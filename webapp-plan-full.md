# Telegram Web App — Full Scope Plan

This is the full-scope version of the Web App plan, including slot management and streams.

---

## UX Design

**Single page application.** All sections stacked vertically on one page (no tabs, no routing).
A persistent **"Save changes"** button at the bottom submits the entire group configuration.

Sections (top to bottom):

1. **Status** — read-only: YouTube channel, next poll estimate
2. **YouTube** — connect / disconnect (immediate action)
3. **Settings** — all `/set*` fields as MUI form controls (7 fields, flat layout)
4. **Slots** — list with inline add/remove; title_template / custom_message editable inline
5. **Streams** — read-only numbered table of active streams
6. **"Save changes"** button — `PATCH /api/group/{group_id}` + slot template/message updates
7. **"Trigger Manual Sync"** button — immediate action

**Header:** app title + light/dark toggle `IconButton` (right-aligned).

**Missing `group_id`:** If `?group_id=` is absent from the URL, render a full-page centered error: "No group ID provided. Open this app from your Telegram bot." — render nothing else.

**Theming (MUI):**

- Light mode primary: `#4b7ef3`
- Dark mode primary: `#e77f2d`

---

## Save changes scope

| Section                              | Save behavior                                                          |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Settings fields                      | Batched into `PATCH /api/group/{group_id}` on Save                     |
| Slot title_template / custom_message | Collected; flushed on Save via individual `PATCH .../slots/{id}` calls |
| Add slot                             | Immediate `POST` on form submit                                        |
| Remove slot                          | Immediate `DELETE` on button click                                     |
| YouTube connect                      | Immediate redirect to OAuth URL                                        |
| YouTube disconnect                   | Immediate `DELETE` on button click                                     |
| Manual sync                          | Immediate `POST` on button click                                       |

**Save sequence:** Call `PATCH /api/group/{group_id}` first, then each dirty `PATCH .../slots/{id}` in sequence. On any failure, show error snackbar and stop — don't continue remaining patches.

---

## Error handling

All API failures surface via a single global MUI `Snackbar` + `Alert`. Successes (e.g. "Settings saved", "YouTube connected") also use the same snackbar with `severity="success"`.

---

## Full API surface (10 endpoints)

| Method   | Path                                     | Bot command equivalent        |
| -------- | ---------------------------------------- | ----------------------------- |
| `GET`    | `/api/group/{group_id}`                  | `/status`                     |
| `PATCH`  | `/api/group/{group_id}`                  | All `/set*` commands          |
| `GET`    | `/api/group/{group_id}/slots`            | `/listslots`                  |
| `POST`   | `/api/group/{group_id}/slots`            | `/addslot`                    |
| `DELETE` | `/api/group/{group_id}/slots/{slot_id}`  | `/removeslot`                 |
| `PATCH`  | `/api/group/{group_id}/slots/{slot_id}`  | `/settemplate`, `/setmessage` |
| `GET`    | `/api/group/{group_id}/streams`          | `/streams`                    |
| `GET`    | `/api/group/{group_id}/youtube/auth-url` | `/connectyoutube` (step 1)    |
| `DELETE` | `/api/group/{group_id}/youtube`          | `/disconnectyoutube`          |
| `POST`   | `/api/group/{group_id}/check`            | `/check`                      |

All handlers go in `src/main.py` above `async_main()`, following the `oauth_callback` pattern:

```python
async with db_context():
    result = await queries.some_function(...)
return web.json_response(result)
```

### Critical notes per endpoint

**`GET /api/group/{group_id}`** — strip `yt_access_token`, `yt_refresh_token`, `yt_token_expiry`. Convert SQLite 0/1 integers to Python `bool` for `auto_create` and `broadcast_made_for_kids`.

**`PATCH /api/group/{group_id}`** — allowlist field names before passing to `update_group`. Allowed fields:

```
timezone, reminder_hours, check_window_hours, auto_create,
broadcast_privacy, broadcast_description, broadcast_made_for_kids
```

Reject any key not in this list with HTTP 400. Both use an f-string to build SQL (`f"UPDATE groups SET {set_clause}"`), so untrusted field names are a SQL injection risk.

**`PATCH .../slots/{slot_id}`** — allowlist field names before passing to `update_slot`. Allowed fields:

```
title_template, custom_message
```

Reject any key not in this list with HTTP 400.

**`POST /api/group/{group_id}/check`** — call `run_polling_cycle(bot, group_id=int(group_id))` without wrapping in `db_context()` (it opens its own). Pull `bot = request.app["bot"]`.

**`GET /api/group/{group_id}/youtube/auth-url`** — call `build_auth_url(int(group_id))`, no DB needed.

**`DELETE /api/group/{group_id}/youtube`** — clear `yt_access_token`, `yt_refresh_token`, `yt_token_expiry`, `yt_channel_id`, `yt_channel_name` by calling `update_group` with those fields set to `None`.

**`GET /oauth/callback` (modify existing)** — after success, replace `return web.Response(...)` with:

```python
webapp_url = os.environ.get("WEBAPP_URL", "http://localhost:5173")
raise web.HTTPFound(location=f"{webapp_url}/?group_id={chat_id}&connected=1")
```

Keep `bot.send_message`.

### CORS

Add `aiohttp-cors` to dependencies. After creating `web.Application()`, set up CORS on all `/api/*` routes only. `/oauth/callback` does not need CORS.

---

## Frontend structure

Scaffold: `npm create vite@latest webapp -- --template react-ts`

Dependencies: `@mui/material @mui/icons-material @emotion/react @emotion/styled`

```
webapp/src/
├── main.tsx
├── App.tsx                    # ThemeProvider, GroupIdContext, main page, Snackbar
├── theme.ts                   # Light/dark MUI themes with accent colors
├── types.ts                   # Group, Slot, Stream interfaces
├── hooks/
│   └── useGroupId.ts          # Reads ?group_id= from URLSearchParams; returns null if missing
├── api/
│   ├── client.ts              # apiFetch<T> base helper — throws on non-2xx
│   ├── group.ts               # getGroup, patchGroup
│   ├── slots.ts               # listSlots, addSlot, removeSlot, updateSlot
│   ├── streams.ts             # listStreams
│   ├── youtube.ts             # getAuthUrl, disconnectYoutube
│   └── check.ts               # triggerCheck
└── components/
    ├── AppHeader.tsx           # Title + dark/light toggle
    ├── StatusSection.tsx       # Read-only display
    ├── YouTubeSection.tsx      # Connect / disconnect
    ├── SettingsSection.tsx     # All 7 /set* group-level fields
    ├── SlotsSection.tsx        # Slot list + add slot form
    ├── StreamsSection.tsx      # Numbered active streams table
    └── CheckSection.tsx        # Trigger sync button
```

### App.tsx state

- `darkMode: boolean`
- `group: Group | null`
- `slots: Slot[]`
- `streams: Stream[]`
- `formState: Partial<Group>` — local copy of group settings fields
- `slotEdits: Record<number, Partial<Slot>>` — dirty slot field changes
- `snackbar: { open: boolean; message: string; severity: 'success' | 'error' }`

### `?connected=1` handling (OAuth return)

On mount (after group data loads), check `URLSearchParams` for `connected=1`. If present:

1. Trigger refetch of `group` data
2. Show success snackbar: "YouTube connected successfully!"
3. Strip all query params except `group_id` via `window.history.replaceState`

### Settings section fields

| Field                     | MUI Control               | Notes                              |
| ------------------------- | ------------------------- | ---------------------------------- |
| `timezone`                | `TextField`               | Text input, non-empty string       |
| `reminder_hours`          | `TextField` type="number" | REAL, step 0.5                     |
| `check_window_hours`      | `TextField` type="number" | REAL, step 1                       |
| `auto_create`             | `Switch`                  | SQLite 0/1 → boolean               |
| `broadcast_privacy`       | `Select`                  | Options: public, unlisted, private |
| `broadcast_description`   | `TextField` multiline     | Free text                          |
| `broadcast_made_for_kids` | `Switch`                  | SQLite 0/1 → boolean               |

### Day-of-week mapping

DB stores 0=Monday (Python `weekday()`). Frontend select must use the same — **not** JavaScript's `Date.getDay()` (0=Sunday).

### Streams section columns

Numbered rows (1, 2, 3…). Columns:

| Column    | Notes                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------- |
| #         | Row number                                                                                        |
| Scheduled | `new Date(stream.scheduled_start * 1000).toLocaleString('default', { timeZone: group.timezone })` |
| Status    | Plain text                                                                                        |
| URL       | `<Link href={yt_url} target="_blank">` — show "—" if empty                                        |

### Slots section behavior

- Load `GET .../slots` on mount
- Each row: `day_of_week` (Monday–Sunday label), `local_time`, `title_template` inline `TextField`, `custom_message` inline `TextField`, delete `IconButton`
- "Add Slot" form: `day_of_week` as `<Select>` (Monday–Sunday), `local_time` as `<input type="time">`, `title_template` as `TextField`
- Add/remove: immediate API calls, re-fetch slots after
- `title_template` and `custom_message` edits collected in `slotEdits`, flushed on Save

---

## New env var

`WEBAPP_URL` — frontend origin used in OAuth redirect after YouTube connects. Default: `http://localhost:5173`.

---

## Out of scope (future work)

- Authentication / authorization (HMAC token or static secret)
- Production deployment / hosting
- Multi-group support in one browser session

---

## Known dev-mode limitation

`db_context()` uses a global `_connection`. Concurrent requests overwrite each other's connection — acceptable for a single dev user.

---

## Vite proxy config

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true },
    '/oauth': { target: 'http://localhost:8080', changeOrigin: true },
  }
}
```

---

## How to run

```bash
# Terminal 1
python -m src.main

# Terminal 2
cd webapp && npm install && npm run dev

# Browser
http://localhost:5173?group_id=<your_telegram_chat_id>
```

---

## Verification checklist

1. `http://localhost:5173?group_id=<id>` — Status section shows channel name and poll estimate
2. `http://localhost:5173` (no group_id) — Full-page error shown
3. Change a settings field, click Save — `PATCH /api/group/{id}` fires, "Settings saved" snackbar
4. Click "Connect YouTube" — redirects to Google OAuth; on return shows "YouTube connected successfully!" snackbar, YouTube section updates, URL stripped to `?group_id=<id>`
5. Add a slot — POST fires immediately, slot appears in list
6. Remove a slot — DELETE fires immediately, slot disappears
7. Edit `title_template` inline, click Save — `PATCH .../slots/{id}` fires
8. Click "Trigger Manual Sync" — `POST .../check` fires, bot runs a polling cycle
9. Force an API error (stop backend) — global error snackbar appears
