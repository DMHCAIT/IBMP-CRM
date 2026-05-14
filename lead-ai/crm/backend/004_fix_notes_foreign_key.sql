-- ============================================================
-- Migration 004: Fix foreign key constraints for cascade deletion
-- ============================================================
-- Issue: notes and activities tables foreign keys prevent lead deletion
-- Solution: Add ON DELETE CASCADE to automatically delete related records when lead is deleted
-- Date: 2026-05-14
-- ============================================================

-- Step 1: Fix notes table foreign key constraint
ALTER TABLE notes
DROP CONSTRAINT IF EXISTS notes_lead_id_fkey;

ALTER TABLE notes
ADD CONSTRAINT notes_lead_id_fkey
FOREIGN KEY (lead_id)
REFERENCES leads(id)
ON DELETE CASCADE;

-- Step 2: Fix activities table foreign key constraint
ALTER TABLE activities
DROP CONSTRAINT IF EXISTS activities_lead_id_fkey;

ALTER TABLE activities
ADD CONSTRAINT activities_lead_id_fkey
FOREIGN KEY (lead_id)
REFERENCES leads(id)
ON DELETE CASCADE;

-- Explanation:
-- When a lead is deleted, all associated notes and activities will be automatically deleted
-- This prevents orphaned records and allows clean lead deletion

-- Verify the constraints were created correctly:
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
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

-- Expected result: delete_rule should be 'CASCADE' for both tables
