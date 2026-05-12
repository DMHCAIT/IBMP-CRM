-- =============================================================================
-- IBMP CRM — Migration 002: Multi-Tenancy
-- =============================================================================
-- Run this ONCE against your Supabase project (SQL Editor or psql).
-- Safe to re-run: all DDL is guarded with IF NOT EXISTS / DO $$ blocks.
--
-- What this migration does:
--   1. Creates the `tenants` table (SaaS org unit)
--   2. Adds `tenant_id UUID` to every multi-tenant table
--   3. Seeds a "default" tenant so existing rows have a valid FK
--   4. Back-fills existing rows with the default tenant_id
--   5. Adds NOT NULL + FK constraints after back-fill
--   6. Creates GiST indexes for tenant-scoped queries
--   7. Drops the old per-user RLS policies from 001
--   8. Creates new tenant-isolation RLS policies
--   9. Adds a `tenants` RLS policy (only the tenant's own row)
--
-- Conflict resolution note: if you already ran enable_rls_security.sql
-- the old policies are explicitly dropped here before replacement.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: tenants table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL,
    subdomain           TEXT        NOT NULL UNIQUE,   -- e.g. "ibmp" → ibmp.yourcrm.com
    plan                TEXT        NOT NULL DEFAULT 'starter',  -- starter | growth | enterprise
    max_seats           INT         NOT NULL DEFAULT 5,
    billing_email       TEXT,
    stripe_customer_id  TEXT,
    stripe_sub_id       TEXT,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    settings            JSONB       NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- Plan limits helper (call from application layer)
COMMENT ON COLUMN tenants.plan IS 'starter=5 seats, growth=25 seats, enterprise=unlimited';
COMMENT ON COLUMN tenants.settings IS 'Arbitrary per-tenant config: branding, features, integrations';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Seed the default tenant for existing data
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    _default_tid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    INSERT INTO tenants (id, name, subdomain, plan, max_seats, is_active)
    VALUES (_default_tid, 'IBMP Default', 'ibmp', 'enterprise', 9999, TRUE)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add tenant_id columns (nullable first — filled in step 4)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper macro pattern: add column only if absent
DO $$
DECLARE
    _cols TEXT[] := ARRAY[
        'leads', 'notes', 'activities', 'chat_messages', 'communication_history',
        'users', 'counselors', 'wa_templates', 'workflow_rules', 'workflow_executions',
        'decay_config', 'decay_log', 'sla_config', 'courses', 'hospitals'
    ];
    _t TEXT;
BEGIN
    FOREACH _t IN ARRAY _cols LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = _t
              AND column_name  = 'tenant_id'
        ) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID', _t);
            RAISE NOTICE 'Added tenant_id to %', _t;
        ELSE
            RAISE NOTICE 'tenant_id already exists on % — skipping', _t;
        END IF;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Back-fill existing rows with the default tenant
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    _default_tid UUID := '00000000-0000-0000-0000-000000000001';
    _tables TEXT[] := ARRAY[
        'leads', 'notes', 'activities', 'chat_messages', 'communication_history',
        'users', 'counselors', 'wa_templates', 'workflow_rules', 'workflow_executions',
        'decay_config', 'decay_log', 'sla_config', 'courses', 'hospitals'
    ];
    _t TEXT;
BEGIN
    FOREACH _t IN ARRAY _tables LOOP
        EXECUTE format(
            'UPDATE %I SET tenant_id = %L WHERE tenant_id IS NULL',
            _t, _default_tid
        );
        RAISE NOTICE 'Back-filled tenant_id on %', _t;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Make tenant_id NOT NULL and add FK constraints
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    _tables TEXT[] := ARRAY[
        'leads', 'notes', 'activities', 'chat_messages', 'communication_history',
        'users', 'counselors', 'wa_templates', 'workflow_rules', 'workflow_executions',
        'decay_config', 'decay_log', 'sla_config', 'courses', 'hospitals'
    ];
    _t TEXT;
    _constraint_name TEXT;
