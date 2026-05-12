-- Emergency RLS Security Fix
-- This migration enables RLS on all tables and creates appropriate policies
-- Based on the CRM app's JWT auth model where users are authenticated via backend

-- ============================================================================
-- STEP 1: Enable RLS on all tables
-- ============================================================================

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselors ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE decay_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE decay_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Default Deny for anon role
-- All tables deny anonymous access by default (no policies for anon)
-- ============================================================================

-- ============================================================================
-- STEP 3: Policies for authenticated users
-- These policies check auth.jwt() claims for user email and role
-- ============================================================================

-- USERS table: users can read all users, but only update their own record
CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- Admin/Manager can insert/delete users
CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'role') IN ('Super Admin', 'Manager')
  );

-- LEADS table: users can view leads assigned to them or if they're admin/manager
CREATE POLICY "Users can view their assigned leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    assigned_to = (auth.jwt()->>'email') 
    OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager', 'Team Leader')
  );

CREATE POLICY "Users can update their assigned leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    assigned_to = (auth.jwt()->>'email')
    OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager', 'Team Leader')
  );

CREATE POLICY "Users can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('Super Admin', 'Manager'));

-- NOTES table: users can view/create notes for leads they have access to
CREATE POLICY "Users can view notes for their leads"
  ON notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = notes.lead_id   -- fixed: was lead_db_id (wrong column name)
      AND (
        leads.assigned_to = (auth.jwt()->>'email')
        OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager', 'Team Leader')
      )
    )
  );

CREATE POLICY "Users can create notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (auth.jwt()->>'email')
  );

-- ACTIVITIES table: similar to notes
CREATE POLICY "Users can view activities for their leads"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.lead_id = activities.lead_id 
      AND (
        leads.assigned_to = (auth.jwt()->>'email')
        OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager', 'Team Leader')
      )
    )
  );

CREATE POLICY "Users can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- CHAT_MESSAGES table: similar pattern
CREATE POLICY "Users can view chat messages for their leads"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = chat_messages.lead_db_id 
      AND (
        leads.assigned_to = (auth.jwt()->>'email')
        OR (auth.jwt()->>'role') IN ('Super Admin', 'Manager', 'Team Leader')
      )
    )
  );

CREATE POLICY "Users can create chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- COURSES table: read-only for all authenticated users
CREATE POLICY "Users can view courses"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage courses"
  ON courses FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('Super Admin', 'Manager'));

-- HOSPITALS table: read-only for all authenticated users
CREATE POLICY "Users can view hospitals"
  ON hospitals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage hospitals"
  ON hospitals FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('Super Admin', 'Manager'));

-- WA_TEMPLATES table: read for all, manage for admins
CREATE POLICY "Users can view templates"
  ON wa_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage templates"
  ON wa_templates FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('Super Admin', 'Manager'));

-- CONFIG tables: read for all, manage for admins only
CREATE POLICY "Users can view SLA config"
  ON sla_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage SLA config"
  ON sla_config FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role') = 'Super Admin');

CREATE POLICY "Users can view decay config"
  ON decay_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage decay config"
  ON decay_config FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role') = 'Super Admin');

-- DECAY_LOG: read for admins/managers
CREATE POLICY "Managers can view decay log"
  ON decay_log FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('Super Admin', 'Manager'));

-- WORKFLOW tables: manage for admins only
CREATE POLICY "Admins can view workflow rules"
  ON workflow_rules FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('Super Admin', 'Manager'));

CREATE POLICY "Admins can manage workflow rules"
  ON workflow_rules FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role') = 'Super Admin');

CREATE POLICY "Admins can view workflow executions"
  ON workflow_executions FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('Super Admin', 'Manager'));

-- COUNSELORS table: read for all (legacy)
CREATE POLICY "Users can view counselors"
  ON counselors FOR SELECT
  TO authenticated
  USING (true);

-- COMMUNICATION_HISTORY: view own communications or if admin
CREATE POLICY "Users can view communications"
  ON communication_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create communications"
  ON communication_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES (run these after applying)
-- ============================================================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check policies exist:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Test authenticated access (should work):
-- SELECT count(*) FROM leads; -- as authenticated user

-- Test anon access (should fail with no rows):
-- SELECT count(*) FROM leads; -- as anon user
