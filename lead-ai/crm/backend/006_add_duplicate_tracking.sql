-- ============================================================
-- Add Duplicate Tracking to Leads Table
-- Purpose: Track how many times a lead was attempted to be imported
-- ============================================================

-- Add duplicate_count column to track number of duplicate import attempts
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duplicate_count INTEGER DEFAULT 0;

-- Add last_duplicate_date to track when the last duplicate attempt occurred
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_duplicate_date TIMESTAMP;

-- Add comment to explain the columns
COMMENT ON COLUMN leads.duplicate_count IS 'Number of times this lead was attempted to be imported again (duplicate attempts)';
COMMENT ON COLUMN leads.last_duplicate_date IS 'Timestamp of the last duplicate import attempt';

-- Create index for filtering leads by duplicate count (to find frequently duplicated leads)
CREATE INDEX IF NOT EXISTS idx_leads_duplicate_count ON leads(duplicate_count) WHERE duplicate_count > 0;

-- Update existing leads to set duplicate_count to 0 if NULL
UPDATE leads SET duplicate_count = 0 WHERE duplicate_count IS NULL;
