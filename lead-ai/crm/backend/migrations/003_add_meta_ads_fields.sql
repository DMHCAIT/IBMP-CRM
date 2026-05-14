-- ============================================================
-- Migration: Add Meta Ads Campaign & Marketing Fields
-- Date: 2026-05-14
-- Purpose: Add missing fields for Google Sheets Meta Ads sync
-- ============================================================

-- Add campaign and marketing fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_medium VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_name VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_group VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_name VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_id VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS adset_name VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS adset_id VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_name VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_id VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_quality VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_rating VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_organic BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_id VARCHAR;

-- Add indexes for campaign/marketing fields
CREATE INDEX IF NOT EXISTS idx_leads_campaign_medium ON leads(campaign_medium);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_name ON leads(campaign_name);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_ad_id ON leads(ad_id);
CREATE INDEX IF NOT EXISTS idx_leads_adset_id ON leads(adset_id);
CREATE INDEX IF NOT EXISTS idx_leads_form_id ON leads(form_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_quality ON leads(lead_quality);
CREATE INDEX IF NOT EXISTS idx_leads_qualification ON leads(qualification);
CREATE INDEX IF NOT EXISTS idx_leads_external_id ON leads(external_id);

-- Verify migration
SELECT 'Migration complete: Meta Ads fields added' AS status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND column_name IN (
    'campaign_medium', 'campaign_name', 'campaign_group', 'campaign_id',
    'ad_name', 'ad_id', 'adset_name', 'adset_id', 
    'form_name', 'form_id', 'lead_quality', 'lead_rating',
    'qualification', 'city', 'is_organic', 'external_id'
  )
ORDER BY column_name;
