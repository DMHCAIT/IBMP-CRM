# Duplicate Lead Detection Guide

## How It Works

When you sync leads from Google Sheet to the CRM, the system automatically detects duplicates based on phone numbers and prevents importing the same lead twice.

### Automatic Duplicate Detection

**Trigger**: Every 5 minutes (auto-sync) OR manual sync via Google Sheet menu

**Process**:
1. Google Apps Script sends leads to CRM webhook
2. Webhook extracts last 10 digits of phone number
3. Searches database for existing lead with matching phone
4. **If match found**:
   - Skips creating new lead
   - Returns existing Lead ID, Owner, and Status
   - Writes existing Lead ID back to Google Sheet
   - Logs duplicate in execution log
5. **If no match**:
   - Creates new lead with "FRESH" status
   - Generates new Lead ID
   - Writes new Lead ID to sheet

### Where to See Duplicate Information

#### 1. Google Sheet Execution Log
**Location**: Google Sheet → Extensions → Apps Script → View → Executions

**Example Output**:
```
Sync complete: 15 created, 0 updated, 3 duplicates

=== DUPLICATE LEADS FOUND ===
Row 18: Ahmed Alshaibah (9185514832) - Already exists as LEAD260518143209 (Owner: Sarah Khan, Status: Fresh)
Row 23: John Doe (9034108514) - Already exists as LEAD260517120534 (Owner: Mike Johnson, Status: Contacted)
Row 31: Jane Smith (9176583194) - Already exists as LEAD260516095412 (Owner: Unassigned, Status: Fresh)
```

#### 2. Google Sheet Lead ID Column
- Existing Lead ID is written to "Lead ID" column
- If row has Lead ID → already in CRM
- If row is empty → will be synced on next run

#### 3. Campaign Page (After Sync)
**Path**: CRM → Marketing → Campaigns → "From Sheet" tab

**Instructions**:
1. First, run sync in Google Sheet: `IBMP CRM → Sync New Leads`
2. Check execution log for duplicate results
3. Open CRM Campaign page
4. Click "Fetch from Sheet" button
5. View all synced leads (includes both new and existing)

**Note**: The Campaign page shows all leads from database. To see which ones were duplicates during sync, check the Google Sheet execution log.

## Syncing Workflows

### Option 1: Auto-Sync (Recommended)
- **Setup**: Run `IBMP CRM → Enable Auto-Sync` once in Google Sheet
- **Frequency**: Every 5 minutes automatically
- **Behavior**: Only syncs rows without Lead ID
- **Duplicates**: Automatically detected and logged
- **Best For**: Continuous lead flow (e.g., Meta Ads forms)

### Option 2: Manual Sync - New Leads Only
- **Trigger**: `IBMP CRM → Sync New Leads Only`
- **Behavior**: Syncs only rows missing Lead ID
- **Duplicates**: Detected by phone number
- **Best For**: Periodic imports from external sources

### Option 3: Manual Sync - All Leads
- **Trigger**: `IBMP CRM → Sync All Leads to CRM`
- **Behavior**: Re-syncs ALL rows (update existing + create new)
- **Duplicates**: Detected for new rows
- **Existing Leads**: Updated with latest sheet data
- **Best For**: Bulk updates or fixing data issues

## Duplicate Detection Rules

### What Defines a Duplicate?
- **Primary Check**: Phone number (last 10 digits match)
- **Reason**: Phone numbers may have different formats: `+91 9185514832`, `9185514832`, `091-8551-4832`
- **Match Algorithm**: Strips all non-digit characters, compares last 10 digits

### Duplicate Response Information
When duplicate detected, system returns:
- `existing_lead_id`: "LEAD260518143209"
- `existing_owner`: "Sarah Khan" or "Unassigned"
- `existing_status`: "Fresh", "Contacted", "Interested", etc.
- `action`: "duplicate"
- `duplicate`: true

### What Happens to Duplicates?
✅ **Preserved**:
- Original lead data remains unchanged
- Existing owner and status maintained
- All notes and activities preserved
- Lead ID stays the same

❌ **Not Created**:
- No new lead entry in database
- Counter increments: `skipped: 1`
- Execution log shows duplicate details

📝 **Sheet Updated**:
- Existing Lead ID written to duplicate row
- Makes it easy to identify which leads already exist
- Next sync will skip this row (has Lead ID)

## Example Scenarios

### Scenario 1: Same Lead Submits Form Twice
**Situation**: Ahmed fills out Meta Ads form on Monday and again on Friday

