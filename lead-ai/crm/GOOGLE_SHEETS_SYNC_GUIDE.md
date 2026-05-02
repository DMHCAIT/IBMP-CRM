# 📊 Google Sheets Integration - Setup Guide

## Overview
Automatically sync Meta (Facebook/Instagram) leads from Google Sheets to your CRM in real-time.

**Features:**
- ✅ Automatic sync every 5 minutes
- ✅ Manual sync on-demand via API
- ✅ Duplicate detection (by email/phone)
- ✅ Maps Meta lead fields to CRM fields
- ✅ Marks synced leads in Google Sheet
- ✅ Creates detailed notes with campaign data

---

## 📋 Prerequisites

Your Google Sheet ID: `1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU`

**Sheet Columns (as detected):**
- `id` - Meta lead ID
- `created_time` - Lead creation date
- `ad_id`, `ad_name` - Ad details
- `adset_id`, `adset_name` - Ad set details
- `campaign_id`, `campaign_name` - Campaign details
- `form_id`, `form_name` - Form details
- `platform` - Facebook/Instagram
- `is_organic` - Organic or paid
- `your_highest_qualification:` - Education level
- `full_name` - Contact name
- `phone_number` - Phone number
- `email` - Email address
- `country` - Country
- `lead_status` - Status from Meta
- `Sync_Status` - **IMPORTANT**: This column tracks sync status

---

## 🔧 Setup Steps

### Step 1: Install Required Packages

```bash
cd /Users/guneswaribokam/Downloads/IBMP\ CRM\ NEW/lead-ai/crm/backend

pip install google-auth google-auth-oauthlib google-api-python-client apscheduler
```

### Step 2: Create Google Cloud Service Account

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click the project dropdown at the top
   - Click "New Project" (or select existing)
   - Name it: "CRM Google Sheets Sync"
   - Click "Create"

3. **Enable Google Sheets API**
   - Go to: https://console.cloud.google.com/apis/library
   - Search for "Google Sheets API"
   - Click "Enable"

4. **Create Service Account**
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Click "Create Service Account"
   - Name: `crm-sheets-sync`
   - Description: "Service account for CRM to read Google Sheets"
   - Click "Create and Continue"
   - Skip "Grant this service account access to project" (optional)
   - Click "Done"

5. **Create Service Account Key**
   - Find your service account in the list
   - Click the three dots (⋮) → "Manage keys"
   - Click "Add Key" → "Create new key"
   - Choose "JSON" format
   - Click "Create"
   - **Save this file as `google-credentials.json`**

### Step 3: Share Google Sheet with Service Account

1. **Copy Service Account Email**
   - Open the downloaded `google-credentials.json`
   - Find the `client_email` field (looks like: `crm-sheets-sync@your-project.iam.gserviceaccount.com`)
   - Copy this email

