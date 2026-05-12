-- ============================================================
-- MED CRM - Migration Script (v2 - Fixed & Aligned with ORM)
-- Run this on an EXISTING database to bring schema up to date.
-- All statements are idempotent (safe to re-run).
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    reports_to INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- fixed: was VARCHAR, must be INTEGER FK
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- LEADS TABLE (full schema aligned with ORM)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    lead_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    country VARCHAR(100),
    source VARCHAR(100),
    course_interested VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Fresh',          -- fixed: was 'Follow Up', ORM default is 'Fresh'
    assigned_to VARCHAR(255),
    follow_up_date TIMESTAMP,
    next_action TEXT,
    priority_level VARCHAR(50) DEFAULT 'normal',

    -- AI Scoring
    ai_score FLOAT DEFAULT 0,
    ml_score FLOAT,
    rule_score FLOAT,
    confidence FLOAT,
    scoring_method VARCHAR(50) DEFAULT 'rule_based',
    ai_segment VARCHAR(50) DEFAULT 'Cold',
    conversion_probability FLOAT DEFAULT 0,

    -- Revenue
    expected_revenue FLOAT DEFAULT 0,
    actual_revenue FLOAT DEFAULT 0,

    -- AI Insights
    buying_signal_strength FLOAT DEFAULT 0,
    primary_objection VARCHAR(255),
    churn_risk FLOAT DEFAULT 0,
    recommended_script TEXT,
    feature_importance TEXT,

    -- Loss tracking
    loss_reason VARCHAR(255),
    loss_note TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contact_date TIMESTAMP
);

-- Safe column additions for existing leads tables
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority_level VARCHAR(50) DEFAULT 'normal';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ml_score FLOAT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rule_score FLOAT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confidence FLOAT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scoring_method VARCHAR(50) DEFAULT 'rule_based';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS buying_signal_strength FLOAT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS primary_objection VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS churn_risk FLOAT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS recommended_script TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS feature_importance TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loss_reason VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loss_note TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP;

-- ============================================================
-- NOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by VARCHAR(255),
    channel VARCHAR(50) DEFAULT 'manual',         -- added: was missing from migration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE notes ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'manual';

-- ============================================================
-- ACTIVITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- COURSES TABLE (aligned with ORM)
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    duration VARCHAR(100),
    eligibility VARCHAR(255),           -- added: was missing
    price FLOAT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR', -- added: was missing
    description TEXT,                   -- added: was missing
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS eligibility VARCHAR(255);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================
-- COUNSELORS TABLE (fixed: was full_name, should be name)
-- ============================================================
CREATE TABLE IF NOT EXISTS counselors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,         -- fixed: was full_name (mismatches ORM + setup.sql)
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    specialization VARCHAR(255),
    total_leads INTEGER DEFAULT 0,      -- fixed: was active_leads
    total_conversions INTEGER DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0,    -- fixed: was performance_score
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- If migrating from old schema that had full_name:
ALTER TABLE counselors ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE counselors ADD COLUMN IF NOT EXISTS total_leads INTEGER DEFAULT 0;
ALTER TABLE counselors ADD COLUMN IF NOT EXISTS conversion_rate FLOAT DEFAULT 0;

-- ============================================================
-- HOSPITALS TABLE (fixed: was hospital_name, should be name)
-- ============================================================
CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,             -- fixed: was hospital_name
    country VARCHAR(100),
    city VARCHAR(100),
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),             -- fixed: was email
    contact_phone VARCHAR(50),              -- fixed: was phone
    collaboration_status VARCHAR(50) DEFAULT 'Active',  -- added: was partnership_status + wrong name
    courses_offered JSONB DEFAULT '[]',     -- added: was missing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Safe column migrations for existing hospitals tables:
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS collaboration_status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS courses_offered JSONB DEFAULT '[]';

-- ============================================================
-- COMMUNICATION HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS communication_history (
    id SERIAL PRIMARY KEY,
    lead_id VARCHAR,
    communication_type VARCHAR,
    direction VARCHAR DEFAULT 'outbound',
    content TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR DEFAULT 'sent',
    communication_metadata TEXT,
    sender VARCHAR,
    recipient VARCHAR,
    used_for_training BOOLEAN DEFAULT FALSE,
    sentiment_score FLOAT,
    ai_insights TEXT
);

