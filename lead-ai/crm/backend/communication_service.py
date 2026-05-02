"""
Communication Automation Service
Handles WhatsApp, Email, and SMS automation with real API integrations
"""

import os
from typing import Dict, List, Optional
from datetime import datetime
import httpx
from jinja2 import Template
import json
import base64

# ============================================================================
# EMAIL SERVICE (Resend API)
# ============================================================================

class EmailService:
    """Email automation using Resend API"""
    
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "")
        if not self.api_key:
            import logging
            logging.getLogger(__name__).warning(
                "⚠️ RESEND_API_KEY is not set — email sending will be disabled. "
                "Set RESEND_API_KEY in your .env file."
            )
        self.from_email = os.getenv("FROM_EMAIL", "crm@yourdomain.com")
        self.base_url = "https://api.resend.com"
        
    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict:
        """Send email via Resend API"""

        if not self.api_key:
            return {
                "success": False,
                "error": "RESEND_API_KEY is not configured. Email sending is disabled.",
                "provider": "resend"
            }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/emails",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": self.from_email,
                        "to": [to],
                        "subject": subject,
                        "html": html_content,
                        "text": text_content or "",
                        "reply_to": reply_to or self.from_email
                    }
                )
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "message_id": response.json().get("id"),
                        "provider": "resend"
                    }
                else:
                    return {
                        "success": False,
                        "error": response.text,
                        "status_code": response.status_code
                    }
                    
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }
    
    async def send_template_email(
        self,
        to: str,
        template_name: str,
        variables: Dict,
        subject: str
    ) -> Dict:
        """Send templated email"""
        
        # Load template
        template_html = EMAIL_TEMPLATES.get(template_name, EMAIL_TEMPLATES["default"])
        template = Template(template_html)
        
        # Render template
        html_content = template.render(**variables)
        
        # Send email
        return await self.send_email(to, subject, html_content)


# ============================================================================
# WHATSAPP SERVICE (Twilio WhatsApp API)
# ============================================================================

class WhatsAppService:
    """WhatsApp automation using Twilio API"""
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "demo_sid")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "demo_token")
        self.from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        self.base_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}"
        
    async def send_message(
        self,
        to: str,
        message: str,
        media_url: Optional[str] = None
    ) -> Dict:
        """Send WhatsApp message via Twilio"""
        
        # Format number for WhatsApp
        if not to.startswith("whatsapp:"):
            to = f"whatsapp:{to}"
        
        payload = {
            "From": self.from_number,
            "To": to,
            "Body": message
        }
        
        if media_url:
            payload["MediaUrl"] = media_url
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/Messages.json",
                    auth=(self.account_sid, self.auth_token),
                    data=payload
                )
                
                if response.status_code == 201:
                    data = response.json()
                    return {
                        "success": True,
                        "message_id": data.get("sid"),
                        "status": data.get("status"),
                        "provider": "twilio"
                    }
                else:
                    return {
                        "success": False,
                        "error": response.text,
                        "status_code": response.status_code
                    }
                    
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }
    
    async def send_template_message(
        self,
        to: str,
        template_name: str,
        variables: Dict
    ) -> Dict:
        """Send templated WhatsApp message"""
        
        # Load template
        template_text = WHATSAPP_TEMPLATES.get(template_name, WHATSAPP_TEMPLATES["default"])
        template = Template(template_text)
        
        # Render template
        message = template.render(**variables)
        
        # Send message
        return await self.send_message(to, message)


# ============================================================================
# MESSAGE TEMPLATES
# ============================================================================

EMAIL_TEMPLATES = {
    "welcome": """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to Medical Education CRM!</h1>
            </div>
            <div class="content">
                <h2>Hi {{ name }},</h2>
                <p>Thank you for your interest in <strong>{{ course }}</strong>!</p>
                <p>We're excited to help you achieve your medical education goals.</p>
                <p>Your dedicated counselor <strong>{{ counselor }}</strong> will reach out to you within 24 hours.</p>
                <a href="{{ dashboard_link }}" class="button">View Your Dashboard</a>
                <p>If you have any questions, feel free to reply to this email.</p>
            </div>
            <div class="footer">
                <p>&copy; 2025 Medical Education CRM. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """,
    
    "follow_up": """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .content { padding: 20px; background: #f9f9f9; }
            .highlight { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="content">
                <h2>Hi {{ name }},</h2>
                <p>{{ message }}</p>
                <div class="highlight">
                    <strong>Course:</strong> {{ course }}<br>
                    <strong>Next Steps:</strong> {{ next_steps }}
                </div>
                <p>Looking forward to hearing from you!</p>
                <p>Best regards,<br>{{ counselor }}</p>
            </div>
        </div>
    </body>
    </html>
    """,
    
    "default": """
    <html>
    <body>
        <h2>{{ subject }}</h2>
        <p>{{ body }}</p>
    </body>
    </html>
    """
}

