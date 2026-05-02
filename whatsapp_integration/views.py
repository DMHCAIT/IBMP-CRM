import json
import logging
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from supabase import create_client
from .services import WhatsAppService
import datetime

logger = logging.getLogger(__name__)

# Supabase client
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

whatsapp = WhatsAppService()


# ═══════════════════════════════════════════════════════════
# WEBHOOK — Meta calls this when a lead sends a message
# This is the core of receive + popup system
# ═══════════════════════════════════════════════════════════

@csrf_exempt
def webhook(request):
    # ── Step 1: Meta verification (one-time setup) ──────────
    if request.method == "GET":
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")

        if mode == "subscribe" and token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
            logger.info("Webhook verified successfully")
            return HttpResponse(challenge, status=200)
        return HttpResponse("Forbidden", status=403)

    # ── Step 2: Incoming messages from leads ─────────────────
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            logger.info(f"Webhook received: {json.dumps(body, indent=2)}")

            entry = body.get("entry", [])
            if not entry:
                return HttpResponse("OK", status=200)

            for item in entry:
                changes = item.get("changes", [])
                for change in changes:
                    value = change.get("value", {})

                    # ── Incoming message from lead ──────────
                    messages = value.get("messages", [])
                    for msg in messages:
                        _process_incoming_message(msg, value)

                    # ── Delivery/read status updates ────────
                    statuses = value.get("statuses", [])
                    for status in statuses:
                        _process_status_update(status)

        except Exception as e:
            logger.error(f"Webhook processing error: {str(e)}")

        return HttpResponse("OK", status=200)


def _process_incoming_message(msg: dict, value: dict):
    """
    Process incoming message from a lead and save to Supabase.
    Supabase Realtime will then push it to the agent's browser → popup appears.
    """
    try:
        from_number = msg.get("from")       # Lead's phone number
        message_id = msg.get("id")
        timestamp = msg.get("timestamp")
        msg_type = msg.get("type", "text")

        # Extract message content based on type
        content = ""
        media_url = ""

        if msg_type == "text":
            content = msg.get("text", {}).get("body", "")

        elif msg_type == "image":
            media_id = msg.get("image", {}).get("id")
            media_url = whatsapp.get_media_url(media_id) if media_id else ""
            content = msg.get("image", {}).get("caption", "📷 Image")

        elif msg_type == "document":
            media_id = msg.get("document", {}).get("id")
            media_url = whatsapp.get_media_url(media_id) if media_id else ""
            content = msg.get("document", {}).get("filename", "📄 Document")

        elif msg_type == "audio":
            content = "🎵 Voice message"

        elif msg_type == "video":
            content = "🎥 Video"

        elif msg_type == "location":
            lat = msg.get("location", {}).get("latitude")
            lng = msg.get("location", {}).get("longitude")
            content = f"📍 Location: {lat}, {lng}"

        # Get contact name
        contacts = value.get("contacts", [])
        contact_name = contacts[0].get("profile", {}).get("name", "") if contacts else ""

        # Find which agent this lead is assigned to in your CRM
        assigned_agent_id = _get_assigned_agent(from_number)

        # Save to Supabase — Realtime will auto-push to frontend
        supabase.table("whatsapp_messages").insert({
            "message_id": message_id,
            "from_number": from_number,
            "contact_name": contact_name,
            "content": content,
            "media_url": media_url,
            "message_type": msg_type,
            "direction": "inbound",        # Lead → CRM
            "status": "received",
            "assigned_agent_id": assigned_agent_id,
            "timestamp": datetime.datetime.fromtimestamp(int(timestamp)).isoformat(),
            "is_read": False               # Triggers popup on frontend
        }).execute()

        # Auto mark as read in WhatsApp
        whatsapp.mark_as_read(message_id)

        logger.info(f"Saved incoming message from {from_number}: {content}")

    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")


