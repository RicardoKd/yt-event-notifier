# Telegram Web App — Full Scope Plan

This is the full-scope version of the Web App plan, including slot management and streams.

---

## UX Design

**Single page application.** All sections stacked vertically on one page (no tabs, no routing).
A persistent **"Save changes"** button at the bottom submits the entire group configuration.

Sections (top to bottom):

1. **Status** — read-only: YouTube channel, next poll estimate
2. **YouTube** — connect / disconnect (immediate action)
3. **Settings** — all `/set*` fields as MUI form controls
4. **Slots** — list with inline add/remove; title_template / custom_message editable inline
5. **Streams** — read-only table of active streams
6. **"Save changes"** button — `PATCH /api/group/{group_id}` + slot template/message updates
7. **"Trigger Manual Sync"** button — immediate action

**Header:** app title + light/dark toggle `IconButton` (right-aligned).

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

**`GET /api/group/{group_id}`** — strip `yt_access_token`, `yt_refresh_token`, `yt_token_expiry`. Convert SQLite 0/1 integers to Python `bool`.

**`PATCH /api/group/{group_id}` and `PATCH .../slots/{slot_id}`** — allowlist field names before passing to `update_group`/`update_slot`. Both use an f-string to build SQL (`f"UPDATE groups SET {set_clause}"`), so untrusted field names are an injection risk.

**`POST /api/group/{group_id}/check`** — call `run_polling_cycle(bot, group_id=int(group_id))` without wrapping in `db_context()` (it opens its own). Pull `bot = request.app["bot"]`.

**`GET /api/group/{group_id}/youtube/auth-url`** — call `build_auth_url(int(group_id))`, no DB needed.

**`GET /oauth/callback` (modify existing)** — after success, change `return web.Response(...)` to `raise web.HTTPFound(location=f"http://localhost:5173/?group_id={chat_id}&connected=1")`. Keep `bot.send_message`.

---

## Frontend structure

Scaffold: `npm create vite@latest webapp -- --template react-ts`

Dependencies: `@mui/material @mui/icons-material @emotion/react @emotion/styled react-router-dom`

```
webapp/src/
├── main.tsx
├── App.tsx                    # ThemeProvider, GroupIdContext, main page
├── theme.ts                   # Light/dark MUI themes with accent colors
├── types.ts                   # Group, Slot, Stream interfaces
├── hooks/
│   └── useGroupId.ts          # Reads ?group_id= from URLSearchParams
├── api/
│   ├── client.ts              # apiFetch<T> base helper
│   ├── group.ts               # getGroup, patchGroup
│   ├── slots.ts               # listSlots, addSlot, removeSlot, updateSlot
│   ├── streams.ts             # listStreams
│   ├── youtube.ts             # getAuthUrl, disconnectYoutube
│   └── check.ts               # triggerCheck
└── components/
    ├── AppHeader.tsx           # Title + dark/light toggle
    ├── StatusSection.tsx       # Read-only display
    ├── YouTubeSection.tsx      # Connect / disconnect
    ├── SettingsSection.tsx     # All /set* fields form
    ├── SlotsSection.tsx        # Slot list + add slot form
    ├── StreamsSection.tsx      # Active streams table
    └── CheckSection.tsx        # Trigger sync button
```

### Day-of-week mapping

DB stores 0=Monday (Python `weekday()`). Frontend select must use the same — **not** JavaScript's `Date.getDay()` (0=Sunday).

### Timestamps

`scheduled_start` is Unix seconds: `new Date(stream.scheduled_start * 1000).toLocaleString('default', { timeZone: group.timezone })`

### Slots section behavior

- Load `GET .../slots` on mount
- "Add Slot" form: `day_of_week` as `<Select>` (Monday–Sunday), `local_time` as `<input type="time">`, `title_template` as `TextField`
- Add/remove: immediate API calls
- `title_template` and `custom_message` per row: edited inline, collected in `slotEdits` state, flushed on Save

### App state (`App.tsx`)

- `darkMode: boolean`
- `group: Group | null`
- `slots: Slot[]`
- `streams: Stream[]`
- `formState` — local copy of group settings
- `slotEdits: Record<number, Partial<Slot>>` — dirty slot field changes

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
