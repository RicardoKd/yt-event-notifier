import asyncio
import logging
import os
import sys

import aiohttp_cors
from aiohttp import web
from dotenv import load_dotenv

from src.logging_config import setup_logging
from src.bot.commands import build_application
from src.db import queries
from src.db.client import db_context
from src.engine import run_polling_cycle
from src.youtube.oauth import build_auth_url, handle_oauth_callback


async def oauth_callback(request: web.Request) -> web.Response:
    bot = request.app["bot"]
    state = request.query.get("state")
    code = request.query.get("code")

    if not state or not code:
        return web.Response(text="Missing state or code", status=400)

    try:
        async with db_context():
            chat_id = await handle_oauth_callback(code, state)

        await bot.send_message(chat_id=chat_id, text="✅ YouTube successfully connected! You can now use the bot features.")
        webapp_url = os.environ.get("WEBAPP_URL", "http://localhost:5173")
        raise web.HTTPFound(location=f"{webapp_url}/?group_id={chat_id}&connected=1")
    except web.HTTPFound:
        raise
    except Exception as e:
        logging.exception("Failed to complete OAuth flow")
        return web.Response(text=f"Failed to connect: {e}", status=500)


async def api_get_group(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    async with db_context():
        group = await queries.get_group(group_id)
        if not group:
            return web.json_response({"error": "Group not found"}, status=404)
        
        data = dict(group)
        for field in ("yt_access_token", "yt_refresh_token", "yt_token_expiry"):
            data.pop(field, None)
            
        data["auto_create"] = bool(data.get("auto_create", 0))
        data["broadcast_made_for_kids"] = bool(data.get("broadcast_made_for_kids", 0))
        
        return web.json_response(data)

async def api_patch_group(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    allowed_fields = {
        "timezone", "reminder_hours", "check_window_hours", "auto_create",
        "broadcast_privacy", "broadcast_description", "broadcast_made_for_kids"
    }
    
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
        
    update_data = {}
    for key, value in body.items():
        if key not in allowed_fields:
            return web.json_response({"error": f"Field '{key}' not allowed"}, status=400)
        update_data[key] = value
        
    if not update_data:
        return web.json_response({"error": "No valid fields provided"}, status=400)
        
    async with db_context():
        await queries.update_group(group_id, **update_data)
        
    return web.json_response({"status": "success"})

async def api_get_slots(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    async with db_context():
        slots = await queries.list_slots(group_id)
        return web.json_response([dict(slot) for slot in slots])

async def api_add_slot(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
        
    required_fields = ["day_of_week", "local_time", "title_template"]
    if not all(field in body for field in required_fields):
        return web.json_response({"error": "Missing required fields"}, status=400)
        
    async with db_context():
        slot_id = await queries.add_slot(
            group_id, 
            body["day_of_week"], 
            body["local_time"], 
            body["title_template"]
        )
        return web.json_response({"slot_id": slot_id})

async def api_remove_slot(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    slot_id = int(request.match_info["slot_id"])
    async with db_context():
        await queries.remove_slot(slot_id, group_id)
        return web.json_response({"status": "success"})

async def api_patch_slot(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    slot_id = int(request.match_info["slot_id"])
    allowed_fields = {"title_template", "custom_message"}
    
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
        
    update_data = {}
    for key, value in body.items():
        if key not in allowed_fields:
            return web.json_response({"error": f"Field '{key}' not allowed"}, status=400)
        update_data[key] = value
        
    if not update_data:
        return web.json_response({"error": "No valid fields provided"}, status=400)
        
    async with db_context():
        await queries.update_slot(slot_id, group_id, **update_data)
        
    return web.json_response({"status": "success"})

async def api_get_streams(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    async with db_context():
        streams = await queries.list_active_streams(group_id)
        return web.json_response([dict(stream) for stream in streams])

async def api_get_youtube_auth_url(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    url = build_auth_url(group_id)
    return web.json_response({"url": url})

async def api_delete_youtube(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    async with db_context():
        await queries.update_group(
            group_id,
            yt_access_token=None,
            yt_refresh_token=None,
            yt_token_expiry=None,
            yt_channel_id=None,
            yt_channel_name=None
        )
    return web.json_response({"status": "success"})

async def api_trigger_check(request: web.Request) -> web.Response:
    group_id = int(request.match_info["group_id"])
    bot = request.app["bot"]
    await run_polling_cycle(bot, group_id=group_id)
    return web.json_response({"status": "success"})


async def async_main() -> None:
    profile = os.environ.get("APP_PROFILE", "dev").lower()
    
    if profile == "dev":
        print("Loading development profile...")
        load_dotenv()
        log_level = logging.DEBUG
    elif profile == "prod":
        print("Loading production profile...")
        log_level = logging.INFO
    else:
        print(f"Unknown profile '{profile}'. Exiting.")
        sys.exit(1)

    setup_logging(level=log_level, profile=profile)
    logger = logging.getLogger(__name__)
    logger.info("Starting application in %s mode", profile.upper())

    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.error("TELEGRAM_BOT_TOKEN is not set. Exiting.")
        sys.exit(1)

    app = build_application(token)
    
    if profile == "dev":
        logger.info("Starting Telegram bot polling and local web server...")
        await app.initialize()
        await app.start()
        assert app.updater
        await app.updater.start_polling()

        web_app = web.Application()
        web_app["bot"] = app.bot
        web_app.router.add_get('/oauth/callback', oauth_callback)

        web_app.router.add_get('/api/group/{group_id}', api_get_group)
        web_app.router.add_patch('/api/group/{group_id}', api_patch_group)
        web_app.router.add_get('/api/group/{group_id}/slots', api_get_slots)
        web_app.router.add_post('/api/group/{group_id}/slots', api_add_slot)
        web_app.router.add_delete('/api/group/{group_id}/slots/{slot_id}', api_remove_slot)
        web_app.router.add_patch('/api/group/{group_id}/slots/{slot_id}', api_patch_slot)
        web_app.router.add_get('/api/group/{group_id}/streams', api_get_streams)
        web_app.router.add_get('/api/group/{group_id}/youtube/auth-url', api_get_youtube_auth_url)
        web_app.router.add_delete('/api/group/{group_id}/youtube', api_delete_youtube)
        web_app.router.add_post('/api/group/{group_id}/check', api_trigger_check)

        cors = aiohttp_cors.setup(web_app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*",
            )
        })
        for route in list(web_app.router.routes()):
            if route.resource and route.resource.canonical.startswith("/api/"):
                cors.add(route)
        
        runner = web.AppRunner(web_app)
        await runner.setup()
        port = int(os.environ.get("LOCAL_PORT", 8080))
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        logger.info("Local web server listening on port %d for callbacks", port)
        
        stop_event = asyncio.Event()
        await stop_event.wait()
    else:
        # In prod, AWS Lambda handles API Gateway webhooks and cron events.
        logger.info("PROD mode detected. In production, this bot should be triggered via AWS Lambda.")


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
