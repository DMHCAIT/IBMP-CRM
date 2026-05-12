# Notes Counselor Name Display Fix

## Issues Fixed

### 1. ✅ Notes showing "Counselor" instead of actual name
**Problem**: Notes were displaying the generic text "Counselor" instead of the actual counselor's name

**Root Cause**: Frontend was falling back to `'Counselor'` string when no counselor was selected

**Solution**: 
- Updated backend to automatically extract the logged-in user's name from the JWT token
- Backend now uses the authenticated user's full name for all notes
- Removed hardcoded "Counselor" fallback in frontend

### 2. ✅ Imported leads not showing who imported them
**Problem**: When leads were imported via bulk upload, no notes were created to track who imported them

**Solution**:
- Modified `bulk_create_leads` endpoint to create a note for each imported lead
- Note includes the importer's full name from the authenticated user
- If notes column is mapped during import, that content is used; otherwise a default "Lead imported via bulk upload" message is added

### 3. ✅ Notes field mapping during import
**Problem**: Notes column from Excel/CSV was being ignored during import

**Solution**:
- Added `notes` field to `LeadCreate` schema as optional
- Updated frontend import processing to include notes in the lead object
- Backend creates note records with the mapped note content

## Changes Made

### Backend (`main.py`)

1. **Updated `add_note` endpoint** (Line ~2041):
   - Now extracts user's full name from JWT token automatically
   - Uses authenticated user's name instead of relying on frontend
   - Fallback chain: authenticated user → provided name → "System"

2. **Updated `bulk_create_leads` endpoint** (Line ~1458):
   - Added Request parameter to access authentication headers
   - Extracts importer's name from JWT token
   - Creates a note for each imported lead with importer's name
   - Handles both Supabase and SQLite storage paths

3. **Updated `LeadCreate` schema** (Line ~728):
   - Added optional `notes` field for import functionality
   - Notes content is sanitized and validated
   - Used to populate initial note when importing leads

### Frontend

1. **LeadDetails.js** (Line ~99):
   - Removed hardcoded `'Counselor'` fallback
   - Now lets backend determine the counselor name from authentication

2. **LeadsPageEnhanced.js** (Line ~407):
   - Added `notes` field to processed lead data
   - Notes from mapped Excel column are now included in import payload

## How It Works Now

### Creating Manual Notes
1. User adds a note on the lead detail page
2. Frontend sends note content and channel to backend
3. Backend extracts the user's full name from JWT token
4. Note is saved with the actual user's name

### Importing Leads
1. User uploads Excel/CSV file
2. Maps columns including optional "Notes" column
3. For each imported lead:
   - Backend extracts importer's name from JWT token
   - Creates the lead
   - Creates a note with:
     - Content: Mapped notes content OR "Lead imported via bulk upload"
     - Created by: Importer's full name
     - Channel: "manual"

## Testing Checklist

- [ ] Create a new note on a lead - verify it shows your name, not "Counselor"
- [ ] Import leads without notes column - verify each has a note showing who imported with default message
- [ ] Import leads with notes column mapped - verify notes content appears with importer's name
- [ ] Check that old notes still display correctly
- [ ] Verify counselor names appear for all users (Admin, Counselor roles)

## Files Modified

1. `/lead-ai/crm/backend/main.py`
   - `add_note` endpoint
   - `bulk_create_leads` endpoint
   - `LeadCreate` schema

2. `/lead-ai/crm/frontend/src/pages/LeadDetails.js`
   - `handleAddNote` function

3. `/lead-ai/crm/frontend/src/pages/LeadsPageEnhanced.js`
   - `processImportRowsWithMapping` function

## Benefits

✅ **Accurate Attribution**: All notes now show the actual user who created them
✅ **Import Tracking**: Clear audit trail of who imported leads and when
✅ **Better Data Quality**: Notes from imported files are preserved and attributed
✅ **Security**: User identity is determined server-side from authentication, not client input
