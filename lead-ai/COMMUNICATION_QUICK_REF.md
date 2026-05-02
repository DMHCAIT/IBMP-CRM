# 📱 Quick Reference - Communication Features

## ⚡ 3-Minute Setup

```bash
# 1. Install
cd backend
pip install twilio sendgrid
python migrate_communication_history.py

# 2. Configure .env
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=app-password

# 3. Start servers
python main.py          # Terminal 1
cd ../frontend && npm start  # Terminal 2

# 4. Test in UI
# Go to Leads → Click WhatsApp/Phone/Email icons
```

## 🎯 What You Get

| Feature | Status | Access |
|---------|--------|--------|
| WhatsApp Chat | ✅ Ready | Click green WhatsApp icon |
| Voice Calls | ✅ Ready | Click blue Phone icon |
| Email | ✅ Ready | Click orange Email icon |
| Chat History | ✅ Auto-saved | Opens with each chat |
| Call Recording | ✅ Auto-recorded | Download after call |
| ML Training Data | ✅ Exportable | API endpoint available |

## 📝 Key Files

```
backend/
├── communication_integrations.py  # Main integration logic
├── main.py                        # API endpoints (modified)
├── migrate_communication_history.py # DB setup
├── .env.communications.example    # Config template
└── setup_communications.sh        # Auto-installer

frontend/src/
├── components/
│   ├── ChatInterface.js           # WhatsApp/Email chat UI
│   └── CallInterface.js           # Call UI with recording
└── pages/
    └── LeadsPage.js               # Modified with icons
```

## 🔧 Providers Supported

### WhatsApp
- **Twilio** (easiest, instant setup)
- **Meta WhatsApp Business Cloud API** (production)

### Email  
- **Gmail SMTP** (free, 500/day)
- **SendGrid** (100/day free, 40k/month paid)

### Calls
- **Twilio Voice** (auto-recording included)

## 💰 Free Tier Limits

- Twilio Trial: $15 credit
- WhatsApp Sandbox: Unlimited (testing)
- Gmail: 500 emails/day
- SendGrid: 100 emails/day
- Call Recording: Free (30-day storage)

## 📊 ML Training Access

```python
# Export all WhatsApp chats
GET /api/communications/training-data?type=whatsapp&limit=1000

# Response: CSV-ready data with:
# - lead_id, content, timestamp, metadata
```

## 🎨 UI Features

**ChatInterface:**
- Auto-refresh every 5 seconds
- Message status (sent/delivered/read)
- Typing indicators
- Full history
- Clean, WhatsApp-like design

**CallInterface:**
- Live call timer
- Recording indicator  
- Call status animations
- Download recording button
- Professional UI

## ⚠️ Important Notes

1. **WhatsApp Sandbox**: Users must opt-in first
   - Send: `join <keyword>` to +1 415 523 8886

2. **Gmail**: Use App Password, not regular password
   - Enable 2FA → Generate App Password

3. **Calls**: Buy Twilio number first ($1/month)
   - Required for outbound calls

4. **Webhooks**: Use ngrok for local testing
   - `ngrok http 8000` → Copy https URL

## 🔗 Quick Links

- Twilio Console: https://console.twilio.com/
- Gmail App Passwords: https://myaccount.google.com/apppasswords
- SendGrid: https://sendgrid.com/
- ngrok: https://ngrok.com/download

## 📞 Support Flow

1. Check logs: `backend/logs/`
2. Test API directly: Postman/curl
3. Verify .env values
4. Check Twilio console for errors
5. Review database: `communication_history` table

## ✅ Quick Test

```bash
# Test WhatsApp (replace with your number)
curl -X POST http://localhost:8000/api/communications/whatsapp/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "LEAD001",
    "to": "+1234567890",
    "message": "Test from CRM!",
    "sender": "Admin"
  }'
```

---

**That's it! Your CRM now has real communication capabilities! 🎉**

See `COMMUNICATION_SETUP_GUIDE.md` for detailed instructions.