WHATSAPP_TEMPLATES = {
    "welcome": """
🎓 *Welcome to Medical Education CRM!*

Hi {{ name }},

Thank you for your interest in *{{ course }}*!

Your counselor *{{ counselor }}* will contact you soon to discuss:
✅ Course details
✅ Admission requirements  
✅ Fee structure
✅ Scholarship options

Have questions? Just reply to this message!
    """,
    
    "follow_up": """
Hi {{ name }},

{{ message }}

*Course:* {{ course }}
*Next Steps:* {{ next_steps }}

Reply here if you have any questions!

- {{ counselor }}
    """,
    
    "high_priority": """
🔥 *URGENT: Special Opportunity!*

Hi {{ name }},

{{ message }}

This is time-sensitive. Please reply ASAP!

- {{ counselor }}
    """,
    
    "default": """
Hi {{ name }},

{{ message }}

- {{ counselor }}
    """
}


# ============================================================================
# WHATSAPP SERVICE (Interakt API)
# ============================================================================

class InteraktWhatsAppService:
    """WhatsApp automation using Interakt API"""

    def __init__(self):
        self.api_key = os.getenv("INTERAKT_API_KEY", "")
        self.base_url = "https://api.interakt.ai/v1/public/message/"
        # Interakt uses Basic auth: base64(api_key + ":")
        token = base64.b64encode(f"{self.api_key}:".encode()).decode()
        self.auth_header = f"Basic {token}"

    async def send_message(
        self,
        to: str,
        message: str,
        country_code: str = "+91"
    ) -> Dict:
        """Send a free-form WhatsApp message via Interakt (only within 24h session window)"""
        # Strip country code from phone if present
        phone = to.replace(country_code, "").replace("+", "").strip()

        payload = {
            "countryCode": country_code,
            "phoneNumber": phone,
            "callbackData": "crm_message",
            "type": "Text",
            "data": {
                "message": message
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": self.auth_header,
                        "Content-Type": "application/json"
                    },
                    json=payload
                )

                data = response.json()
                if response.status_code == 200 and data.get("result"):
                    return {
                        "success": True,
                        "message_id": data.get("id", ""),
                        "provider": "interakt"
                    }
                else:
                    return {
                        "success": False,
                        "error": data.get("message", response.text),
                        "status_code": response.status_code
                    }

            except Exception as e:
                return {"success": False, "error": str(e)}

    async def send_media(
        self,
        to: str,
        media_type: str,        # image | document | video | audio
        url: str,
        filename: Optional[str] = None,
        caption: Optional[str] = None,
        country_code: str = "+91"
    ) -> Dict:
        """Send an image, document, video, or audio file via Interakt"""
        phone = to.replace(country_code, "").replace("+", "").strip()
        type_map = {
            "image": "Image",
            "document": "Document",
            "video": "Video",
            "audio": "Audio",
        }
        interakt_type = type_map.get(media_type.lower(), "Document")

        data: Dict = {"url": url}
        if caption:
            data["caption"] = caption
        if filename and media_type.lower() == "document":
            data["filename"] = filename

        payload = {
            "countryCode": country_code,
            "phoneNumber": phone,
            "callbackData": "crm_media",
            "type": interakt_type,
            "data": data,
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": self.auth_header,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp_data = response.json()
                if response.status_code == 200 and resp_data.get("result"):
                    return {"success": True, "message_id": resp_data.get("id", ""), "provider": "interakt"}
                else:
                    return {"success": False, "error": resp_data.get("message", response.text)}
            except Exception as e:
                return {"success": False, "error": str(e)}

    async def send_template_message(
        self,
        to: str,
        template_name: str,
        body_values: List[str],
        country_code: str = "+91",
        language_code: str = "en",
        header_values: Optional[List[str]] = None,
        button_values: Optional[List[str]] = None
    ) -> Dict:
        """Send a WhatsApp approved template message via Interakt"""
        phone = to.replace(country_code, "").replace("+", "").strip()

        template_payload: Dict = {
            "name": template_name,
            "languageCode": language_code,
            "bodyValues": body_values
        }
        if header_values:
            template_payload["headerValues"] = header_values
        if button_values:
            template_payload["buttonValues"] = button_values

        payload = {
            "countryCode": country_code,
            "phoneNumber": phone,
            "callbackData": "crm_template",
            "type": "Template",
            "template": template_payload
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": self.auth_header,
                        "Content-Type": "application/json"
                    },
                    json=payload
                )

                data = response.json()
                if response.status_code == 200 and data.get("result"):
                    return {
                        "success": True,
                        "message_id": data.get("id", ""),
                        "provider": "interakt"
                    }
                else:
                    return {
                        "success": False,
                        "error": data.get("message", response.text),
                        "status_code": response.status_code
                    }

            except Exception as e:
                return {"success": False, "error": str(e)}