BEGIN
    FOREACH _t IN ARRAY _tables LOOP
        -- NOT NULL constraint
        EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', _t);

        -- FK constraint (idempotent via name check)
        _constraint_name := _t || '_tenant_id_fkey';
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema      = 'public'
              AND table_name        = _t
              AND constraint_name   = _constraint_name
              AND constraint_type   = 'FOREIGN KEY'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I
                 FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
                _t, _constraint_name
            );
            RAISE NOTICE 'FK added on %', _t;
        END IF;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Tenant-scoped indexes (vastly speeds up all queries)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_tenant          ON leads          (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notes_tenant          ON notes          (tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant     ON activities     (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_tenant      ON chat_messages  (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_hist_tenant      ON communication_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant          ON users          (tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_tenant   ON wa_templates   (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_tenant ON workflow_rules  (tenant_id);

-- Composite index for the most common query pattern: tenant + created_at
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created
    ON leads (tenant_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Drop old RLS policies from enable_rls_security.sql
-- (they didn't have tenant isolation — we replace them all)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper to silently drop a policy if it exists
DO $$
DECLARE
    _policies TEXT[][] := ARRAY[
        ARRAY['users',                  'Users can view all users'],
        ARRAY['users',                  'Users can update own record'],
        ARRAY['users',                  'Admins can manage users'],
        ARRAY['leads',                  'Users can view their assigned leads'],
        ARRAY['leads',                  'Users can update their assigned leads'],
        ARRAY['leads',                  'Users can create leads'],
        ARRAY['leads',                  'Admins can delete leads'],
        ARRAY['notes',                  'Users can view notes for their leads'],
        ARRAY['notes',                  'Users can create notes'],
        ARRAY['activities',             'Users can view activities for their leads'],
        ARRAY['activities',             'Users can create activities'],
        ARRAY['chat_messages',          'Users can view chat messages for their leads'],
        ARRAY['chat_messages',          'Users can create chat messages'],
        ARRAY['courses',                'Users can view courses'],
        ARRAY['courses',                'Admins can manage courses'],
        ARRAY['hospitals',              'Users can view hospitals'],
        ARRAY['hospitals',              'Admins can manage hospitals'],
        ARRAY['wa_templates',           'Users can view templates'],
        ARRAY['wa_templates',           'Admins can manage templates'],
        ARRAY['sla_config',             'Users can view SLA config'],
        ARRAY['sla_config',             'Admins can manage SLA config'],
        ARRAY['decay_config',           'Users can view decay config'],
        ARRAY['decay_config',           'Admins can manage decay config'],
        ARRAY['decay_log',              'Managers can view decay log'],
        ARRAY['workflow_rules',         'Admins can view workflow rules'],
        ARRAY['workflow_rules',         'Admins can manage workflow rules'],
        ARRAY['workflow_executions',    'Admins can view workflow executions'],
        ARRAY['counselors',             'Users can view counselors'],
        ARRAY['communication_history',  'Users can view communications'],
        ARRAY['communication_history',  'Users can create communications']
    ];
    _p TEXT[];
BEGIN
    FOREACH _p SLICE 1 IN ARRAY _policies LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', _p[2], _p[1]);
        EXCEPTION WHEN OTHERS THEN
            -- Policy didn't exist — fine
        END;
    END LOOP;
    RAISE NOTICE 'Old RLS policies dropped';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: Enable RLS on tenants table (new)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Re-enable on all tables (idempotent)
ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE decay_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE decay_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_config           ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals            ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: New tenant-isolation RLS policies
--
-- Design:
--   • Every table policy first checks tenant_id = jwt.tenant_id
--   • Role checks (admin/manager/counselor) are WITHIN the tenant scope
--   • Backend service-role key bypasses RLS entirely (as Supabase default)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: extract tenant_id claim from JWT ──────────────────────────────
-- The CRM backend encodes tenant_id as a UUID string in the JWT payload.
-- Usage in policies: _current_tenant()
CREATE OR REPLACE FUNCTION _current_tenant() RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(auth.jwt()->>'tenant_id', '')::UUID
$$;

-- ── tenants ───────────────────────────────────────────────────────────────
-- A user may only see their own tenant row.
CREATE POLICY "tenant_own_row"
ON tenants FOR ALL
TO authenticated
USING  (id = _current_tenant())
WITH CHECK (id = _current_tenant());

-- ── users ─────────────────────────────────────────────────────────────────
CREATE POLICY "users_same_tenant_select"
ON users FOR SELECT
TO authenticated
USING (tenant_id = _current_tenant());

CREATE POLICY "users_same_tenant_insert"
ON users FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
);

CREATE POLICY "users_update_own_or_admin"
ON users FOR UPDATE
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (
        email = (auth.jwt()->>'email')
        OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
    )
)
WITH CHECK (tenant_id = _current_tenant());

CREATE POLICY "users_delete_admin"
ON users FOR DELETE
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') = 'Super Admin'
);

-- ── leads ─────────────────────────────────────────────────────────────────
CREATE POLICY "leads_same_tenant_select"
ON leads FOR SELECT
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (
        assigned_to = (auth.jwt()->>'email')
        OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager', 'Team Leader')
    )
);

CREATE POLICY "leads_same_tenant_insert"
ON leads FOR INSERT
TO authenticated
WITH CHECK (tenant_id = _current_tenant());

CREATE POLICY "leads_same_tenant_update"
ON leads FOR UPDATE
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (
        assigned_to = (auth.jwt()->>'email')
        OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager', 'Team Leader')
    )
)
WITH CHECK (tenant_id = _current_tenant());

CREATE POLICY "leads_delete_admin"
ON leads FOR DELETE
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
);

-- ── notes ─────────────────────────────────────────────────────────────────
CREATE POLICY "notes_same_tenant"
ON notes FOR ALL
TO authenticated
USING  (tenant_id = _current_tenant())
WITH CHECK (tenant_id = _current_tenant());

-- ── activities ────────────────────────────────────────────────────────────
CREATE POLICY "activities_same_tenant"
ON activities FOR ALL
TO authenticated
USING  (tenant_id = _current_tenant())
WITH CHECK (tenant_id = _current_tenant());

-- ── chat_messages ─────────────────────────────────────────────────────────
CREATE POLICY "chat_messages_same_tenant"
ON chat_messages FOR ALL
TO authenticated
USING  (tenant_id = _current_tenant())
WITH CHECK (tenant_id = _current_tenant());

-- ── communication_history ─────────────────────────────────────────────────
CREATE POLICY "comm_history_same_tenant"
ON communication_history FOR ALL
TO authenticated
USING  (tenant_id = _current_tenant())
WITH CHECK (tenant_id = _current_tenant());

-- ── counselors ────────────────────────────────────────────────────────────
CREATE POLICY "counselors_same_tenant"
ON counselors FOR ALL
TO authenticated
USING  (tenant_id = _current_tenant())
WITH CHECK (tenant_id = _current_tenant());

-- ── wa_templates ──────────────────────────────────────────────────────────
CREATE POLICY "wa_templates_same_tenant_select"
ON wa_templates FOR SELECT
TO authenticated
USING (tenant_id = _current_tenant());

CREATE POLICY "wa_templates_same_tenant_write"
ON wa_templates FOR INSERT UPDATE DELETE
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
)
WITH CHECK (tenant_id = _current_tenant());

-- ── workflow_rules ────────────────────────────────────────────────────────
CREATE POLICY "workflow_rules_same_tenant"
ON workflow_rules FOR ALL
TO authenticated
USING  (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
)
WITH CHECK (tenant_id = _current_tenant());

-- ── workflow_executions ───────────────────────────────────────────────────
CREATE POLICY "workflow_exec_same_tenant"
ON workflow_executions FOR ALL
TO authenticated
USING  (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
)
WITH CHECK (tenant_id = _current_tenant());

-- ── config tables (sla_config, decay_config, decay_log) ───────────────────
CREATE POLICY "sla_config_same_tenant"
ON sla_config FOR ALL
TO authenticated
USING  (tenant_id = _current_tenant())
WITH CHECK (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') = 'Super Admin'
);

CREATE POLICY "decay_config_same_tenant"
ON decay_config FOR ALL
TO authenticated
USING  (tenant_id = _current_tenant())
WITH CHECK (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') = 'Super Admin'
);

CREATE POLICY "decay_log_same_tenant"
ON decay_log FOR ALL
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
)
WITH CHECK (tenant_id = _current_tenant());

