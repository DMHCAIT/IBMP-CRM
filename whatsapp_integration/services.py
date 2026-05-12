import requests
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

WHATSAPP_API_URL = "https://graph.facebook.com/v18.0"


class WhatsAppService:
    """
    Meta WhatsApp Cloud API — Direct Integration
    Handles sending messages, templates, media to leads
    """

    def __init__(self):
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    # ─────────────────────────────────────────────
    # SEND TEXT MESSAGE (Normal chat message)
    # ─────────────────────────────────────────────
    def send_text_message(self, to_number: str, message: str) -> dict:
        """
        Send a plain text message to a lead.
        Works freely within 24hr window after lead replies.
        'to_number' format: country code + number, e.g. '919876543210'
        """
        url = f"{WHATSAPP_API_URL}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_number,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": message
            }
        }
        return self._make_request(url, payload)

    # ─────────────────────────────────────────────
    # SEND TEMPLATE MESSAGE (First contact / cold lead)
    # Required when YOU initiate the conversation
    # ─────────────────────────────────────────────
    def send_template_message(self, to_number: str, template_name: str,
                               language_code: str = "en", components: list = None) -> dict:
        """
        Send an approved Meta template message.
        Use this for first outreach to cold leads.
        """
        url = f"{WHATSAPP_API_URL}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or []
            }
        }
        return self._make_request(url, payload)

    # ─────────────────────────────────────────────
    # SEND IMAGE
    # ─────────────────────────────────────────────
    def send_image(self, to_number: str, image_url: str, caption: str = "") -> dict:
        url = f"{WHATSAPP_API_URL}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "image",
            "image": {
                "link": image_url,
                "caption": caption
            }
        }
        return self._make_request(url, payload)

    # ─────────────────────────────────────────────
    # SEND DOCUMENT / PDF
    # ─────────────────────────────────────────────
    def send_document(self, to_number: str, document_url: str,
                       filename: str = "document.pdf", caption: str = "") -> dict:
        url = f"{WHATSAPP_API_URL}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "document",
            "document": {
                "link": document_url,
                "filename": filename,
                "caption": caption
            }
        }
        return self._make_request(url, payload)

    # ─────────────────────────────────────────────
    # MARK MESSAGE AS READ
    # ─────────────────────────────────────────────
    def mark_as_read(self, message_id: str) -> dict:
        url = f"{WHATSAPP_API_URL}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }
        return self._make_request(url, payload)

    # ─────────────────────────────────────────────
    # DOWNLOAD MEDIA (when lead sends image/doc)
    # ─────────────────────────────────────────────
    def get_media_url(self, media_id: str) -> str:
        url = f"{WHATSAPP_API_URL}/{media_id}"
        response = requests.get(url, headers=self.headers)
        if response.status_code == 200:
            return response.json().get("url", "")
        return ""

    # ─────────────────────────────────────────────
    # INTERNAL REQUEST HANDLER
    # ─────────────────────────────────────────────
    def _make_request(self, url: str, payload: dict) -> dict:
        try:
            response = requests.post(url, headers=self.headers, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"WhatsApp API success: {response.json()}")
            return {"success": True, "data": response.json()}
        except requests.exceptions.HTTPError as e:
            logger.error(f"WhatsApp API HTTP error: {e.response.text}")
            return {"success": False, "error": e.response.text}
        except requests.exceptions.RequestException as e:
            logger.error(f"WhatsApp API request failed: {str(e)}")
            return {"success": False, "error": str(e)}
