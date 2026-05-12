# 📱 Real Communication Integration Setup Guide

## Overview

Your CRM now has **real WhatsApp, Email, and Call integrations** with:
- ✅ WhatsApp chat interface with message history
- ✅ Email sending capabilities  
- ✅ Voice calls with automatic recording
- ✅ All conversations stored for ML training
- ✅ Real-time chat display in LeadsPage

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Required Packages

```bash
cd backend
pip install twilio sendgrid python-dotenv
```

### Step 2: Create Twilio Account (Free)

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for free trial ($15 credit)
3. Get your credentials from the console:
   - **Account SID**
   - **Auth Token**

### Step 3: Configure Environment Variables

Copy the example file and add your credentials:

```bash
cp .env.communications.example .env
```

Edit `.env` and add:

```env
# Twilio WhatsApp (Free Sandbox)
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Gmail SMTP for Email
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

### Step 4: Set Up Gmail App Password

1. Go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and your device
3. Copy the 16-character password
4. Use it as `SMTP_PASSWORD`

### Step 5: Add Database Migration

The communication history table will be created automatically when you run the backend.

```bash
cd backend
python main.py
```

### Step 6: Test in UI

1. Start frontend: `cd frontend && npm start`
2. Go to Leads page
3. Click WhatsApp/Phone/Email icons on any lead
4. Chat interface opens with full history!

---

## 📱 WhatsApp Integration Details

### Option 1: Twilio Sandbox (Development - FREE)

**Pros:**
- Instant setup, no approval needed
- Free for testing
- Works immediately

**Cons:**
- Users must "opt in" by sending a join message
- Shows "Twilio Sandbox" in messages
- Limited to 100 contacts

**Setup:**
1. In Twilio Console → Messaging → Try WhatsApp
2. Copy your sandbox number: `whatsapp:+14155238886`
3. To test: Send `join <your-sandbox-keyword>` to that number
4. Now you can send/receive messages!

**Code Example:**
```python
# Already implemented in communication_integrations.py
whatsapp.send_message(
    to_number="+1234567890",
    message="Hello from CRM!",
    lead_id="LEAD001",
    sender="John Counselor"
)
```

### Option 2: Meta WhatsApp Business Cloud API (Production)

**Pros:**
- Official Meta/Facebook integration
- Professional business profile
- No "sandbox" branding
- Free tier: 1,000 conversations/month
- Scalable

**Cons:**
- Requires business verification
- Takes 1-2 days for approval
- More complex setup

**Setup:**
1. Go to [Meta Developers](https://developers.facebook.com/)
2. Create Business App → Add WhatsApp Product
3. Add phone number (need to verify with SMS)
4. Get credentials:
   - Access Token
   - Phone Number ID
   - Business Account ID
5. Update `.env`:
   ```env
   WHATSAPP_PROVIDER=meta
   META_WHATSAPP_ACCESS_TOKEN=your_token
   META_WHATSAPP_PHONE_NUMBER_ID=your_id
   ```

---

## 📧 Email Integration Details

### Option 1: Gmail SMTP (Simple)

**Works for:**
- Personal accounts
- Small teams
- Testing

**Limits:**
- 500 emails/day for Gmail
- 2,000 emails/day for Google Workspace

**Setup:**
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Not your regular password!
```

**Getting App Password:**
1. Enable 2FA on your Google account
2. Visit: https://myaccount.google.com/apppasswords
3. Generate app password for "Mail"
4. Copy the 16-character code

### Option 2: SendGrid (Production)

**Pros:**
- 100 emails/day FREE
- Professional email delivery
- Email tracking and analytics
- Better deliverability

