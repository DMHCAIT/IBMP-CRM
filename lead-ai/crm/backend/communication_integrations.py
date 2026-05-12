"""
Communication Integrations for WhatsApp, Email, and Calls
Supports real-time messaging, email sending, and call recording for ML training
"""

import os
import json
from datetime import datetime
from typing import Optional, List, Dict
import requests
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, Float
from database import Base

# Database Models for Communication History
class CommunicationHistory(Base):
    __tablename__ = "communication_history"
    
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(String, index=True)
    communication_type = Column(String)  # whatsapp, email, call
    direction = Column(String)  # inbound, outbound
    content = Column(Text)  # Message content or call transcript
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String)  # sent, delivered, read, failed
    communication_metadata = Column(Text)  # JSON metadata (call duration, recording URL, etc.) - renamed from 'metadata'
    sender = Column(String)  # User/counselor who sent
    recipient = Column(String)  # Lead contact info
    
    # ML Training flags
    used_for_training = Column(Boolean, default=False)
    sentiment_score = Column(Float, nullable=True)
    ai_insights = Column(Text, nullable=True)


class WhatsAppIntegration:
    """
    WhatsApp Business API Integration
    Supports: Twilio WhatsApp API, WhatsApp Business Cloud API (Meta)
    """
    
    def __init__(self):
        # Option 1: Twilio WhatsApp
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_whatsapp_number = os.getenv('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886')
        
        # Option 2: Meta WhatsApp Business Cloud API
        self.meta_access_token = os.getenv('META_WHATSAPP_ACCESS_TOKEN')
        self.meta_phone_number_id = os.getenv('META_WHATSAPP_PHONE_NUMBER_ID')
        self.meta_business_account_id = os.getenv('META_WHATSAPP_BUSINESS_ACCOUNT_ID')
        
        self.provider = os.getenv('WHATSAPP_PROVIDER', 'twilio')  # 'twilio' or 'meta'
        
        if self.provider == 'twilio' and self.twilio_account_sid:
            self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
    
    def send_message(self, to_number: str, message: str, lead_id: str, sender: str, db: Session) -> Dict:
        """Send WhatsApp message"""
        try:
            if self.provider == 'twilio':
                return self._send_twilio_whatsapp(to_number, message, lead_id, sender, db)
            elif self.provider == 'meta':
                return self._send_meta_whatsapp(to_number, message, lead_id, sender, db)
            else:
                return {"success": False, "error": "No WhatsApp provider configured"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _send_twilio_whatsapp(self, to_number: str, message: str, lead_id: str, sender: str, db: Session) -> Dict:
        """Send via Twilio WhatsApp API"""
        if not to_number.startswith('whatsapp:'):
            to_number = f'whatsapp:{to_number}'
        
        try:
            message_obj = self.twilio_client.messages.create(
                body=message,
                from_=self.twilio_whatsapp_number,
                to=to_number
            )
            
            # Store in database
            comm_record = CommunicationHistory(
                lead_id=lead_id,
                communication_type='whatsapp',
                direction='outbound',
                content=message,
                status=message_obj.status,
                sender=sender,
                recipient=to_number,
                communication_metadata=json.dumps({
                    'message_sid': message_obj.sid,
                    'provider': 'twilio'
                })
            )
            db.add(comm_record)
            db.commit()
            
            return {
                "success": True,
                "message_id": message_obj.sid,
                "status": message_obj.status
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _send_meta_whatsapp(self, to_number: str, message: str, lead_id: str, sender: str, db: Session) -> Dict:
        """Send via Meta WhatsApp Business Cloud API"""
        url = f"https://graph.facebook.com/v18.0/{self.meta_phone_number_id}/messages"
        
        headers = {
            "Authorization": f"Bearer {self.meta_access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number.replace('+', '').replace('whatsapp:', ''),
            "type": "text",
            "text": {"body": message}
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            response_data = response.json()
            
            if response.status_code == 200:
                # Store in database
                comm_record = CommunicationHistory(
                    lead_id=lead_id,
                    communication_type='whatsapp',
                    direction='outbound',
                    content=message,
                    status='sent',
                    sender=sender,
                    recipient=to_number,
                    communication_metadata=json.dumps({
                        'message_id': response_data.get('messages', [{}])[0].get('id'),
                        'provider': 'meta'
                    })
                )
                db.add(comm_record)
                db.commit()
                
                return {
                    "success": True,
                    "message_id": response_data.get('messages', [{}])[0].get('id'),
                    "status": "sent"
                }
            else:
                return {"success": False, "error": response_data}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def receive_webhook(self, webhook_data: Dict, db: Session) -> Dict:
        """Handle incoming WhatsApp messages from webhook"""
        if self.provider == 'twilio':
            return self._process_twilio_webhook(webhook_data, db)
        elif self.provider == 'meta':
            return self._process_meta_webhook(webhook_data, db)
    
    def _process_twilio_webhook(self, data: Dict, db: Session) -> Dict:
        """Process Twilio WhatsApp webhook"""
        message_sid = data.get('MessageSid')
        from_number = data.get('From')
        body = data.get('Body')
        
        # Store incoming message
        comm_record = CommunicationHistory(
            lead_id=self._find_lead_by_phone(from_number, db),
            communication_type='whatsapp',
            direction='inbound',
            content=body,
            status='received',
            sender=from_number,
            recipient=self.twilio_whatsapp_number,
            communication_metadata=json.dumps({'message_sid': message_sid, 'provider': 'twilio'})
        )
        db.add(comm_record)
        db.commit()
        
        return {"success": True, "message_id": message_sid}
    
    def _process_meta_webhook(self, data: Dict, db: Session) -> Dict:
        """Process Meta WhatsApp webhook"""
        if data.get('object') == 'whatsapp_business_account':
            for entry in data.get('entry', []):
                for change in entry.get('changes', []):
                    value = change.get('value', {})
                    messages = value.get('messages', [])
                    
                    for message in messages:
                        message_id = message.get('id')
                        from_number = message.get('from')
                        text_body = message.get('text', {}).get('body', '')
                        
                        # Store incoming message
                        comm_record = CommunicationHistory(
                            lead_id=self._find_lead_by_phone(from_number, db),
                            communication_type='whatsapp',
                            direction='inbound',
                            content=text_body,
                            status='received',
                            sender=from_number,
                            recipient=self.meta_phone_number_id,
                            communication_metadata=json.dumps({'message_id': message_id, 'provider': 'meta'})
                        )
                        db.add(comm_record)
                        db.commit()
        
        return {"success": True}
    
    def _find_lead_by_phone(self, phone: str, db: Session) -> Optional[str]:
        """Find lead ID by phone number"""
        # Clean phone number
        phone_clean = phone.replace('whatsapp:', '').replace('+', '')
        
        # Query database for lead with matching phone or whatsapp
        from main import DBLead
        lead = db.query(DBLead).filter(
            (DBLead.phone.contains(phone_clean)) | 
            (DBLead.whatsapp.contains(phone_clean))
        ).first()
        
        return lead.lead_id if lead else None


class EmailIntegration:
    """
    Email Integration using SMTP or SendGrid
    """
    
    def __init__(self):
        self.provider = os.getenv('EMAIL_PROVIDER', 'smtp')  # 'smtp' or 'sendgrid'
        
        # SMTP Configuration
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_username = os.getenv('SMTP_USERNAME')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.smtp_from_email = os.getenv('SMTP_FROM_EMAIL')
        
        # SendGrid Configuration
        self.sendgrid_api_key = os.getenv('SENDGRID_API_KEY')
        self.sendgrid_from_email = os.getenv('SENDGRID_FROM_EMAIL')
    
    def send_email(self, to_email: str, subject: str, body: str, lead_id: str, sender: str, db: Session, html: bool = False) -> Dict:
        """Send email to lead"""
        try:
            if self.provider == 'smtp':
                return self._send_smtp_email(to_email, subject, body, lead_id, sender, db, html)
            elif self.provider == 'sendgrid':
                return self._send_sendgrid_email(to_email, subject, body, lead_id, sender, db, html)
            else:
                return {"success": False, "error": "No email provider configured"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _send_smtp_email(self, to_email: str, subject: str, body: str, lead_id: str, sender: str, db: Session, html: bool) -> Dict:
        """Send email via SMTP"""
        try:
            message = MIMEMultipart('alternative')
            message['From'] = self.smtp_from_email
            message['To'] = to_email
            message['Subject'] = subject
            
            if html:
                message.attach(MIMEText(body, 'html'))
            else:
                message.attach(MIMEText(body, 'plain'))
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(message)
            
            # Store in database
            comm_record = CommunicationHistory(
                lead_id=lead_id,
                communication_type='email',
                direction='outbound',
                content=f"Subject: {subject}\n\n{body}",
                status='sent',
                sender=sender,
                recipient=to_email,
                communication_metadata=json.dumps({'provider': 'smtp', 'subject': subject})
            )
            db.add(comm_record)
            db.commit()
            
            return {"success": True, "status": "sent"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _send_sendgrid_email(self, to_email: str, subject: str, body: str, lead_id: str, sender: str, db: Session, html: bool) -> Dict:
        """Send email via SendGrid"""
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            
            message = Mail(
                from_email=self.sendgrid_from_email,
                to_emails=to_email,
                subject=subject,
                html_content=body if html else f'<p>{body}</p>'
            )
            
            sg = SendGridAPIClient(self.sendgrid_api_key)
            response = sg.send(message)
            
            # Store in database
            comm_record = CommunicationHistory(
                lead_id=lead_id,
                communication_type='email',
                direction='outbound',
                content=f"Subject: {subject}\n\n{body}",
                status='sent',
                sender=sender,
                recipient=to_email,
                communication_metadata=json.dumps({
                    'provider': 'sendgrid',
                    'subject': subject,
                    'message_id': response.headers.get('X-Message-Id')
                })
            )
            db.add(comm_record)
            db.commit()
            
            return {"success": True, "status": "sent", "message_id": response.headers.get('X-Message-Id')}
        except Exception as e:
            return {"success": False, "error": str(e)}


class CallIntegration:
    """
    Call Integration using Twilio with Recording
    Supports voice calls with automatic recording for ML training
    """
    
    def __init__(self):
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        if self.twilio_account_sid:
            self.client = Client(self.twilio_account_sid, self.twilio_auth_token)
    
    def initiate_call(self, to_number: str, lead_id: str, counselor: str, db: Session, callback_url: str) -> Dict:
        """Initiate outbound call with recording"""
        try:
            call = self.client.calls.create(
                to=to_number,
                from_=self.twilio_phone_number,
                url=callback_url,  # TwiML instructions URL
                record=True,  # Enable call recording
                recording_status_callback=f"{callback_url}/recording-complete",
                recording_status_callback_method='POST'
            )
            
            # Store call record
            comm_record = CommunicationHistory(
                lead_id=lead_id,
                communication_type='call',
                direction='outbound',
                content='Call initiated',
                status='initiated',
                sender=counselor,
                recipient=to_number,
                communication_metadata=json.dumps({
                    'call_sid': call.sid,
                    'status': call.status
                })
            )
            db.add(comm_record)
            db.commit()
            
            return {
                "success": True,
                "call_sid": call.sid,
                "status": call.status
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_call_recording(self, call_sid: str) -> Optional[Dict]:
        """Get call recording URL and transcript"""
        try:
            recordings = self.client.recordings.list(call_sid=call_sid)
            
            if recordings:
                recording = recordings[0]
                return {
                    "recording_sid": recording.sid,
                    "recording_url": f"https://api.twilio.com{recording.uri.replace('.json', '.mp3')}",
                    "duration": recording.duration,
                    "date_created": recording.date_created
                }
            return None
        except Exception as e:
            print(f"Error fetching recording: {e}")
            return None
    
    def update_call_status(self, call_sid: str, status: str, duration: int, recording_url: str, db: Session):
        """Update call record with completion details"""
        comm_record = db.query(CommunicationHistory).filter(
            CommunicationHistory.communication_metadata.contains(call_sid)
        ).first()
        
        if comm_record:
            metadata = json.loads(comm_record.communication_metadata)
            metadata.update({
                'final_status': status,
                'duration_seconds': duration,
                'recording_url': recording_url
            })
            comm_record.communication_metadata = json.dumps(metadata)
            comm_record.status = 'completed' if status == 'completed' else 'failed'
            comm_record.content = f"Call duration: {duration}s"
            db.commit()


class CommunicationService:
    """
    Unified Communication Service
    Manages WhatsApp, Email, and Calls with ML training data collection
    """
    
    def __init__(self):
        self.whatsapp = WhatsAppIntegration()
        self.email = EmailIntegration()
        self.calls = CallIntegration()
    
    def get_conversation_history(self, lead_id: str, db: Session, communication_type: Optional[str] = None) -> List[Dict]:
        """Get all communication history for a lead"""
        query = db.query(CommunicationHistory).filter(CommunicationHistory.lead_id == lead_id)
        
        if communication_type:
            query = query.filter(CommunicationHistory.communication_type == communication_type)
        
        records = query.order_by(CommunicationHistory.timestamp.asc()).all()
        
        return [
            {
                "id": record.id,
                "type": record.communication_type,
                "direction": record.direction,
                "content": record.content,
                "timestamp": record.timestamp.isoformat(),
                "status": record.status,
                "sender": record.sender,
                "recipient": record.recipient,
                "metadata": json.loads(record.metadata) if record.metadata else {}
            }
            for record in records
        ]
    
    def get_training_data(self, db: Session, communication_type: Optional[str] = None, limit: int = 1000) -> List[Dict]:
        """Get communication data for ML training"""
        query = db.query(CommunicationHistory)
        
        if communication_type:
            query = query.filter(CommunicationHistory.communication_type == communication_type)
        
        # Get successful communications
        query = query.filter(CommunicationHistory.status.in_(['sent', 'delivered', 'read', 'completed']))
        
        records = query.limit(limit).all()
        
        return [
            {
                "lead_id": record.lead_id,
                "type": record.communication_type,
                "content": record.content,
                "timestamp": record.timestamp.isoformat(),
                "metadata": json.loads(record.metadata) if record.metadata else {},
                "used_for_training": record.used_for_training
            }
            for record in records
        ]
    
    def mark_as_training_data(self, communication_ids: List[int], db: Session):
        """Mark communications as used for training"""
        db.query(CommunicationHistory).filter(
            CommunicationHistory.id.in_(communication_ids)
        ).update({"used_for_training": True}, synchronize_session=False)
        db.commit()


# Singleton instance
communication_service = CommunicationService()
