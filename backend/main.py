import logging
import os
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from telegram import Update

from backend.logging_config import setup_logging
from backend.bot.commands import build_application
from backend.db import queries
from backend.db.client import db_context, set_db
from backend.engine import run_polling_cycle
from backend.youtube.oauth import build_auth_url, handle_oauth_callback

# Setup logging
setup_logging(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global bot instance (lazy loaded)
_bot_app = None

def get_bot_app():
    global _bot_app
    if _bot_app is None:
        token = os.environ.get("TELEGRAM_BOT_TOKEN")
        if not token:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")
        _bot_app = build_application(token)
    return _bot_app

@app.get("/oauth/callback")
async def oauth_callback(state: str, code: str):
    if not state or not code:
        raise HTTPException(status_code=400, detail="Missing state or code")

    try:
        async with db_context():
            chat_id = await handle_oauth_callback(code, state)

        bot_app = get_bot_app()
        await bot_app.bot.send_message(chat_id=chat_id, text="✅ YouTube successfully connected! You can now use the bot features.")
        
        webapp_url = os.environ.get("WEBAPP_URL", "http://localhost:5173")
        return RedirectResponse(url=f"{webapp_url}/?group_id={chat_id}&connected=1")
    except Exception as e:
        logger.exception("Failed to complete OAuth flow")
        raise HTTPException(status_code=500, detail=f"Failed to connect: {e}")

@app.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    bot_app = get_bot_app()
    data = await request.json()
    update = Update.de_json(data, bot_app.bot)
    
    # We need to ensure DB context is available for command handlers
    # This might need a custom middleware or decorator in bot/commands.py
    # For now, we assume command handlers open their own context if needed
    async with bot_app:
        await bot_app.process_update(update)
    
    return {"status": "ok"}

@app.get("/api/group/{group_id}")
async def api_get_group(group_id: int):
    async with db_context():
        group = await queries.get_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        data = dict(group)
        for field in ("yt_access_token", "yt_refresh_token", "yt_token_expiry"):
            data.pop(field, None)
            
        data["auto_create"] = bool(data.get("auto_create", 0))
        data["broadcast_made_for_kids"] = bool(data.get("broadcast_made_for_kids", 0))
        
        return data

@app.patch("/api/group/{group_id}")
async def api_patch_group(group_id: int, body: dict[str, Any]):
    allowed_fields = {
        "timezone", "reminder_hours", "check_window_hours", "auto_create",
        "broadcast_privacy", "broadcast_description", "broadcast_made_for_kids"
    }
    
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields provided")
        
    async with db_context():
        await queries.update_group(group_id, **update_data)
        
    return {"status": "success"}

@app.get("/api/group/{group_id}/slots")
async def api_get_slots(group_id: int):
    async with db_context():
        slots = await queries.list_slots(group_id)
        return [dict(slot) for slot in slots]

@app.post("/api/group/{group_id}/slots")
async def api_add_slot(group_id: int, body: dict[str, Any]):
    required_fields = ["day_of_week", "local_time", "title_template"]
    if not all(field in body for field in required_fields):
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    async with db_context():
        slot_id = await queries.add_slot(
            group_id, 
            body["day_of_week"], 
            body["local_time"], 
            body["title_template"]
        )
        return {"slot_id": slot_id}

@app.delete("/api/group/{group_id}/slots/{slot_id}")
async def api_remove_slot(group_id: int, slot_id: int):
    async with db_context():
        await queries.remove_slot(slot_id, group_id)
        return {"status": "success"}

@app.patch("/api/group/{group_id}/slots/{slot_id}")
async def api_patch_slot(group_id: int, slot_id: int, body: dict[str, Any]):
    allowed_fields = {"title_template", "custom_message"}
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields provided")
        
    async with db_context():
        await queries.update_slot(slot_id, group_id, **update_data)
        
    return {"status": "success"}

@app.get("/api/group/{group_id}/streams")
async def api_get_streams(group_id: int):
    async with db_context():
        streams = await queries.list_active_streams(group_id)
        return [dict(stream) for stream in streams]

@app.get("/api/group/{group_id}/youtube/auth-url")
async def api_get_youtube_auth_url(group_id: int):
    url = build_auth_url(group_id)
    return {"url": url}

@app.delete("/api/group/{group_id}/youtube")
async def api_delete_youtube(group_id: int):
    async with db_context():
        await queries.update_group(
            group_id,
            yt_access_token=None,
            yt_refresh_token=None,
            yt_token_expiry=None,
            yt_channel_id=None,
            yt_channel_name=None
        )
    return {"status": "success"}

@app.post("/api/group/{group_id}/check")
async def api_trigger_check(group_id: int):
    bot_app = get_bot_app()
    await run_polling_cycle(bot_app.bot, group_id=group_id)
    return {"status": "success"}

# Cloudflare Workers entry points
async def on_fetch(request, env):
    # Set the DB binding for the context
    set_db(env.DB)
    # Patch os.environ with env vars from Cloudflare
    for key, value in env.items():
        if isinstance(value, str):
            os.environ[key] = value
    
    import asgi_correlation_id # Optional, just to show how to use env
    # Using a simple ASGI adapter (FastAPI is ASGI)
    from fastapi.testclient import TestClient # Not for production, use proper ASGI adapter
    # In a real Cloudflare Python Worker, you'd use the provided ASGI wrapper
    # For now, we'll assume the environment handles the FastAPI app 'app'
    return await app(request.scope, request.receive, request.send)

async def on_scheduled(event, env):
    set_db(env.DB)
    for key, value in env.items():
        if isinstance(value, str):
            os.environ[key] = value
            
    bot_app = get_bot_app()
    await run_polling_cycle(bot_app.bot)