def _process_status_update(status: dict):
    """Update message delivery status in Supabase"""
    try:
        message_id = status.get("id")
        new_status = status.get("status")  # sent / delivered / read / failed

        supabase.table("whatsapp_messages").update({
            "status": new_status
        }).eq("message_id", message_id).execute()

    except Exception as e:
        logger.error(f"Status update error: {str(e)}")


def _get_assigned_agent(phone_number: str) -> str:
    """
    Look up which agent is assigned to this lead in your CRM.
    Returns agent_id or None if not found.
    """
    try:
        result = supabase.table("leads").select("assigned_agent_id").eq(
            "whatsapp_number", phone_number
        ).single().execute()
        return result.data.get("assigned_agent_id") if result.data else None
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════
# SEND MESSAGE — Your CRM calls this to message a lead
# ═══════════════════════════════════════════════════════════

@csrf_exempt
@require_http_methods(["POST"])
def send_message(request):
    """
    API endpoint your CRM frontend calls when agent types and sends a message.
    POST /api/whatsapp/send/
    Body: { "to": "919876543210", "message": "Hello!", "agent_id": "agent_123" }
    """
    try:
        body = json.loads(request.body)
        to_number = body.get("to")
        message = body.get("message")
        agent_id = body.get("agent_id")
        msg_type = body.get("type", "text")  # text / template / image / document

        if not to_number or not message:
            return JsonResponse({"error": "to and message are required"}, status=400)

        # Send via Meta Cloud API
        if msg_type == "template":
            result = whatsapp.send_template_message(
                to_number=to_number,
                template_name=body.get("template_name"),
                language_code=body.get("language", "en"),
                components=body.get("components", [])
            )
        elif msg_type == "image":
            result = whatsapp.send_image(to_number, body.get("image_url"), message)
        elif msg_type == "document":
            result = whatsapp.send_document(to_number, body.get("document_url"),
                                             body.get("filename", "document.pdf"), message)
        else:
            result = whatsapp.send_text_message(to_number, message)

        if result["success"]:
            # Save outbound message to Supabase
            wam_id = result["data"].get("messages", [{}])[0].get("id", "")
            supabase.table("whatsapp_messages").insert({
                "message_id": wam_id,
                "from_number": settings.WHATSAPP_BUSINESS_NUMBER,
                "to_number": to_number,
                "content": message,
                "message_type": msg_type,
                "direction": "outbound",   # CRM → Lead
                "status": "sent",
                "assigned_agent_id": agent_id,
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "is_read": True
            }).execute()

            return JsonResponse({"success": True, "message_id": wam_id})
        else:
            return JsonResponse({"success": False, "error": result["error"]}, status=500)

    except Exception as e:
        logger.error(f"Send message error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


# ═══════════════════════════════════════════════════════════
# GET CHAT HISTORY — Load conversation with a lead
# ═══════════════════════════════════════════════════════════

@require_http_methods(["GET"])
def get_chat_history(request, phone_number):
    """
    GET /api/whatsapp/history/<phone_number>/
    Returns all messages with a specific lead, sorted by time.
    """
    try:
        result = supabase.table("whatsapp_messages").select("*").or_(
            f"from_number.eq.{phone_number},to_number.eq.{phone_number}"
        ).order("timestamp", desc=False).execute()

        return JsonResponse({"success": True, "messages": result.data})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ═══════════════════════════════════════════════════════════
# MARK MESSAGES AS READ — Called when agent opens chat
# ═══════════════════════════════════════════════════════════

@csrf_exempt
@require_http_methods(["POST"])
def mark_messages_read(request):
    """
    POST /api/whatsapp/mark-read/
    Body: { "phone_number": "919876543210" }
    """
    try:
        body = json.loads(request.body)
        phone_number = body.get("phone_number")

        supabase.table("whatsapp_messages").update({
            "is_read": True
        }).eq("from_number", phone_number).eq("is_read", False).execute()

        return JsonResponse({"success": True})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
