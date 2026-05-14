-- ============================================================
-- Migration 005: Performance optimization indexes
-- ============================================================
-- Purpose: Speed up common queries and searches
-- Date: 2026-05-14
-- ============================================================

-- Index for phone number searches (used in duplicate detection)
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_phone_lower ON leads(LOWER(phone));

-- Index for email searches
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON leads(LOWER(email));

-- Index for full name searches
CREATE INDEX IF NOT EXISTS idx_leads_full_name_lower ON leads(LOWER(full_name));

-- Composite index for campaign queries (used frequently in Campaign Analytics page)
CREATE INDEX IF NOT EXISTS idx_leads_campaign_composite ON leads(campaign_name, campaign_medium, status);

-- Index for campaign ID searches (Meta Ads integration)
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_ad_id ON leads(ad_id);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON leads(status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_leads_source_created ON leads(source, created_at DESC);

-- Partial index for Fresh leads (most queried status)
CREATE INDEX IF NOT EXISTS idx_leads_fresh ON leads(created_at DESC) WHERE status = 'Fresh';

-- Partial index for Follow Up leads with dates
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(follow_up_date) WHERE status = 'Follow Up' AND follow_up_date IS NOT NULL;

-- Index for AI score sorting
CREATE INDEX IF NOT EXISTS idx_leads_ai_score_desc ON leads(ai_score DESC NULLS LAST);

-- Analyze tables to update statistics for query planner
ANALYZE leads;
ANALYZE notes;
ANALYZE activities;
ANALYZE communication_history;

-- Verification: Check indexes on leads table
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'leads'
ORDER BY indexname;
