# Fix Foreign Key Constraint Errors

## Problem
Unable to delete leads in Supabase due to foreign key constraint errors:
```
Unable to delete rows as one of them is currently referenced by a foreign key constraint from the table `notes`
DETAIL: Key (id)=(14) is still referenced from table notes.

Unable to delete rows as one of them is currently referenced by a foreign key constraint from the table `activities`
DETAIL: Key (id)=(33) is still referenced from table activities.
```

## Solution
Add `ON DELETE CASCADE` to the `notes` and `activities` table foreign key constraints so that when a lead is deleted, all associated records are automatically deleted.

## Steps to Fix

### 1. Open Supabase SQL Editor
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your IBMP CRM project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Run the Migration Script
Copy and paste the following SQL:

```sql
-- Fix notes table
ALTER TABLE notes
DROP CONSTRAINT IF EXISTS notes_lead_id_fkey;

ALTER TABLE notes
ADD CONSTRAINT notes_lead_id_fkey
FOREIGN KEY (lead_id)
REFERENCES leads(id)
ON DELETE CASCADE;

-- Fix activities table
ALTER TABLE activities
DROP CONSTRAINT IF EXISTS activities_lead_id_fkey;

ALTER TABLE activities
ADD CONSTRAINT activities_lead_id_fkey
FOREIGN KEY (lead_id)
REFERENCES leads(id)
ON DELETE CASCADE;
```

### 3. Click "Run" Button
The query should execute successfully with a message like:
```
Success. No rows returned
```

### 4. Verify the Fix
Run this verification query:
```sql
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('notes', 'activities')
    AND kcu.column_name = 'lead_id';
```

**Expected Result:**
- Both `notes_lead_id_fkey` and `activities_lead_id_fkey` should show `delete_rule = CASCADE`

### 5. Test Lead Deletion
Try deleting lead ID 14 or 33 again from the Supabase Table Editor or your CRM:
- The lead should now delete successfully
- All associated notes and activities for that lead will be automatically deleted

## What This Does

**Before Fix:**
- Trying to delete a lead with notes or activities → Error
- You had to manually delete all notes and activities first, then delete the lead

**After Fix:**
- Deleting a lead → Automatically deletes all its notes and activities
- Clean, cascade deletion without orphaned data

## Other Tables with Similar Constraints

The following tables also have foreign keys to `leads` and should already have `ON DELETE CASCADE`:
- **activities** - Lead activities
- **communications** - Communication logs
- **tasks** - Follow-up tasks
- **whatsapp_messages** - WhatsApp chat history

If you encounter similar errors with these tables, use the same approach:
```sql
ALTER TABLE [table_name]
DROP CONSTRAINT IF EXISTS [constraint_name];

ALTER TABLE [table_name]
ADD CONSTRAINT [constraint_name]
FOREIGN KEY (lead_id)
REFERENCES leads(id)
ON DELETE CASCADE;
```

## Quick Reference

| Behavior | What Happens When Lead is Deleted |
|----------|-----------------------------------|
| **CASCADE** | Delete all related notes automatically (✅ Recommended) |
| **SET NULL** | Set lead_id to NULL in notes (keeps orphaned notes) |
| **RESTRICT** | Prevent deletion if notes exist (❌ Current problem) |
| **NO ACTION** | Same as RESTRICT |

---

**Status**: Migration script ready at `004_fix_notes_foreign_key.sql`
**Action Required**: Run the SQL in Supabase Dashboard SQL Editor
