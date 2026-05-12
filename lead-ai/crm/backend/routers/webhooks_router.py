"""
IBMP CRM — Webhooks Router
============================
Inbound webhooks from external systems.

Routes:
  POST /api/webhooks/google-sheets   — Apps Script → CRM two-way sync
  GET  /api/webhooks/google-sheets   — health check / connection test
  POST /api/webhooks/test            — manual test endpoint (dev only)

Security:
  The Google Sheets endpoint verifies an HMAC-SHA256 signature supplied
  in the  X-Webhook-Signature  header (set SHEETS_WEBHOOK_SECRET in .env).
  In dev mode (secret not set) the check is bypassed with a warning.
"""

import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from logger_config import logger
from sheets_sync_service import sheets_sync, verify_webhook_signature

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


def _safe_exc_message(exc: Exception) -> str:
    """Return a stable, readable exception message (never raises)."""
    try:
        # KeyError('code') from the supabase/postgrest library gives str == "'code'"
        # which is confusing — surface the full repr instead.
        if isinstance(exc, KeyError):
            return f"KeyError: {repr(exc.args[0])} — Supabase schema mismatch or unexpected API response"
        txt = str(exc)
        if txt and txt not in ("", "''"):
            return txt
    except Exception:
        pass
    try:
        return repr(exc)
    except Exception:
        return exc.__class__.__name__


# ── Google Sheets → CRM ───────────────────────────────────────────────────────

@router.get("/google-sheets")
async def google_sheets_health():
    """
    Verification endpoint called by Apps Script when it first connects.
    Returns a JSON acknowledgement so the admin knows the webhook URL works.
    """
    return {
        "status":     "ok",
        "service":    "IBMP CRM — Google Sheets webhook",
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "version":    "2.0",
        "directions": ["sheet→crm", "crm→sheet"],
    }


@router.post("/google-sheets")
async def google_sheets_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_webhook_signature: str = Header(default="", alias="X-Webhook-Signature"),
    x_webhook_secret:    str = Header(default="", alias="X-Webhook-Secret"),
):
    """
    Receives row-edit events from the Apps Script onEdit() trigger.

    Apps Script sends a POST with JSON body:
    {
      "lead_id":    "LEAD260508AB1234",
      "row_number": 42,
      "sheet_name": "Leads",
      "_edited_at": "2026-05-11T12:34:56Z",
      "changes": {
        "status":       "Converted",
        "follow_up_date": "2026-05-20",
        "assigned_to":  "Priya Sharma"
      }
    }

    Also supports a batch payload:
    {
      "batch": [ { ...row payload... }, ... ]
    }
    """
    raw_body = await request.body()

    # ── Signature verification ────────────────────────────────────────────────
    # Accept either HMAC header (preferred) or plain-secret header (simpler Apps Script)
    sig = x_webhook_signature or ""
    if not sig and x_webhook_secret:
        # Simple shared-secret fallback
        configured_secret = os.getenv("SHEETS_WEBHOOK_SECRET", "")
        if configured_secret and x_webhook_secret != configured_secret:
            raise HTTPException(status_code=403, detail="Invalid webhook secret")
    elif sig:
        if not verify_webhook_signature(raw_body, sig):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    # ── Parse body ────────────────────────────────────────────────────────────
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # ── Batch vs single ───────────────────────────────────────────────────────
    if "batch" in payload:
        rows = payload["batch"]
        if not isinstance(rows, list):
            raise HTTPException(status_code=400, detail="'batch' must be a list")

        results = []
        for row in rows[:100]:  # max 100 rows per batch
            result = sheets_sync.process_sheet_edit(row)
            results.append(result.to_dict())

            # Broadcast live update for accepted changes
            if result.accepted:
                background_tasks.add_task(
                    _broadcast_sync_event,
                    row.get("lead_id", ""),
                    result.accepted,
                    request,
                )

        ok     = sum(1 for r in results if r["status"] == "ok")
        errors = sum(1 for r in results if r["status"] == "error")
        return {
            "status":   "batch_complete",
            "total":    len(results),
            "ok":       ok,
            "errors":   errors,
            "results":  results,
        }

    # ── Single row ────────────────────────────────────────────────────────────
    result = sheets_sync.process_sheet_edit(payload)

    if result.accepted:
        background_tasks.add_task(
            _broadcast_sync_event,
            payload.get("lead_id", ""),
            result.accepted,
            request,
        )

    status_code = 200
    if result.status == "error":
        status_code = 422

    return JSONResponse(status_code=status_code, content=result.to_dict())


