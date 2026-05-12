"""
IBMP CRM — WebSocket Connection Manager + Redis Pub/Sub
=========================================================
Architecture:
  - Each connected browser holds an authenticated WebSocket at /ws/{tenant_id}
  - On any lead/note/activity mutation, the calling router publishes an event to
    Redis channel  crm:events:{tenant_id}
  - A single background asyncio task subscribes to ALL channels and fans out each
    message to every live WebSocket in the same tenant
  - If Redis is unavailable, events are published directly to in-process queues
    (works in single-instance dev/test; cross-instance delivery requires Redis)

Event envelope (JSON):
  {
    "type":       "lead.updated" | "lead.created" | "lead.deleted"
               | "note.created" | "activity.created"
               | "assignment.changed" | "status.changed"
               | "ping",
    "tenant_id":  "...",
    "payload":    { ... event-specific data ... },
    "ts":         "2026-05-11T12:34:56.789Z"   // ISO-8601
  }

Usage in a router:
    from websocket_manager import broadcast

    await broadcast(tenant_id="abc123", event_type="lead.updated", payload={
        "lead_id": "LEAD...", "field": "status", "old": "Fresh", "new": "Contacted"
    })
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger("ibmp.ws")

# ── Redis channel prefix ──────────────────────────────────────────────────────
_CHANNEL_PREFIX = "crm:events:"


# ── Redis async client (aioredis / redis-py ≥ 4.2) ───────────────────────────
def _build_async_redis():
    """Return an async Redis client or None if Redis is unavailable."""
    url = os.getenv("REDIS_URL", "")
    if not url:
        return None
    try:
        import redis.asyncio as aioredis  # redis-py ≥ 4.2
        client = aioredis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        logger.info("✅  WebSocket pub/sub: Redis connected (%s)", url.split("@")[-1])
        return client
    except ImportError:
        logger.warning("WebSocket pub/sub: redis-py not installed — using in-process fallback")
        return None
    except Exception as exc:
        logger.warning("WebSocket pub/sub: Redis unavailable (%s) — using in-process fallback", exc)
        return None


# ── In-process broadcast queues (fallback when Redis is not available) ────────
# Maps  tenant_id → set of asyncio.Queue instances (one per live WebSocket)
_local_queues: Dict[str, Set[asyncio.Queue]] = {}


# ── WebSocket connection registry ─────────────────────────────────────────────
class _ConnectionSet:
    """Thread-safe (asyncio) set of WebSocket connections per tenant."""

    def __init__(self):
        # tenant_id → set[WebSocket]
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, tenant_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.setdefault(tenant_id, set()).add(ws)
        logger.info("WS connected  tenant=%s  total=%d", tenant_id,
                    len(self._connections.get(tenant_id, set())))

    async def disconnect(self, tenant_id: str, ws: WebSocket) -> None:
        async with self._lock:
            bucket = self._connections.get(tenant_id, set())
            bucket.discard(ws)
            if not bucket:
                self._connections.pop(tenant_id, None)
        logger.info("WS disconnected  tenant=%s  remaining=%d", tenant_id,
                    len(self._connections.get(tenant_id, set())))

    async def send_to_tenant(self, tenant_id: str, message: str) -> None:
        """Fan-out a JSON string to every WebSocket in the tenant bucket."""
        bucket = self._connections.get(tenant_id, set()).copy()
        dead: list[WebSocket] = []
        for ws in bucket:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        # Clean up dead connections without holding the lock during IO
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.get(tenant_id, set()).discard(ws)

    def count(self, tenant_id: str) -> int:
        return len(self._connections.get(tenant_id, set()))


_registry = _ConnectionSet()


# ── Public API ────────────────────────────────────────────────────────────────

async def register(tenant_id: str, ws: WebSocket) -> None:
    """Call on WebSocket connect, after ws.accept()."""
    await _registry.connect(tenant_id, ws)


async def unregister(tenant_id: str, ws: WebSocket) -> None:
    """Call on WebSocket disconnect."""
    await _registry.disconnect(tenant_id, ws)


async def broadcast(
    tenant_id: str,
    event_type: str,
    payload: Optional[dict] = None,
) -> None:
    """
    Publish an event to all WebSocket clients of a tenant.

    If Redis is available, the event is published to Redis and the subscriber
    background task delivers it.  Otherwise it goes directly to in-process queues.

    Parameters
    ----------
    tenant_id:   Tenant UUID string
    event_type:  e.g. "lead.updated", "lead.created", "status.changed"
    payload:     Arbitrary JSON-serialisable dict with event details
    """
    envelope = json.dumps({
        "type":      event_type,
        "tenant_id": tenant_id,
        "payload":   payload or {},
        "ts":        datetime.now(timezone.utc).isoformat(),
    })

    redis = _ws_manager._redis
    if redis:
        try:
            await redis.publish(f"{_CHANNEL_PREFIX}{tenant_id}", envelope)
            return
        except Exception as exc:
            logger.warning("Redis publish failed (%s) — falling back to in-process", exc)

    # ── In-process fallback ───────────────────────────────────────────────────
    await _registry.send_to_tenant(tenant_id, envelope)


def connection_count(tenant_id: str) -> int:
    """Return the number of live WebSocket connections for a tenant."""
    return _registry.count(tenant_id)


# ── Redis subscriber background task ─────────────────────────────────────────

class WebSocketManager:
    """
    Lifecycle manager: holds the async Redis client and runs the Pub/Sub
    subscriber loop as a background asyncio task.

    Instantiated once as a module-level singleton (_ws_manager).
    Call .start() in the FastAPI lifespan startup, .stop() on shutdown.
    """

    def __init__(self):
        self._redis = _build_async_redis()
        self._task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the Redis subscriber loop (no-op if Redis is unavailable)."""
        if self._redis is None:
            logger.info("WS manager: no Redis — using in-process broadcast only")
            return
        self._task = asyncio.create_task(self._subscribe_loop(), name="ws-redis-subscriber")
        logger.info("✅  WS manager: Redis Pub/Sub subscriber started")

    async def stop(self) -> None:
        """Cancel the subscriber loop and close the Redis connection."""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass
        logger.info("WS manager: shut down")

    async def _subscribe_loop(self) -> None:
        """
        Subscribe to the wildcard pattern  crm:events:*  and deliver each
        incoming message to all connected clients for that tenant.
        """
        while True:
            try:
                pubsub = self._redis.pubsub()
                await pubsub.psubscribe(f"{_CHANNEL_PREFIX}*")
                logger.info("WS subscriber: listening on %s*", _CHANNEL_PREFIX)

                async for message in pubsub.listen():
                    if message["type"] != "pmessage":
                        continue
                    data = message.get("data", "")
                    if not isinstance(data, str):
                        continue
                    try:
                        evt = json.loads(data)
                        tenant_id = evt.get("tenant_id", "")
                        if tenant_id:
                            await _registry.send_to_tenant(tenant_id, data)
                    except (json.JSONDecodeError, Exception) as exc:
                        logger.debug("WS subscriber: bad message — %s", exc)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("WS subscriber crashed (%s) — restarting in 3s", exc)
                await asyncio.sleep(3)


# Module-level singleton — imported by main.py and websocket_router.py
_ws_manager = WebSocketManager()