**Result**:
- Monday: New lead created → LEAD260511080000 (Owner: Unassigned, Status: Fresh)
- Friday: Duplicate detected → Skipped, returns LEAD260511080000
- Sheet shows: Both rows have same Lead ID
- Execution log: "Row 47: Already exists as LEAD260511080000 (Owner: Unassigned, Status: Fresh)"

### Scenario 2: Lead Reassigned After Import
**Situation**: 
1. Lead synced on Day 1 → LEAD260510000000 (Owner: Unassigned)
2. Counselor assigns to themselves → Owner: "Sarah Khan"
3. Same person submits form again on Day 3

**Result**:
- Duplicate detected
- Execution log: "Already exists as LEAD260510000000 (Owner: Sarah Khan, Status: Contacted)"
- Sheet row gets existing Lead ID
- Sarah Khan remains the owner (no reassignment)

### Scenario 3: Lead Already Converted
**Situation**: Enrolled student fills out interest form again

**Result**:
- Duplicate detected
- Execution log shows: "(Owner: Mike Johnson, Status: Enrolled)"
- No new lead created
- Enrolled status preserved
- Mike Johnson can follow up if needed

## Best Practices

### ✅ Do's
1. **Enable auto-sync** for continuous lead flow
2. **Check execution logs** regularly to monitor duplicates
3. **Review duplicate leads** - may indicate re-interest
4. **Keep phone numbers clean** in source data
5. **Use Lead ID column** to track sync status

### ❌ Don'ts
1. **Don't delete Lead IDs** from synced rows (causes re-import)
2. **Don't manually enter lead data** after sync (use CRM edit)
3. **Don't disable webhook secret** (security risk)
4. **Don't ignore duplicate patterns** (may need follow-up)

## Troubleshooting

### Issue: Duplicate Not Detected
**Possible Causes**:
- Phone numbers have extra characters/spaces
- Phone number column not mapped correctly
- Database phone field is NULL

**Solution**:
1. Check Google Sheet column header matches COLUMN_MAP
2. Ensure phone column not empty
3. Verify phone format consistency

### Issue: Wrong Lead Marked as Duplicate
**Cause**: Two people have same/similar phone number

**Solution**:
1. Check execution log for phone number
2. Search CRM for that phone
3. Update phone number if incorrect
4. Re-sync with corrected data

### Issue: Duplicate Count Too High
**Investigation**:
1. Open execution log
2. Find duplicate section
3. Check if same phone appears multiple times
4. Look for owner assignments - repeated owner may indicate data issue

**Action**:
- Contact owners of duplicate leads
- Verify if genuine re-interest or data error
- Clean up sheet data if needed

## Technical Details

### Webhook Endpoint
**URL**: `https://ibmp-crm-1.onrender.com/api/webhooks/sync-all-from-sheet`

**Authentication**: `X-Webhook-Secret` header (set in Apps Script and Render)

**Request Format**:
```json
{
  "leads": [
    {
      "full_name": "Ahmed Alshaibah",
      "phone": "+91 9185514832",
      "email": "ahmed@example.com",
      ...
    }
  ]
}
```

**Response Format** (with duplicate):
```json
{
  "created": 12,
  "updated": 0,
  "skipped": 3,
  "results": [
    {
      "lead_id": "LEAD260518143209",
      "action": "duplicate",
      "existing_lead_id": "LEAD260518143209",
      "existing_owner": "Sarah Khan",
      "existing_status": "Fresh",
      "duplicate": true
    }
  ]
}
```

### Database Query
```sql
-- Duplicate check query (simplified)
SELECT lead_id, full_name, assigned_to, status, phone
FROM leads
WHERE phone ILIKE '%8514832%'  -- Last 10 digits
LIMIT 1;
```

### Apps Script Logging
```javascript
// Duplicate tracking in syncNewLeads()
if (result.action === "duplicate") {
  duplicates.push({
    row: mapping.row,
    existing_lead_id: result.existing_lead_id,
    existing_owner: result.existing_owner,
    existing_status: result.existing_status
  });
}

// Log output
Logger.log("Row " + dup.row + " - Already exists as " + 
  dup.existing_lead_id + " (Owner: " + dup.existing_owner + ")");
```

## Summary

**Duplicate detection is automatic and happens during Google Sheet sync.**

**Check duplicates**: Google Sheet → Extensions → Apps Script → View → Executions

**Key Info Shown**: Existing Lead ID, Owner Name, Current Status

**Action Required**: Review duplicate leads - may need follow-up if re-interest

**Campaign Page**: Shows all synced leads (new + existing) after sync completes