# ── Sync-all push from Apps Script ───────────────────────────────────────────

@router.post("/sync-all-from-sheet")
async def sync_all_from_sheet(
    request: Request,
    x_webhook_secret: str = Header(default="", alias="X-Webhook-Secret"),
):
    """
    Receives ALL sheet rows pushed by syncAllLeads() in the Apps Script.
    No Google Cloud credentials required — Apps Script pushes to us.

    Body: { "leads": [ { ...lead fields... }, ... ] }
    Returns: { "created": N, "updated": N, "results": [...] }
    """
    configured_secret = os.getenv("SHEETS_WEBHOOK_SECRET", "")
    if configured_secret and x_webhook_secret != configured_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    raw_body = await request.body()
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    leads = payload.get("leads", [])
    if not isinstance(leads, list):
        raise HTTPException(status_code=400, detail="'leads' must be a list")

    from supabase_data_layer import supabase_data
    import uuid as _uuid


    created  = 0
    updated  = 0
    results  = []

    for lead in leads[:500]:
        lead_id = lead.pop("lead_id", None)
        lead.pop("_sheet_name", None)
        lead.pop("_row_number", None)
        lead = {k: (v if v != "" else None) for k, v in lead.items()}

        # Ensure tenant_id is present for multi-tenant schemas.
        # Safe no-op if column doesn't exist or DB defaults already handle it.
        # Removed tenant_id assignment as per new schema requirements

        try:
            if lead_id:
                supabase_data.update_lead(lead_id, lead)
                updated += 1
                results.append({"lead_id": lead_id, "action": "updated"})
            else:
                # Generate lead_id in the same format as leads_router
                _ts   = datetime.now(timezone.utc).strftime("%y%m%d%H%M%S")
                _rand = _uuid.uuid4().hex[:8].upper()
                lead["lead_id"] = f"LEAD{_ts}{_rand}"
                lead.setdefault("status", "Fresh")
                lead.setdefault("source", "Google Sheet")

                new_lead = supabase_data.create_lead(lead)
                if new_lead:
                    new_id = new_lead.get("lead_id", lead["lead_id"])
                    created += 1
                    results.append({"lead_id": new_id, "action": "created"})
                else:
                    results.append({"lead_id": lead["lead_id"], "action": "error", "detail": "create_lead returned None"})
        except Exception as exc:
            msg = _safe_exc_message(exc)
            logger.warning(f"sync-all-from-sheet lead error: {msg}")
            results.append({"lead_id": lead_id or "", "action": "error", "detail": msg})

    logger.info(f"sync-all-from-sheet: created={created} updated={updated} total={len(leads)}")
    return {"created": created, "updated": updated, "total": len(leads), "results": results}


# ── Dev-only test endpoint ────────────────────────────────────────────────────

@router.post("/test")
async def test_webhook(request: Request):
    """
    Manual test for verifying webhook connectivity (returns request echo).
    Disabled in production via ENVIRONMENT check.
    """
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=404, detail="Not found")

    raw_body = await request.body()
    try:
        body = json.loads(raw_body)
    except Exception:
        body = raw_body.decode("utf-8", errors="replace")

    return {
        "received": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "body":    body,
        "headers": dict(request.headers),
    }


# ── Background task: broadcast WS event ──────────────────────────────────────

async def _broadcast_sync_event(lead_id: str, accepted: dict, request: Request) -> None:
    """Fire a WebSocket event so the UI refreshes the lead instantly."""
    try:
        from websocket_manager import broadcast as _ws_broadcast
        from auth import SECRET_KEY, ALGORITHM
        from jose import jwt as _jose

        tenant_id = "default"
        try:
            ah = request.headers.get("Authorization", "")
            if ah.startswith("Bearer "):
                p = _jose.decode(ah.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
                tenant_id = p.get("tenant_id") or "default"
        except Exception:
            pass

        await _ws_broadcast(
            tenant_id=tenant_id,
            event_type="lead.updated",
            payload={
                "lead_id":        lead_id,
                "source":         "google_sheets",
                "updated_fields": list(accepted.keys()),
            },
        )
    except Exception as exc:
        logger.debug("Sheets webhook: WS broadcast skipped — %s", exc)
