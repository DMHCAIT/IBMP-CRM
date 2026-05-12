# ⚡ Google Sheets Setup - Step by Step

## 🎯 Your Google Sheet
**URL**: https://docs.google.com/spreadsheets/d/1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU/edit

**Tabs detected**: Pulmonology, Pediatrics, Obs & Gyne, Critical Care, Diabetology, Certification Aid, Emergency_Medicine, Orthopedic, Critical Care

---

## ⏱️ 5-Minute Setup Guide

### Step 1: Create Google Cloud Service Account (2 minutes)

1. **Open Google Cloud Console**:
   - Go to: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create New Project**:
   - Click project dropdown (top left)
   - Click "New Project"
   - Name: `CRM-Google-Sheets-Sync`
   - Click "Create"

3. **Enable Google Sheets API**:
   - Go to: https://console.cloud.google.com/apis/library
   - Search: "Google Sheets API"
   - Click on it → Click "Enable"

4. **Create Service Account**:
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Click "Create Service Account"
   - Name: `crm-sheets-sync`
   - Description: `Service account for CRM to sync Google Sheets`
   - Click "Create and Continue"
   - Skip role assignment (click "Continue")
   - Click "Done"

5. **Create Key (JSON)**:
   - Find your service account in the list
   - Click the three dots (⋮) on the right
   - Select "Manage keys"
   - Click "Add Key" → "Create new key"
   - Choose format: **JSON**
   - Click "Create"
   - **File will download automatically** → Save it!

---

### Step 2: Share Your Google Sheet (1 minute)

1. **Open the downloaded JSON file** (google-credentials-xxxxx.json)

2. **Copy the service account email**:
   - Look for `"client_email"` line
   - Copy the email (looks like: `crm-sheets-sync@xxx.iam.gserviceaccount.com`)

3. **Share your Google Sheet**:
   - Open: https://docs.google.com/spreadsheets/d/1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU/edit
   - Click **"Share"** button (top right)
   - Paste the service account email
   - Set permission to **"Editor"** (important!)
   - **Uncheck** "Notify people" (it's a robot, not a person)
   - Click **"Share"**

---

### Step 3: Install Credentials File (30 seconds)

**Option A - Terminal:**
```bash
# Rename and move the downloaded file
mv ~/Downloads/google-credentials-*.json "/Users/guneswaribokam/Downloads/IBMP CRM NEW/lead-ai/crm/backend/google-credentials.json"
```

**Option B - Finder:**
1. Locate the downloaded `google-credentials-xxxxx.json` in Downloads
2. Rename it to: `google-credentials.json` (remove the suffix)
3. Move it to: `/Users/guneswaribokam/Downloads/IBMP CRM NEW/lead-ai/crm/backend/`

---

### Step 4: Restart Backend (30 seconds)

Open terminal and run:

```bash
cd "/Users/guneswaribokam/Downloads/IBMP CRM NEW/lead-ai/crm/backend"

python main.py
```

**Look for these success messages**:
```
✅ Google Sheets service initialized successfully
📊 Found 10 sheets: Pulmonology, Pediatrics, ...
✅ Google Sheets sync scheduler started (every 5 minutes)
```

---

## 🧪 Testing (1 minute)

### Test 1: Check Connection
```bash
curl -s http://localhost:8080/api/sync/google-sheets/test-connection | python3 -m json.tool
```

**Expected Output**:
```json
{
  "status": "success",
  "message": "Connected to Google Sheet",
  "sheet_count": 10,
  "sheet_names": [
    "Pulmonology",
    "Pediatrics",
    "Obs & Gyne",
    "Critical Care",
    ...
  ]
}
```

### Test 2: Manual Sync
```bash
curl -X POST http://localhost:8080/api/sync/google-sheets/sync-now | python3 -m json.tool
```

**Expected Output**:
```json
{
  "status": "success",
  "message": "Synced 25 new leads",
  "synced": 25,
  "duplicates": 5,
  "skipped": 2,
  "failed": 0
}
```

---

## ✅ Verification Checklist

- [ ] Google Cloud project created
- [ ] Google Sheets API enabled
- [ ] Service account created
- [ ] JSON key downloaded
- [ ] Service account email copied
- [ ] Google Sheet shared with service account (Editor permission)
- [ ] Credentials file saved as `google-credentials.json` in backend folder
- [ ] Backend restarted successfully
- [ ] Connection test passed
- [ ] Manual sync test passed

---

## 🔄 What Happens Next

### Automatic Sync (Every 5 Minutes)
- System checks all tabs (Pulmonology, Pediatrics, etc.)
- Finds leads where `Sync_Status` is empty
- Creates them in CRM with course category = tab name
- Marks them as "Synced" in Google Sheet
- Avoids creating duplicates

### Lead Data Mapping
```
Tab Name → Course Category
Example:
- "Pulmonology" tab → Course: "Pulmonology"
- "Pediatrics" tab → Course: "Pediatrics"
- "Critical Care" tab → Course: "Critical Care"
```

### Each Lead Gets
- ✅ Contact info (name, email, phone)
- ✅ Course category (from tab name)
- ✅ Campaign details (ad name, campaign, platform)
- ✅ Meta lead ID preserved
- ✅ Qualification level
- ✅ Creation timestamp

---

## 🆘 Troubleshooting

### Error: "Permission denied"
**Solution**: Service account needs "Editor" permission, not "Viewer"
- Re-share the sheet
- Make sure permission is set to "Editor"

### Error: "Credentials not found"
**Solution**: File name must be exactly `google-credentials.json`
- Check spelling
- Make sure it's in `/Users/guneswaribokam/Downloads/IBMP CRM NEW/lead-ai/crm/backend/`

### Error: "Google Sheets API not enabled"
**Solution**: Enable the API
- Go to: https://console.cloud.google.com/apis/library
- Search: "Google Sheets API"
- Click "Enable"

### No leads syncing
**Solution**: Check `Sync_Status` column
- If already marked "Synced", they won't sync again
- Clear the column to re-sync
- Or add new test leads

### Backend won't start
**Solution**: Check for JSON syntax errors
- Open `google-credentials.json`
- Validate JSON format
- Make sure no extra commas or missing quotes

---

## 📞 Support

If you need help:
1. Check backend logs: `tail -f backend/logs/app_*.log`
2. Test connection endpoint
3. Verify Google Cloud setup
4. Check sheet permissions

---

**Ready to sync!** 🚀

Once you complete these steps, your CRM will automatically sync all Meta leads from all course category tabs every 5 minutes!