# ============================================================================
# CAMPAIGN AUTOMATION
# ============================================================================

class CampaignAutomation:
    """Automated drip campaigns and sequences"""
    
    def __init__(self, email_service: EmailService, whatsapp_service: WhatsAppService):
        self.email_service = email_service
        self.whatsapp_service = whatsapp_service
        
    async def trigger_welcome_sequence(self, lead: Dict) -> List[Dict]:
        """Trigger welcome email + WhatsApp sequence"""
        
        results = []
        
        # Send welcome email
        email_result = await self.email_service.send_template_email(
            to=lead["email"],
            template_name="welcome",
            subject=f"Welcome {lead['name']}! Your Medical Education Journey Starts Here",
            variables={
                "name": lead["name"],
                "course": lead["course"],
                "counselor": lead["counselor"],
                "dashboard_link": f"https://crm.yourdomain.com/leads/{lead['id']}"
            }
        )
        results.append({"channel": "email", **email_result})
        
        # Send welcome WhatsApp (if number provided)
        if lead.get("whatsapp"):
            wa_result = await self.whatsapp_service.send_template_message(
                to=lead["whatsapp"],
                template_name="welcome",
                variables={
                    "name": lead["name"],
                    "course": lead["course"],
                    "counselor": lead["counselor"]
                }
            )
            results.append({"channel": "whatsapp", **wa_result})
        
        return results
    
    async def trigger_follow_up(self, lead: Dict, message: str, priority: str = "normal") -> List[Dict]:
        """Trigger follow-up communication"""
        
        results = []
        
        template = "high_priority" if priority == "urgent" else "follow_up"
        
        # Email
        if lead.get("email"):
            email_result = await self.email_service.send_template_email(
                to=lead["email"],
                template_name="follow_up",
                subject=f"Follow-up: {lead['course']}",
                variables={
                    "name": lead["name"],
                    "message": message,
                    "course": lead["course"],
                    "next_steps": "Schedule a call to discuss details",
                    "counselor": lead["counselor"]
                }
            )
            results.append({"channel": "email", **email_result})
        
        # WhatsApp
        if lead.get("whatsapp"):
            wa_result = await self.whatsapp_service.send_template_message(
                to=lead["whatsapp"],
                template_name=template,
                variables={
                    "name": lead["name"],
                    "message": message,
                    "course": lead["course"],
                    "next_steps": "Reply with your availability",
                    "counselor": lead["counselor"]
                }
            )
            results.append({"channel": "whatsapp", **wa_result})
        
        return results


# ============================================================================
# UNIFIED COMMUNICATION SERVICE
# ============================================================================

class CommunicationService:
    """Unified communication service - supports Twilio, Meta, and Interakt WhatsApp"""

    def __init__(self):
        self.email = EmailService()
        # Select WhatsApp provider based on env var
        provider = os.getenv("WHATSAPP_PROVIDER", "twilio").lower()
        if provider == "interakt":
            self.whatsapp = InteraktWhatsAppService()
        else:
            self.whatsapp = WhatsAppService()  # Twilio default
        self.campaign = CampaignAutomation(self.email, self.whatsapp)
    
    async def send(
        self,
        channel: str,
        to: str,
        message: str,
        template: Optional[str] = None,
        variables: Optional[Dict] = None
    ) -> Dict:
        """Send message via specified channel"""
        
        if channel == "email":
            if template and variables:
                return await self.email.send_template_email(
                    to=to,
                    template_name=template,
                    subject=variables.get("subject", "Message from CRM"),
                    variables=variables
                )
            else:
                return await self.email.send_email(
                    to=to,
                    subject="Message from CRM",
                    html_content=f"<p>{message}</p>"
                )
                
        elif channel == "whatsapp":
            if template and variables:
                return await self.whatsapp.send_template_message(
                    to=to,
                    template_name=template,
                    variables=variables
                )
            else:
                return await self.whatsapp.send_message(to, message)
        
        else:
            return {"success": False, "error": f"Unknown channel: {channel}"}


# Initialize global instance
comm_service = CommunicationService()
