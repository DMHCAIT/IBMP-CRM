# 🚀 Quick Start - Google Sheets Sync

## ⚡ 5-Minute Setup

### Step 1: Get Google Cloud Credentials (2 minutes)

1. Go to: https://console.cloud.google.com/
2. Create a new project: "CRM Google Sheets Sync"
3. Enable Google Sheets API
4. Create Service Account: `crm-sheets-sync`
5. Create Key (JSON format)
6. Download as `google-credentials.json`

### Step 2: Share Your Google Sheet (1 minute)

1. Open the downloaded `google-credentials.json`
2. Copy the `client_email` value (looks like: `xxx@xxx.iam.gserviceaccount.com`)
3. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU/edit
4. Click "Share" → Paste the service account email
5. Set permission to "Editor"
6. Uncheck "Notify people"
7. Click "Share"

### Step 3: Install Credentials (30 seconds)

```bash
# Move the downloaded file to backend folder
mv ~/Downloads/google-credentials.json "/Users/guneswaribokam/Downloads/IBMP CRM NEW/lead-ai/crm/backend/"
```

### Step 4: Restart Backend (30 seconds)

Kill the current backend (Ctrl+C in the terminal) and restart:

```bash
cd "/Users/guneswaribokam/Downloads/IBMP CRM NEW/lead-ai/crm/backend"
python main.py
```

Look for these messages:
```
✅ Google Sheets service initialized successfully
✅ Google Sheets sync scheduler started (every 5 minutes)
```

### Step 5: Test (1 minute)

```bash
# Test connection
curl -s http://localhost:8080/api/sync/google-sheets/test-connection | python3 -m json.tool

# Manual sync
curl -X POST http://localhost:8080/api/sync/google-sheets/sync-now | python3 -m json.tool
```

---

## 📡 Quick API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/google-sheets/status` | GET | Get sync status and stats |
| `/api/sync/google-sheets/test-connection` | GET | Test connection & preview |
| `/api/sync/google-sheets/trigger` | POST | Start background sync |
| `/api/sync/google-sheets/sync-now` | POST | Sync now (wait for result) |

---

## 🔄 How It Works

1. **Every 5 minutes**, the system checks your Google Sheet
2. **Finds unsynced leads** (where `Sync_Status` column is empty)
3. **Creates them in CRM** with all Meta campaign data
4. **Marks as "Synced"** in your Google Sheet
5. **Avoids duplicates** by checking email/phone

---

## 📊 What Gets Synced

✅ **Contact Info**: Name, Email, Phone, Country
✅ **Campaign Data**: Campaign name, Ad set, Ad name
✅ **Lead Source**: Platform (Facebook/Instagram)
✅ **Qualification**: Education level from form
✅ **Timestamps**: Lead creation date from Meta

---

## ⚙️ Configuration

Your Google Sheet:
- **ID**: `1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU`
- **Name**: `Sheet1` (change in .env if different)
- **Sync Interval**: Every 5 minutes

To change sync frequency, edit `main.py` line ~273:
```python
scheduler.add_job(..., minutes=5)  # Change 5 to desired minutes
```

---

## 🎯 Testing

Add a test lead to your Google Sheet:
1. Fill in: full_name, email, phone_number
2. Leave `Sync_Status` empty
3. Wait 5 minutes OR trigger manual sync
4. Check CRM leads page - new lead should appear
5. Check Google Sheet - `Sync_Status` should show "Synced"

---

## 🆘 Troubleshooting

**No leads syncing?**
- Check `Sync_Status` column - already synced?
- Verify required fields: full_name + (email OR phone)
- Check backend logs for errors

**Permission denied?**
- Service account needs "Editor" permission
- Re-share the sheet with correct email

**Connection fails?**
- Verify `google-credentials.json` is in backend folder
- Check service account email is correct
- Make sure Google Sheets API is enabled

---

## 📚 Full Documentation

See [GOOGLE_SHEETS_SYNC_GUIDE.md](./GOOGLE_SHEETS_SYNC_GUIDE.md) for complete setup instructions.

---

**Ready to sync!** 🎉