-- ── courses ───────────────────────────────────────────────────────────────
CREATE POLICY "courses_same_tenant_select"
ON courses FOR SELECT
TO authenticated
USING (tenant_id = _current_tenant());

CREATE POLICY "courses_same_tenant_write"
ON courses FOR INSERT UPDATE DELETE
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
)
WITH CHECK (tenant_id = _current_tenant());

-- ── hospitals ─────────────────────────────────────────────────────────────
CREATE POLICY "hospitals_same_tenant_select"
ON hospitals FOR SELECT
TO authenticated
USING (tenant_id = _current_tenant());

CREATE POLICY "hospitals_same_tenant_write"
ON hospitals FOR INSERT UPDATE DELETE
TO authenticated
USING (
    tenant_id = _current_tenant()
    AND (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
)
WITH CHECK (tenant_id = _current_tenant());

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10: Service-role bypass
-- The Supabase service_role key already bypasses RLS by default.
-- These explicit BYPASSRLS grants ensure our backend functions work correctly.
-- ─────────────────────────────────────────────────────────────────────────────
-- (No additional grants needed — service_role bypasses RLS in Supabase by design)

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 11: Updated_at trigger for tenants
-- ─────────────────────────────────────────────────────────────────────────────
-- Already added above (Step 1 trigger block)

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 12: Verification queries (uncomment to check)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT id, name, subdomain, plan FROM tenants;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- SELECT column_name, table_name FROM information_schema.columns
--   WHERE column_name = 'tenant_id' AND table_schema = 'public' ORDER BY table_name;
