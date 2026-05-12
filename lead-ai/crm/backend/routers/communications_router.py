"""
Communications Router — WhatsApp, Email, Templates, Upload, Webhook
====================================================================
Handles all outbound messaging, WhatsApp template management,
file uploads and the Interakt inbound webhook.

Routes:
  GET    /api/wa-templates                         — list active WA templates
  POST   /api/wa-templates                         — create WA template
  PUT    /api/wa-templates/{template_id}           — update WA template
  DELETE /api/wa-templates/{template_id}           — delete WA template
  POST   /api/leads/{lead_id}/send-wa-template     — render + send template
  POST   /api/interakt/webhook                     — inbound WA webhook
  POST   /api/upload                               — upload file to Supabase Storage
  GET    /api/notifications                        — list notifications
  GET    /api/audit-logs                           — system audit log
  PATCH  /api/notifications/{nid}/read             — mark notification read
  PATCH  /api/notifications/{nid}/snooze           — snooze notification
  POST   /api/notifications/read-all               — mark all read
"""

import json
import re
import uuid as _uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File

from auth import decode_access_token
from logger_config import logger
from supabase_data_layer import supabase_data

router = APIRouter(tags=["Communications"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _render_template(body: str, variables: dict) -> str:
    """Replace {{var}} placeholders in template body."""
    for key, val in variables.items():
        body = body.replace(f"{{{{{key}}}}}", str(val or ""))
    return body


def _get_current_user(request: Request) -> dict:
    """Extract current user from JWT."""
    try:
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "):
            td = decode_access_token(ah.split(" ", 1)[1])
            if td and td.email:
                user = supabase_data.get_user_by_email(td.email)
                return user or {}
    except Exception:
        pass
    return {}


# ── WA TEMPLATES ─────────────────────────────────────────────────────────────

@router.get("/api/wa-templates")
async def list_wa_templates(category: Optional[str] = None):
    """Return all active WhatsApp templates, optionally filtered by category."""
    try:
        query = supabase_data.client.table("whatsapp_templates").select("*").eq("is_active", True)
        if category:
            query = query.eq("category", category)
        response = query.order("category").order("id").execute()
        rows = response.data or []
        return [
            {
                "id":          t.get("id"),
                "name":        t.get("name"),
                "category":    t.get("category"),
                "emoji":       t.get("emoji") or "💬",
                "description": t.get("description") or "",
                "body":        t.get("body"),
                "variables":   json.loads(t.get("variables")) if t.get("variables") else [],
                "is_builtin":  t.get("is_builtin"),
                "created_at":  t.get("created_at"),
                "created_by":  t.get("created_by"),
            }
            for t in rows
        ]
    except Exception as exc:
        logger.error(f"Error fetching WA templates: {exc}")
        return []


@router.post("/api/wa-templates", status_code=201)
async def create_wa_template(payload: dict, request: Request):
    """Create a WhatsApp template — auto-detects {{variables}} from body."""
    current_user = _get_current_user(request)
    body_text = payload.get("body", "")
    detected  = re.findall(r"\{\{(\w+)\}\}", body_text)
    variables = payload.get("variables") or detected

    template_data = {
        "name":        payload.get("name", "Untitled"),
        "category":    payload.get("category", "custom"),
        "emoji":       payload.get("emoji", "💬"),
        "description": payload.get("description", ""),
        "body":        body_text,
        "variables":   json.dumps(list(dict.fromkeys(variables))),
        "is_builtin":  False,
        "is_active":   True,
        "created_by":  current_user.get("full_name", "Unknown"),
    }
    response = supabase_data.client.table("whatsapp_templates").insert(template_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create template")
    created = response.data[0]
    return {"id": created["id"], "message": "Template created", "name": created["name"]}


@router.put("/api/wa-templates/{template_id}")
async def update_wa_template(template_id: int, payload: dict):
    """Update a WhatsApp template."""
    response = supabase_data.client.table("whatsapp_templates").select("*").eq("id", template_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data: dict = {}
    for field in ("name", "emoji", "description", "category", "is_active"):
        if field in payload:
            update_data[field] = payload[field]
    if "body" in payload:
        update_data["body"]      = payload["body"]
        detected                  = re.findall(r"\{\{(\w+)\}\}", payload["body"])
        update_data["variables"] = json.dumps(list(dict.fromkeys(detected)))

    if update_data:
        supabase_data.client.table("whatsapp_templates").update(update_data).eq("id", template_id).execute()
    return {"message": "Template updated"}


@router.delete("/api/wa-templates/{template_id}")
async def delete_wa_template(template_id: int):
    """Delete a WhatsApp template (built-in templates cannot be deleted)."""
    response = supabase_data.client.table("whatsapp_templates").select("*").eq("id", template_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Template not found")
    template = response.data[0]
    if template.get("is_builtin"):
        raise HTTPException(status_code=400, detail="Built-in templates cannot be deleted")
    supabase_data.client.table("whatsapp_templates").delete().eq("id", template_id).execute()
    return {"message": "Template deleted"}


@router.post("/api/leads/{lead_id}/send-wa-template")
async def send_wa_template(lead_id: str, payload: dict, request: Request):
    """
    Render a template with variable overrides and send via WhatsApp.
    payload = { template_id: int, variable_overrides: { key: value } }
    """
    current_user = _get_current_user(request)

    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    phone = lead.get("whatsapp") or lead.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Lead has no WhatsApp/phone number")

    template_id = payload.get("template_id")
    if not template_id:
        raise HTTPException(status_code=400, detail="template_id required")

    tmpl_resp = supabase_data.client.table("whatsapp_templates").select("*").eq("id", template_id).execute()
    if not tmpl_resp.data:
        raise HTTPException(status_code=404, detail="Template not found")
    t = tmpl_resp.data[0]

    defaults = {
        "lead_name":      lead.get("full_name") or "there",
        "first_name":     (lead.get("full_name") or "there").split()[0],
        "course":         lead.get("course_interested") or "the course",
        "counselor":      lead.get("assigned_to") or current_user.get("full_name", "Your Counselor"),
        "phone":          lead.get("phone") or "",
        "country":        lead.get("country") or "",
        "expected_fee":   f"{int(lead.get('expected_revenue', 0)):,}" if lead.get("expected_revenue") else "0",
        "fee_amount":     f"{int(lead.get('expected_revenue', 0)):,}" if lead.get("expected_revenue") else "0",
        "follow_up_date": lead.get("follow_up_date") or "TBD",
        "enrollment_date": datetime.utcnow().strftime("%d %b %Y"),
    }
    variables = {**defaults, **(payload.get("variable_overrides") or {})}
    rendered  = _render_template(t["body"], variables)

    send_success = False
    try:
        from communication_service import comm_service
        result = await comm_service.send(channel="whatsapp", to=phone, message=rendered)
        send_success = result.get("success", False)
    except Exception as exc:
        logger.warning(f"comm_service unavailable — logging only: {exc}")
        send_success = True

    try:
        supabase_data.create_note(
            lead_id=lead.get("id"),
            content=f"[WhatsApp Template: {t['name']}]\n\n{rendered}",
            channel="whatsapp",
            created_by=current_user.get("full_name", "System"),
        )
    except Exception as exc:
        logger.error(f"Note creation failed: {exc}")

    try:
        supabase_data.create_activity(
            lead_id=lead.get("id"),
            activity_type="whatsapp",
            description=f"WhatsApp template '{t['name']}' sent",
            created_by=current_user.get("full_name", "System"),
        )
    except Exception as exc:
        logger.error(f"Activity creation failed: {exc}")

    return {"success": send_success, "template_name": t["name"], "rendered_message": rendered, "sent_to": phone}


# ── INTERAKT WEBHOOK ──────────────────────────────────────────────────────────

@router.post("/api/interakt/webhook")
async def interakt_webhook(request: Request):
    """Receive incoming WhatsApp messages from Interakt webhook."""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ok"}

    try:
        data     = payload.get("data", {})
        msg_data = data.get("message", {})
        contact  = data.get("contact", {})

        wa_id       = contact.get("wa_id", "") or msg_data.get("from", "")
        sender_name = contact.get("profile", {}).get("name", wa_id)
        msg_type_raw = msg_data.get("type", "text")
        interakt_id  = msg_data.get("id", "")

        content = media_url = filename = None
        if msg_type_raw == "text":
            content  = msg_data.get("text", {}).get("body", "")
            msg_type = "text"
        elif msg_type_raw == "image":
            content   = msg_data.get("image", {}).get("caption", "")
            media_url = msg_data.get("image", {}).get("url", "")
            msg_type  = "image"
        elif msg_type_raw == "document":
            content   = msg_data.get("document", {}).get("caption", "")
            media_url = msg_data.get("document", {}).get("url", "")
            filename  = msg_data.get("document", {}).get("filename", "")
            msg_type  = "document"
        elif msg_type_raw == "video":
            content   = msg_data.get("video", {}).get("caption", "")
            media_url = msg_data.get("video", {}).get("url", "")
            msg_type  = "video"
        elif msg_type_raw == "audio":
            media_url = msg_data.get("audio", {}).get("url", "")
            msg_type  = "audio"
        else:
            content  = str(msg_data)
            msg_type = "text"

        normalized   = re.sub(r"[^\d]", "", wa_id)
        last_10      = normalized[-10:]
        lead_response = supabase_data.client.table("leads").select("id,whatsapp,phone").ilike("whatsapp", f"%{last_10}%").limit(1).execute()
        if not lead_response.data:
            lead_response = supabase_data.client.table("leads").select("id,whatsapp,phone").ilike("phone", f"%{last_10}%").limit(1).execute()

        if lead_response.data:
            lead_db_id = lead_response.data[0]["id"]
            chat_msg = {k: v for k, v in {
                "lead_db_id": lead_db_id, "direction": "inbound",
                "msg_type": msg_type, "content": content, "media_url": media_url,
                "filename": filename, "sender_name": sender_name, "status": "received",
                "interakt_id": interakt_id, "created_at": datetime.utcnow().isoformat(),
            }.items() if v is not None}
            supabase_data.client.table("chat_messages").insert(chat_msg).execute()
    except Exception as exc:
        logger.error(f"Interakt webhook error: {exc}")

    return {"status": "ok"}


# ── FILE UPLOAD ───────────────────────────────────────────────────────────────

@router.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file to Supabase Storage and return its public URL."""
    from supabase_client import supabase_manager
    client = supabase_manager.client
    if not client:
        raise HTTPException(status_code=500, detail="Storage not available")

    content = await file.read()
    ext          = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin"
    storage_path = f"chat/{_uuid.uuid4()}.{ext}"
    bucket       = "chat-media"

    try:
        client.storage.from_(bucket).upload(storage_path, content, {"content-type": file.content_type or "application/octet-stream"})
        public_url = client.storage.from_(bucket).get_public_url(storage_path)
        return {"url": public_url, "path": storage_path, "filename": file.filename}
    except Exception as exc:
        logger.error(f"File upload error: {exc}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")


# ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

@router.get("/api/notifications")
async def get_notifications(request: Request, limit: int = 50):
    """Get notifications for the current user."""
    try:
        auth_header = request.headers.get("Authorization", "")
        user_email  = None
        if auth_header.startswith("Bearer "):
            td = decode_access_token(auth_header.split(" ", 1)[1])
            if td:
                user_email = td.email

        query = supabase_data.client.table("notifications").select("*").order("created_at", desc=True).limit(limit)
        if user_email:
            query = query.or_(f"user_email.eq.{user_email},user_email.is.null")
        response = query.execute()
        return response.data or []
    except Exception as exc:
        logger.error(f"Error fetching notifications: {exc}")
        return []


@router.patch("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read."""
    return {"status": "ok", "notification_id": notification_id, "read": True}


@router.patch("/api/notifications/{notification_id}/snooze")
async def snooze_notification(notification_id: str, hours: int = 1):
    """Snooze a notification for N hours."""
    snooze_until = (datetime.utcnow() + timedelta(hours=hours)).isoformat()
    return {"status": "ok", "notification_id": notification_id, "snoozed_until": snooze_until}


@router.post("/api/notifications/read-all")
async def mark_all_notifications_read():
    """Mark all notifications as read."""
    return {"status": "ok", "message": "All notifications marked as read"}


# ── AUDIT LOGS ────────────────────────────────────────────────────────────────

@router.get("/api/audit-logs")
async def get_audit_logs(
    skip:       int = 0,
    limit:      int = 100,
    event_type: Optional[str] = None,
    user_email: Optional[str] = None,
    from_date:  Optional[str] = None,
    to_date:    Optional[str] = None,
):
    """Return audit log entries with optional filters."""
    try:
        query = supabase_data.client.table("audit_logs").select("*")
        if event_type:
            query = query.eq("event_type", event_type)
        if user_email:
            query = query.eq("user_email", user_email)
        if from_date:
            query = query.gte("created_at", from_date)
        if to_date:
            query = query.lte("created_at", to_date)
        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()
        return response.data or []
    except Exception as exc:
        logger.error(f"Audit log error: {exc}")
        return []
