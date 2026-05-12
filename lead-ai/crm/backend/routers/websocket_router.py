"""
IBMP CRM — WebSocket Router
=============================
Endpoint: GET /ws/{tenant_id}   (upgraded to WebSocket)

Authentication flow:
  1. Client connects: ws://host/ws/{tenant_id}?token=<JWT>
  2. Server validates JWT, checks tenant_id matches token claim (or falls back
     to accepting any authenticated user for single-tenant deployments)
  3. Client receives {"type": "connected", "tenant_id": "...", "ts": "..."}
  4. Server delivers real-time events as JSON strings (see websocket_manager.py)
  5. Client can send {"type": "ping"} to keep connection alive
  6. Server responds to ping with {"type": "pong", "ts": "..."}
  7. Connection is removed from registry on disconnect

Supported event types (server → client):
  lead.created        lead.updated        lead.deleted
  note.created        activity.created
  assignment.changed  status.changed
  bulk.update         ai.score_updated
  ping / pong         connected / error
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from auth import SECRET_KEY, ALGORITHM
from token_blocklist import blocklist
from websocket_manager import _ws_manager, broadcast, register, unregister, connection_count

logger = logging.getLogger("ibmp.ws.router")

router = APIRouter(tags=["WebSocket"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _verify_ws_token(token: str) -> dict:
    """
    Validate the JWT supplied in the ?token= query parameter.
    Returns the decoded payload or raises ValueError.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}") from exc

    jti = payload.get("jti", "")
    if jti and blocklist.is_revoked(jti):
        raise ValueError("Token has been revoked")

    if not payload.get("sub"):
        raise ValueError("Token missing 'sub' claim")

    return payload


@router.websocket("/ws/{tenant_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    tenant_id: str,
    token: str = Query(default=""),
):
    """
    WebSocket endpoint for real-time CRM events.

    Connect:  ws://host/ws/{tenant_id}?token=<JWT>

    The tenant_id in the path is used to scope events.  For single-tenant
    deployments, use the literal string "default" as the tenant_id.

    The JWT must be valid and not revoked.  In multi-tenant mode, the JWT's
    tenant_id claim must match the path parameter.
    """
    # ── Step 1: Accept the WebSocket handshake FIRST ─────────────────────────
    # IMPORTANT: websocket.accept() MUST be called before any websocket.close()
    # call. Calling close() on an un-accepted connection causes the ASGI server
    # to return HTTP 500 instead of completing the WebSocket upgrade.
    await websocket.accept()

    # ── Step 2: Authenticate ──────────────────────────────────────────────────
    if not token:
        await websocket.send_text(json.dumps({
            "type":    "error",
            "code":    4001,
            "message": "Missing token",
            "ts":      _now_iso(),
        }))
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = _verify_ws_token(token)
    except ValueError as exc:
        await websocket.send_text(json.dumps({
            "type":    "error",
            "code":    4003,
            "message": str(exc),
            "ts":      _now_iso(),
        }))
        await websocket.close(code=4003, reason=str(exc))
        return

    # ── Step 3: Optionally validate tenant claim ───────────────────────────────
    # In multi-tenant mode the JWT should carry a tenant_id claim.
    # We fall back gracefully for single-tenant / legacy JWTs.
    jwt_tenant = payload.get("tenant_id", "")
    if jwt_tenant and jwt_tenant != tenant_id:
        await websocket.send_text(json.dumps({
            "type":    "error",
            "code":    4003,
            "message": "Tenant mismatch",
            "ts":      _now_iso(),
        }))
        await websocket.close(code=4003, reason="Tenant mismatch")
        return

    user_email = payload.get("sub", "unknown")
    user_role  = payload.get("role", "")

    # ── Step 4: Register ──────────────────────────────────────────────────────
    await register(tenant_id, websocket)

    logger.info(
        "WS accepted  user=%s  role=%s  tenant=%s  connections=%d",
        user_email, user_role, tenant_id, connection_count(tenant_id),
    )

    # ── Step 5: Send "connected" confirmation ─────────────────────────────────
    await websocket.send_text(json.dumps({
        "type":      "connected",
        "tenant_id": tenant_id,
        "user":      user_email,
        "ts":        _now_iso(),
    }))

    # ── Step 6: Message loop ──────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()

            # Parse client message (mostly pings from keep-alive)
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "ts":   _now_iso(),
                }))
            # Ignore unknown message types silently

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("WS error  user=%s  tenant=%s  — %s", user_email, tenant_id, exc)
    finally:
        await unregister(tenant_id, websocket)
        logger.info(
            "WS disconnected  user=%s  tenant=%s  remaining=%d",
            user_email, tenant_id, connection_count(tenant_id),
        )