**Setup:**
1. Sign up at [SendGrid.com](https://sendgrid.com/)
2. Create API Key in Settings
3. Verify sender email
4. Update `.env`:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```

---

## ☎️ Call Integration with Recording

### Twilio Voice Calls

**Features:**
- Make calls directly from CRM
- Automatic call recording
- Call duration tracking
- Recordings stored for 30 days
- Download recordings for ML training

**Setup:**
1. Buy a phone number in Twilio ($1/month):
   - Console → Phone Numbers → Buy a number
2. Add to `.env`:
   ```env
   TWILIO_PHONE_NUMBER=+1234567890
   ```
3. Configure webhook for recordings:
   - Need public URL (use ngrok for local testing)

**Costs:**
- Phone number: $1/month
- Outbound calls: $0.013/min (US)
- Call recording: FREE
- Recording storage: FREE (30 days)

**Using ngrok for local testing:**
```bash
# Install ngrok
brew install ngrok

# Run ngrok
ngrok http 8000

# Copy the https URL (e.g., https://abc123.ngrok.io)
# Add to .env:
TWILIO_CALLBACK_URL=https://abc123.ngrok.io
```

---

## 💾 Data Storage for ML Training

All communications are automatically stored in `communication_history` table:

### Database Schema

```sql
CREATE TABLE communication_history (
    id SERIAL PRIMARY KEY,
    lead_id VARCHAR,
    communication_type VARCHAR,  -- 'whatsapp', 'email', 'call'
    direction VARCHAR,            -- 'inbound', 'outbound'
    content TEXT,                 -- Message or transcript
    timestamp TIMESTAMP,
    status VARCHAR,               -- 'sent', 'delivered', 'read', 'completed'
    metadata JSONB,               -- Recording URLs, durations, etc.
    sender VARCHAR,
    recipient VARCHAR,
    used_for_training BOOLEAN,    -- Flag for ML training
    sentiment_score FLOAT,        -- AI-analyzed sentiment
    ai_insights TEXT              -- AI-generated insights
);
```

### Accessing Training Data

**API Endpoint:**
```bash
GET /api/communications/training-data?type=whatsapp&limit=1000
```

**Response:**
```json
{
  "total_records": 1250,
  "data": [
    {
      "lead_id": "LEAD001",
      "type": "whatsapp",
      "content": "I'm interested in the MBBS program",
      "timestamp": "2025-12-26T10:30:00",
      "metadata": {
        "message_id": "wamid.xxx"
      }
    }
  ]
}
```

### Export for ML Training

```python
import pandas as pd
import requests

# Get all WhatsApp conversations
response = requests.get(
    'http://localhost:8000/api/communications/training-data?type=whatsapp',
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)

data = response.json()['data']
df = pd.DataFrame(data)

# Save for training
df.to_csv('whatsapp_training_data.csv', index=False)
```

---

## 🎯 Usage in LeadsPage

### WhatsApp Chat
1. Click **WhatsApp icon** (green)
2. Chat interface opens
3. Type message → Send
4. See full conversation history
5. Auto-refreshes every 5 seconds

### Email
1. Click **Email icon** (orange)
2. Same chat interface
3. Messages sent via email
4. Subject auto-generated or custom

### Voice Call
1. Click **Phone icon** (blue)
2. Call initiates immediately
3. Shows live timer
4. Recording starts automatically
5. After call: Download recording

---

## 📊 Features Implemented

### Frontend Components

**ChatInterface.js:**
- Real-time message display
- Send/receive messages
- Auto-scroll to latest
- Status indicators (sent, delivered, read)
- Typing indicators
- File attachments (ready for future)

**CallInterface.js:**
- Click-to-call functionality
- Live call timer
- Recording indicator
- Call status (calling, connected, ended)
- Download recordings
- Call duration display

### Backend APIs

**Communication Endpoints:**
```
POST   /api/communications/whatsapp/send
POST   /api/communications/whatsapp/webhook
POST   /api/communications/email/send
POST   /api/communications/call/initiate
POST   /api/communications/call/recording-complete
GET    /api/communications/{lead_id}/history
GET    /api/communications/training-data
POST   /api/communications/mark-training
```

### Integration Features

✅ **WhatsApp:**
- Two-way messaging
- Message status tracking
- Conversation threading
- Webhook for incoming messages

✅ **Email:**
- HTML email support
- SMTP and SendGrid
- Template support ready
- Delivery tracking

✅ **Calls:**
- Outbound calling
- Automatic recording
- Call duration tracking
- Recording storage
- Download functionality

✅ **ML Training:**
- All conversations stored
- Easy export for training
- Sentiment analysis ready
- Metadata preservation

---

## 🔐 Webhook Security

### Protecting Webhook Endpoints

Add authentication to webhooks:

```python
# In main.py
from fastapi import Header

@app.post("/api/communications/whatsapp/webhook")
async def whatsapp_webhook(
    data: Dict[str, Any],
    x_twilio_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    # Verify Twilio signature
    from twilio.request_validator import RequestValidator
    
    validator = RequestValidator(os.getenv('TWILIO_AUTH_TOKEN'))
    if not validator.validate(request_url, data, x_twilio_signature):
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Process webhook...
```

---

## 📈 Monitoring & Analytics

### Track Communication Metrics

```sql
-- Most active leads
SELECT lead_id, COUNT(*) as message_count
FROM communication_history
WHERE communication_type = 'whatsapp'
GROUP BY lead_id
ORDER BY message_count DESC
LIMIT 10;

-- Response time analysis
SELECT 
    lead_id,
    AVG(EXTRACT(EPOCH FROM (
        next_timestamp - timestamp
    ))) as avg_response_time_seconds
FROM (
    SELECT 
        lead_id,
        timestamp,
        LEAD(timestamp) OVER (PARTITION BY lead_id ORDER BY timestamp) as next_timestamp,
        direction
    FROM communication_history
    WHERE communication_type = 'whatsapp'
) t
WHERE direction = 'inbound'
GROUP BY lead_id;

-- Call performance
SELECT 
    DATE(timestamp) as call_date,
    COUNT(*) as total_calls,
    SUM((metadata->>'duration_seconds')::int) as total_duration_seconds,
    AVG((metadata->>'duration_seconds')::int) as avg_call_duration
FROM communication_history
WHERE communication_type = 'call'
GROUP BY DATE(timestamp)
ORDER BY call_date DESC;
```

---

## 🚨 Troubleshooting

### WhatsApp Not Sending

**Error: "Invalid phone number"**
- Ensure number includes country code: `+1234567890`
- For Twilio sandbox: Number must be opted in first

**Error: "Authentication failed"**
- Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
- Verify credentials in Twilio console

### Email Not Sending

**Error: "Authentication failed"**
- Gmail: Use App Password, not regular password
- Enable 2FA first, then generate app password

**Error: "Connection timeout"**
- Check firewall settings
- Verify SMTP port (587 for TLS, 465 for SSL)

### Calls Not Working

**Error: "Invalid phone number"**
- Buy a Twilio phone number first ($1/month)
- Add to TWILIO_PHONE_NUMBER in .env

**Webhook not receiving updates:**
- Use ngrok for local testing
- Update TWILIO_CALLBACK_URL with public URL
- Configure webhook in Twilio console

---

## 💡 Next Steps

### Enhance ML Training

1. **Sentiment Analysis:**
```python
from transformers import pipeline

sentiment_analyzer = pipeline("sentiment-analysis")

# Analyze messages
for msg in messages:
    result = sentiment_analyzer(msg.content)[0]
    msg.sentiment_score = result['score']
```

2. **Chatbot Training:**
```python
from transformers import GPT2LMHeadModel

# Train on conversation history
training_texts = [msg.content for msg in whatsapp_messages]
# Fine-tune model...
```

3. **Call Transcription:**
```python
import speech_recognition as sr

# Transcribe recordings
r = sr.Recognizer()
with sr.AudioFile(recording_path) as source:
    audio = r.record(source)
    transcript = r.recognize_google(audio)
```

---

## 📞 Support

For issues or questions:
1. Check Twilio logs: https://console.twilio.com/monitor/logs
2. Review backend logs: `backend/logs/`
3. Test webhook with Postman
4. Check database records in `communication_history`

---

## ✅ Checklist

- [ ] Installed dependencies (`pip install twilio sendgrid`)
- [ ] Created Twilio account
- [ ] Configured `.env` with credentials
- [ ] Set up Gmail app password
- [ ] Tested WhatsApp sandbox
- [ ] Made test call
- [ ] Sent test email
- [ ] Verified database storage
- [ ] Tested in LeadsPage UI

**Your CRM now has real communication capabilities! 🎉**