2. **Share Your Google Sheet**
   - Open your Google Sheet: https://docs.google.com/spreadsheets/d/1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU/edit
   - Click "Share" button (top right)
   - Paste the service account email
   - Set permission to "Editor" (so it can mark rows as synced)
   - **Uncheck "Notify people"** (it's a service account)
   - Click "Share"

### Step 4: Configure Backend

1. **Move credentials file to backend folder:**
   ```bash
   mv ~/Downloads/google-credentials.json /Users/guneswaribokam/Downloads/IBMP\ CRM\ NEW/lead-ai/crm/backend/
   ```

2. **Update `.env` file** (optional - defaults are already set):
   ```bash
   # Google Sheets Configuration
   GOOGLE_SHEET_ID=1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU
   GOOGLE_SHEET_NAME=Sheet1  # Change if your tab has a different name
   GOOGLE_SHEETS_CREDENTIALS_PATH=google-credentials.json
   ```

### Step 5: Restart Backend Server

Kill the current backend process and restart:

```bash
cd /Users/guneswaribokam/Downloads/IBMP\ CRM\ NEW/lead-ai/crm/backend

python main.py
```

You should see:
```
✅ Google Sheets service initialized successfully
✅ Google Sheets sync scheduler started (every 5 minutes)
```

---

## 🧪 Testing the Integration

### Test 1: Check Connection

```bash
curl -s http://localhost:8080/api/sync/google-sheets/test-connection | python3 -m json.tool
```

**Expected output:**
```json
{
  "status": "success",
  "message": "Connected to Google Sheet",
  "sheet_id": "1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU",
  "columns": ["id", "created_time", "full_name", ...],
  "preview": {
    "total_leads": 100,
    "unsynced_leads": 25
  }
}
```

### Test 2: Check Sync Status

```bash
curl -s http://localhost:8080/api/sync/google-sheets/status | python3 -m json.tool
```

### Test 3: Manual Sync (Test Mode)

```bash
curl -X POST http://localhost:8080/api/sync/google-sheets/sync-now | python3 -m json.tool
```

**Expected output:**
```json
{
  "status": "success",
  "message": "Synced 5 new leads",
  "synced": 5,
  "duplicates": 2,
  "skipped": 1,
  "failed": 0
}
```

### Test 4: Verify in CRM

1. Open frontend: http://localhost:5172
2. Go to "Leads" page
3. Look for leads with source: "Meta - Facebook" or "Meta - Instagram"
4. Check that lead notes contain campaign information

### Test 5: Verify in Google Sheet

1. Open your Google Sheet
2. Check the `Sync_Status` column
3. Synced leads should show "Synced"

---

## 📡 API Endpoints

### 1. Get Sync Status
```bash
GET /api/sync/google-sheets/status
```

Returns:
- Google Sheets connection status
- Sync statistics (last sync, total synced, etc.)
- Configuration details

### 2. Test Connection
```bash
GET /api/sync/google-sheets/test-connection
```

Returns:
- Connection status
- Sheet preview (total leads, unsynced count, sample data)

### 3. Trigger Background Sync
```bash
POST /api/sync/google-sheets/trigger
```

Starts sync in background (non-blocking).

### 4. Sync Now (Synchronous)
```bash
POST /api/sync/google-sheets/sync-now
```

Runs sync immediately and waits for completion. Good for testing.

---

## 🔄 How It Works

### Automatic Sync (Every 5 Minutes)

1. **Scheduler runs** every 5 minutes
2. **Fetches unsynced leads** from Google Sheet (where `Sync_Status` ≠ "Synced")
3. **Checks each lead**:
   - Validates required fields (name, email/phone)
   - Checks for duplicates in CRM (by email or phone)
4. **Creates new lead** in CRM with:
   - Mapped fields from Google Sheet
   - Source: "Meta - Facebook/Instagram"
   - Status: "New"
   - Priority: "Medium"
5. **Creates detailed note** with:
   - Campaign name
   - Ad set and ad name
   - Platform
   - Qualification
   - Meta lead ID
6. **Marks as synced** in Google Sheet (updates `Sync_Status` to "Synced")

### Field Mapping

| Google Sheet Column | CRM Field | Notes |
|---------------------|-----------|-------|
| `full_name` | `full_name` | Required |
| `email` | `email` | Required (or phone) |
| `phone_number` | `phone` | Normalized with +91 |
| `country` | `country` | Default: India |
| `form_name` | `course_interested` | Lead form name |
| `platform` | Part of `source` | Facebook/Instagram |
| `campaign_name` | Stored in notes | Campaign tracking |
| `ad_name` | Stored in notes | Ad performance |
| `created_time` | `created_at` | Lead timestamp |
| `your_highest_qualification:` | Stored in notes | Education level |

### Duplicate Detection

Leads are checked for duplicates by:
1. **Email** - Case-insensitive match
2. **Phone** - After normalization

If duplicate found:
- Lead is NOT created again
- `Sync_Status` is marked as "Synced"
- Sync report shows as "duplicate"

---

## 🎯 Best Practices

### For Google Sheet

1. **Don't rename key columns** that are mapped (full_name, email, phone_number)
2. **Keep `Sync_Status` column** - it prevents duplicate syncs
3. **Add new leads at the bottom** - sync processes rows in order
4. **Don't manually change `Sync_Status`** - let the system manage it

### For CRM

1. **Review new leads** within 5 minutes of sync
2. **Assign counselors** based on campaign/course interest
3. **Use campaign data** in notes for follow-up context
4. **Track conversion** by campaign for ROI analysis

### Troubleshooting

**Problem:** "Google Sheets service not available"
- Check that `google-credentials.json` exists in backend folder
- Verify service account email is shared with the sheet (Editor permission)
- Check backend logs for specific error

**Problem:** "No new leads synced"
- Check `Sync_Status` column - are all rows marked "Synced"?
- Verify leads have required fields (name + email/phone)
- Check for duplicates in CRM (by email/phone)

**Problem:** "Permission denied" error
- Service account needs "Editor" permission (not just "Viewer")
- Re-share the sheet with service account

**Problem:** Sync is slow
- Current interval: 5 minutes
- To change: Edit scheduler interval in `main.py` line ~273
- Don't set below 1 minute to avoid API rate limits

---

## 📊 Monitoring

### Check Logs

```bash
tail -f /Users/guneswaribokam/Downloads/IBMP\ CRM\ NEW/lead-ai/crm/backend/logs/app_*.log
```

Look for:
- `🔄 Starting Google Sheets sync...`
- `✅ Sync complete: X synced, Y duplicates, Z skipped`
- `❌` for any errors

### Dashboard (Future Enhancement)

Consider adding a sync dashboard page in the frontend showing:
- Last sync time
- Leads synced today/this week
- Success rate
- Campaign breakdown

---

## 🚀 What's Next?

1. **Test with real Meta leads** - Add a test lead to your Google Sheet
2. **Monitor sync logs** - Watch the automatic sync in action
3. **Assign leads** - Set up automatic assignment rules by campaign
4. **Track performance** - Analyze which campaigns bring best leads
5. **Optimize** - Adjust sync frequency based on lead volume

---

## 📞 Support

If you encounter issues:
1. Check backend logs
2. Test connection endpoint
3. Verify Google Cloud configuration
4. Ensure sheet is shared with service account

---

## 🔒 Security Notes

- `google-credentials.json` contains sensitive credentials
- **DO NOT commit this file to Git**
- Add to `.gitignore`:
  ```
  google-credentials.json
  ```
- Service account has minimal permissions (only Google Sheets read/write)
- No access to other Google services

---

**Setup Complete!** 🎉

Your CRM is now connected to Google Sheets and will automatically sync Meta leads every 5 minutes.
