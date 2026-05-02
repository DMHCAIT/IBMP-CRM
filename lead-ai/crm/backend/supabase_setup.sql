-- ============================================================
-- MED CRM - Full Database Setup (v2 - Fixed & Complete)
-- Paste this into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ============================================================
-- CORE TABLES
-- ============================================================

-- 1. USERS TABLE (first — other tables may reference it)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    phone VARCHAR,
    password VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    reports_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    lead_id VARCHAR UNIQUE NOT NULL,
    full_name VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    whatsapp VARCHAR,
    country VARCHAR,
    source VARCHAR,
    course_interested VARCHAR,
    status VARCHAR DEFAULT 'Fresh',
    assigned_to VARCHAR,
    follow_up_date TIMESTAMP,
    next_action TEXT,
    priority_level VARCHAR DEFAULT 'normal',

    -- AI Scoring
    ai_score FLOAT DEFAULT 0,
    ml_score FLOAT DEFAULT 0,
    rule_score FLOAT DEFAULT 0,
    confidence FLOAT DEFAULT 0,
    scoring_method VARCHAR DEFAULT 'rule_based',
    ai_segment VARCHAR DEFAULT 'Cold',
    conversion_probability FLOAT DEFAULT 0,

    -- Revenue
    expected_revenue FLOAT DEFAULT 0,
    actual_revenue FLOAT DEFAULT 0,

    -- AI Insights
    buying_signal_strength FLOAT DEFAULT 0,
    primary_objection VARCHAR,
    churn_risk FLOAT DEFAULT 0,
    recommended_script TEXT,
    feature_importance TEXT,

    -- Loss tracking
    loss_reason VARCHAR,
    loss_note TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_contact_date TIMESTAMP
);

-- 3. NOTES TABLE
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR,
    channel VARCHAR DEFAULT 'manual'
);

-- 4. ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);

-- 5. HOSPITALS TABLE
CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    country VARCHAR,
    city VARCHAR,
    contact_person VARCHAR,
    contact_email VARCHAR,
    contact_phone VARCHAR,
    collaboration_status VARCHAR DEFAULT 'Active',
    courses_offered JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. COURSES TABLE
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR NOT NULL,
    category VARCHAR,
    duration VARCHAR,
    eligibility VARCHAR,
    price FLOAT DEFAULT 0,
    currency VARCHAR DEFAULT 'INR',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. COUNSELORS TABLE
CREATE TABLE IF NOT EXISTS counselors (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    specialization VARCHAR,
    total_leads INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. COMMUNICATION HISTORY TABLE
CREATE TABLE IF NOT EXISTS communication_history (
    id SERIAL PRIMARY KEY,
    lead_id VARCHAR,
    communication_type VARCHAR,
    direction VARCHAR DEFAULT 'outbound',
    content TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    status VARCHAR DEFAULT 'sent',
    communication_metadata TEXT,
    sender VARCHAR,
    recipient VARCHAR,
    used_for_training BOOLEAN DEFAULT FALSE,
    sentiment_score FLOAT,
    ai_insights TEXT
);

-- 9. CHAT MESSAGES TABLE (must be BEFORE any ALTER TABLE referencing it)
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    lead_db_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    direction VARCHAR,
    msg_type VARCHAR DEFAULT 'text',
    content TEXT,
    media_url VARCHAR,
    filename VARCHAR,
    sender_name VARCHAR,
    timestamp TIMESTAMP DEFAULT NOW(),
    status VARCHAR DEFAULT 'sent',
    interakt_id VARCHAR
);

-- ============================================================
-- FEATURE TABLES (required by backend ORM — were missing)
-- ============================================================

-- 10. SLA CONFIG TABLE (singleton row id=1)
CREATE TABLE IF NOT EXISTS sla_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    first_contact_hours FLOAT DEFAULT 4.0,
    followup_response_hours FLOAT DEFAULT 24.0,
    no_activity_days INTEGER DEFAULT 7,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR,
    CONSTRAINT sla_config_singleton CHECK (id = 1)
);

-- 11. DECAY CONFIG TABLE (singleton row id=1)
CREATE TABLE IF NOT EXISTS decay_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    hot_to_warm_hours FLOAT DEFAULT 48.0,
    warm_to_stale_hours FLOAT DEFAULT 168.0,
    score_decay_per_day FLOAT DEFAULT 3.0,
    apply_score_decay BOOLEAN DEFAULT TRUE,
    check_interval_hours FLOAT DEFAULT 1.0,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR,
    CONSTRAINT decay_config_singleton CHECK (id = 1)
);