-- ============================================================
-- CHAT MESSAGES TABLE (CREATE before ALTER)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    lead_db_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    direction VARCHAR(20),
    msg_type VARCHAR(20) DEFAULT 'text',
    content TEXT,
    media_url VARCHAR,
    filename VARCHAR,
    sender_name VARCHAR,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'sent',
    interakt_id VARCHAR
);

-- ============================================================
-- FEATURE TABLES (missing entirely from old migration)
-- ============================================================

CREATE TABLE IF NOT EXISTS sla_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    first_contact_hours FLOAT DEFAULT 4.0,
    followup_response_hours FLOAT DEFAULT 24.0,
    no_activity_days INTEGER DEFAULT 7,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR,
    CONSTRAINT sla_config_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS decay_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    hot_to_warm_hours FLOAT DEFAULT 48.0,
    warm_to_stale_hours FLOAT DEFAULT 168.0,
    score_decay_per_day FLOAT DEFAULT 3.0,
    apply_score_decay BOOLEAN DEFAULT TRUE,
    check_interval_hours FLOAT DEFAULT 1.0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR,
    CONSTRAINT decay_config_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS decay_log (
    id SERIAL PRIMARY KEY,
    lead_id VARCHAR,
    lead_name VARCHAR,
    assigned_to VARCHAR,
    old_status VARCHAR,
    new_status VARCHAR,
    old_score FLOAT,
    new_score FLOAT,
    hours_since_contact FLOAT,
    reason VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wa_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    body TEXT NOT NULL,
    variables TEXT,
    description VARCHAR,
    emoji VARCHAR DEFAULT '💬',
    is_active BOOLEAN DEFAULT TRUE,
    is_builtin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR
);

CREATE TABLE IF NOT EXISTS workflow_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR,
    enabled BOOLEAN DEFAULT TRUE,
    trigger_type VARCHAR,
    trigger_value VARCHAR,
    conditions TEXT DEFAULT '[]',
    actions TEXT DEFAULT '[]',
    run_limit INTEGER DEFAULT 1,
    cooldown_hours FLOAT DEFAULT 24.0,
    total_runs INTEGER DEFAULT 0,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES workflow_rules(id) ON DELETE CASCADE,
    rule_name VARCHAR,
    lead_id VARCHAR,
    lead_name VARCHAR,
    assigned_to VARCHAR,
    actions_taken TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_msg VARCHAR,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED DEFAULT CONFIG (safe — no-op if already exists)
-- ============================================================
INSERT INTO sla_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO decay_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INDEXES (comprehensive)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_status           ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_country          ON leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to      ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_ai_score         ON leads(ai_score);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id          ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up        ON leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_created_at       ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at       ON leads(updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_last_contact     ON leads(last_contact_date);
CREATE INDEX IF NOT EXISTS idx_leads_source           ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_course           ON leads(course_interested);
CREATE INDEX IF NOT EXISTS idx_leads_segment          ON leads(ai_segment);
CREATE INDEX IF NOT EXISTS idx_leads_status_segment   ON leads(status, ai_segment);
CREATE INDEX IF NOT EXISTS idx_notes_lead_id          ON notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at       ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id     ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_type        ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_comm_lead_id           ON communication_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_lead_db_id        ON chat_messages(lead_db_id);
CREATE INDEX IF NOT EXISTS idx_chat_timestamp         ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role             ON users(role);
CREATE INDEX IF NOT EXISTS idx_courses_category       ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_active         ON courses(is_active);
CREATE INDEX IF NOT EXISTS idx_decay_log_lead_id      ON decay_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_decay_log_created      ON decay_log(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_rule     ON workflow_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_lead     ON workflow_executions(lead_id);

-- ============================================================
-- AUTO-UPDATE TRIGGERS (updated_at columns)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VERIFY
-- ============================================================
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'leads','notes','activities','hospitals','courses','counselors',
    'users','communication_history','chat_messages',
    'sla_config','decay_config','decay_log',
    'wa_templates','workflow_rules','workflow_executions'
  )
ORDER BY table_name;