-- 12. DECAY LOG TABLE
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
    created_at TIMESTAMP DEFAULT NOW()
);

-- 13. WHATSAPP TEMPLATES TABLE
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
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);

-- 14. WORKFLOW RULES TABLE
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
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);

-- 15. WORKFLOW EXECUTIONS TABLE
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
    executed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SEED DEFAULT CONFIG (safe — no-op if already exists)
-- ============================================================
INSERT INTO sla_config (id, first_contact_hours, followup_response_hours, no_activity_days)
VALUES (1, 4.0, 24.0, 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO decay_config (id, enabled, hot_to_warm_hours, warm_to_stale_hours, score_decay_per_day, apply_score_decay, check_interval_hours)
VALUES (1, TRUE, 48.0, 168.0, 3.0, TRUE, 1.0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================
-- Leads
CREATE INDEX IF NOT EXISTS idx_leads_status        ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_country       ON leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to   ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_ai_score      ON leads(ai_score);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id       ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up     ON leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_created_at    ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at    ON leads(updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_last_contact  ON leads(last_contact_date);
CREATE INDEX IF NOT EXISTS idx_leads_source        ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_course        ON leads(course_interested);

-- Notes / Activities
CREATE INDEX IF NOT EXISTS idx_notes_lead_id       ON notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at    ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id  ON activities(lead_id);

-- Communication
CREATE INDEX IF NOT EXISTS idx_comm_lead_id        ON communication_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_lead_db_id     ON chat_messages(lead_db_id);
CREATE INDEX IF NOT EXISTS idx_chat_timestamp      ON chat_messages(timestamp);

-- Users / Decay / Workflow
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);
CREATE INDEX IF NOT EXISTS idx_decay_log_lead_id   ON decay_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_decay_log_created   ON decay_log(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_rule  ON workflow_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_lead  ON workflow_executions(lead_id);

-- ============================================================
-- SEED USERS (passwords are bcrypt hashed)
-- Plain passwords for reference:
--   admin123, manager123, leader123, counselor123
-- ============================================================
INSERT INTO users (id, full_name, email, phone, password, role, reports_to, is_active)
VALUES
-- Super Admin  (password: admin123)
(1,  'Sarah Johnson',    'sarah.johnson@crm.com',    '+1 555 0001',     '$2b$12$MlB069q8OCI0dWTImaio/eZMkiMuOXh0xcAbBmt2LzfKteD7t6Yaq', 'Super Admin', NULL, TRUE),
-- Managers     (password: manager123)
(2,  'Michael Chen',     'michael.chen@crm.com',     '+1 555 0002',     '$2b$12$Chc1Rfi6bHI.ZuSqPsuSU.NGuAIY9m62Qdp7wdbisHKxgg9mESECm', 'Manager',     1,    TRUE),
(3,  'Priya Sharma',     'priya.sharma@crm.com',     '+91 98765 43210', '$2b$12$Chc1Rfi6bHI.ZuSqPsuSU.NGuAIY9m62Qdp7wdbisHKxgg9mESECm', 'Manager',     1,    TRUE),
-- Team Leaders (password: leader123)
(4,  'David Martinez',   'david.martinez@crm.com',   '+1 555 0004',     '$2b$12$H9jZ1jDxI.PbsZHZQ1DeKu/WHT2NwgEfHsuZmXgFvznG0L3eMToDu', 'Team Leader', 2,    TRUE),
(5,  'Emily Wong',       'emily.wong@crm.com',        '+1 555 0005',     '$2b$12$H9jZ1jDxI.PbsZHZQ1DeKu/WHT2NwgEfHsuZmXgFvznG0L3eMToDu', 'Team Leader', 2,    TRUE),
(6,  'Rajesh Kumar',     'rajesh.kumar@crm.com',      '+91 98765 43211', '$2b$12$H9jZ1jDxI.PbsZHZQ1DeKu/WHT2NwgEfHsuZmXgFvznG0L3eMToDu', 'Team Leader', 3,    TRUE),
(7,  'Aisha Patel',      'aisha.patel@crm.com',       '+91 98765 43212', '$2b$12$H9jZ1jDxI.PbsZHZQ1DeKu/WHT2NwgEfHsuZmXgFvznG0L3eMToDu', 'Team Leader', 3,    TRUE),
-- Counselors   (password: counselor123)
(8,  'James Wilson',     'james.wilson@crm.com',      '+1 555 0008',     '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   4,    TRUE),
(9,  'Lisa Anderson',    'lisa.anderson@crm.com',     '+1 555 0009',     '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   4,    TRUE),
(10, 'Carlos Rodriguez', 'carlos.rodriguez@crm.com',  '+1 555 0010',     '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   5,    TRUE),
(11, 'Sophia Lee',       'sophia.lee@crm.com',        '+1 555 0011',     '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   5,    TRUE),
(12, 'Amit Desai',       'amit.desai@crm.com',        '+91 98765 43213', '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   6,    TRUE),
(13, 'Neha Gupta',       'neha.gupta@crm.com',        '+91 98765 43214', '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   6,    TRUE),
(14, 'Vikram Singh',     'vikram.singh@crm.com',      '+91 98765 43215', '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   7,    TRUE),
(15, 'Pooja Mehta',      'pooja.mehta@crm.com',       '+91 98765 43216', '$2b$12$lTWX1A/X/rI38ToL.qwGYuTTcsbFKLOaGe/C8QLSPEXPt0qPgOUJK', 'Counselor',   7,    TRUE)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence after manual ID inserts
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ============================================================
-- SEED COURSES (Demo medical education courses)
-- ============================================================
INSERT INTO courses (course_name, category, duration, price, currency, is_active)
VALUES
-- Cardiology
('Fellowship in Cardiology',                            'Cardiology',              '1 Year',   450000, 'INR', TRUE),
('Fellowship in Clinical Cardiology',                   'Cardiology',              '6 Months', 350000, 'INR', TRUE),
('Fellowship in Interventional Cardiology',             'Cardiology',              '1 Year',   500000, 'INR', TRUE),
('Fellowship in 2D Echocardiography',                   'Cardiology',              '3 Months', 150000, 'INR', TRUE),
('Fellowship in Pediatric Echocardiography',            'Cardiology',              '3 Months', 150000, 'INR', TRUE),
('Fellowship in Cardiothoracic Surgery',                'Surgery',                 '1 Year',   600000, 'INR', TRUE),
-- Emergency & Critical Care
('Fellowship in Emergency Medicine',                    'Emergency Medicine',       '1 Year',   400000, 'INR', TRUE),
('Fellowship in Critical Care Medicine',                'Critical Care',            '1 Year',   450000, 'INR', TRUE),
-- Gynecology & Obstetrics
('Fellowship in Gynecology & Obstetrics',               'Gynecology & Obstetrics', '1 Year',   400000, 'INR', TRUE),
('Fellowship in High-Risk Pregnancy',                   'Gynecology & Obstetrics', '6 Months', 300000, 'INR', TRUE),
('Fellowship in Fetal Medicine',                        'Gynecology & Obstetrics', '6 Months', 350000, 'INR', TRUE),
('Fellowship in Cosmetic Gynecology',                   'Gynecology & Obstetrics', '3 Months', 200000, 'INR', TRUE),
('Fellowship in Laparoscopy & Hysteroscopy',            'Gynecology & Obstetrics', '6 Months', 300000, 'INR', TRUE),
('Fellowship in Reproductive Medicine',                 'Gynecology & Obstetrics', '6 Months', 350000, 'INR', TRUE),
-- Dental & Oral Surgery
('Fellowship in Maxillofacial and Oral Surgery',        'Dental & Oral Surgery',   '1 Year',   350000, 'INR', TRUE),
('Fellowship in Oral Implantology and Laser Dentistry', 'Dental & Oral Surgery',   '6 Months', 250000, 'INR', TRUE),
-- Endocrinology & Diabetes
('Fellowship in Diabetes Mellitus',                     'Endocrinology',           '6 Months', 250000, 'INR', TRUE),
('Fellowship in Endocrinology',                         'Endocrinology',           '1 Year',   400000, 'INR', TRUE),
('Fellowship in Pediatric Endocrinology',               'Pediatrics',              '6 Months', 300000, 'INR', TRUE),
-- Orthopedics
('Fellowship in Orthopedics',                           'Orthopedics',             '1 Year',   400000, 'INR', TRUE),
('Fellowship in Arthroscopy',                           'Orthopedics',             '6 Months', 300000, 'INR', TRUE),
('Fellowship in Arthroscopy and Arthroplasty',          'Orthopedics',             '1 Year',   450000, 'INR', TRUE),
-- Pediatrics
('Fellowship in Pediatrics',                            'Pediatrics',              '1 Year',   350000, 'INR', TRUE),
('Fellowship in Neonatology',                           'Pediatrics',              '6 Months', 300000, 'INR', TRUE),
('Fellowship in Pediatric Neurology',                   'Pediatrics',              '1 Year',   400000, 'INR', TRUE),
-- Surgery
('Fellowship in General Surgery (1 Year)',              'Surgery',                 '1 Year',   400000, 'INR', TRUE),
('Fellowship in Minimal Access & Robotic Surgery',      'Surgery',                 '1 Year',   500000, 'INR', TRUE),
-- Oncology
('Fellowship in Medical Oncology',                      'Oncology',                '1 Year',   500000, 'INR', TRUE),
('Fellowship in Head & Neck Oncology',                  'Oncology',                '1 Year',   450000, 'INR', TRUE),
-- Neurology
('Fellowship in Clinical Neurology',                    'Neurology',               '1 Year',   400000, 'INR', TRUE),
-- Gastroenterology
('Fellowship in Gastroenterology',                      'Gastroenterology',        '1 Year',   450000, 'INR', TRUE),
-- Nephrology
('Fellowship in Nephrology',                            'Nephrology',              '1 Year',   400000, 'INR', TRUE),
-- Urology
('Fellowship in Urology',                               'Urology',                 '1 Year',   450000, 'INR', TRUE),
-- Pulmonology
('Fellowship in Respiratory Medicine',                  'Pulmonology',             '1 Year',   350000, 'INR', TRUE),
-- Anesthesiology
('Fellowship in Anesthesia',                            'Anesthesiology',          '1 Year',   400000, 'INR', TRUE),
('Fellowship in Pain Management',                       'Anesthesiology',          '6 Months', 250000, 'INR', TRUE),
-- Radiology
('Fellowship in Radiology',                             'Radiology',               '1 Year',   400000, 'INR', TRUE),
('Fellowship in Interventional Radiology',              'Radiology',               '1 Year',   450000, 'INR', TRUE),
-- Dermatology & Aesthetics
('Fellowship in Dermatology',                           'Dermatology & Aesthetics','6 Months', 300000, 'INR', TRUE),
('Fellowship in Cosmetic & Aesthetic Medicine',         'Dermatology & Aesthetics','6 Months', 300000, 'INR', TRUE),
('Fellowship in Trichology',                            'Dermatology & Aesthetics','3 Months', 150000, 'INR', TRUE),
-- Psychiatry
('Fellowship in Psychiatric Medicine',                  'Psychiatry',              '1 Year',   350000, 'INR', TRUE),
-- Rheumatology
('Fellowship in Rheumatology',                          'Rheumatology',            '1 Year',   400000, 'INR', TRUE),
-- Internal & Family Medicine
('Fellowship in Internal Medicine',                     'Internal Medicine',       '1 Year',   350000, 'INR', TRUE),
('Fellowship in Family Medicine',                       'Family Medicine',         '1 Year',   300000, 'INR', TRUE),
-- Haematology
('Fellowship in Clinical Haematology',                  'Haematology',             '1 Year',   400000, 'INR', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFY (check all 15 tables were created)
-- ============================================================
SELECT 'Tables created:' AS status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'leads','notes','activities','hospitals','courses','counselors',
    'users','communication_history','chat_messages',
    'sla_config','decay_config','decay_log',
    'wa_templates','workflow_rules','workflow_executions'
  )
ORDER BY table_name;

SELECT 'Users seeded:' AS status;
SELECT id, full_name, email, role FROM users ORDER BY id;

SELECT 'Courses seeded:' AS status;
SELECT COUNT(*) AS course_count FROM courses;

SELECT 'Config seeded:' AS status;
SELECT 'sla_config' AS tbl, COUNT(*) AS rows FROM sla_config
UNION ALL
SELECT 'decay_config', COUNT(*) FROM decay_config;

-- ============================================================
-- SAFE MIGRATIONS (idempotent — run on existing databases)
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loss_reason VARCHAR;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loss_note TEXT;

-- ============================================================
-- NOTE: Run migrations/enable_rls_security.sql SEPARATELY
-- after this script if you want Row Level Security enabled.
-- ============================================================
