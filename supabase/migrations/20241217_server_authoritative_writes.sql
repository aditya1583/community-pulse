-- Migration: Server-Authoritative Writes for Pulses
-- Date: 2024-12-17
-- Purpose: Deny all direct user writes to pulses table, require server API
--
-- SECURITY RATIONALE:
-- - All pulse creation MUST go through /api/pulses endpoint
-- - Server validates auth, runs PII detection, content moderation
-- - Server uses SERVICE ROLE key to insert (bypasses RLS)
-- - Direct client inserts are denied by RLS
-- - This prevents bypassing guardrails via direct Supabase client
--
-- REQUIRED ENV VAR:
-- - SUPABASE_SERVICE_ROLE_KEY: Must be set in server environment
--
-- VALIDATION INSTRUCTIONS:
-- After applying this migration, verify:
-- 1. anon INSERT fails: Using anon key, try to insert - should get RLS error
-- 2. authenticated INSERT fails: Using user JWT, try to insert - should get RLS error
-- 3. service role INSERT succeeds: Using service role key, insert works
-- 4. SELECT still works: All users can still read pulses

-- ============================================================================
-- 1. ENABLE RLS ON PULSES (if not already enabled)
-- ============================================================================
ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DROP EXISTING WRITE POLICIES
-- These will be replaced with deny-all policies
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can insert pulses" ON pulses;
DROP POLICY IF EXISTS "Users can insert pulses" ON pulses;
DROP POLICY IF EXISTS "Anyone can insert pulses" ON pulses;

-- ============================================================================
-- 3. ENSURE PUBLIC READ POLICY EXISTS
-- Anyone (anon + authenticated) can read pulses
-- ============================================================================
DROP POLICY IF EXISTS "Public can read all pulses" ON pulses;
CREATE POLICY "Public can read all pulses" ON pulses
  FOR SELECT
  USING (true);

-- ============================================================================
-- 4. DENY ALL USER INSERT/UPDATE
-- No policy = no access for these operations
-- Only service role (which bypasses RLS) can insert
-- ============================================================================

-- Note: By NOT creating an INSERT policy for anon/authenticated roles,
-- those roles cannot insert. Only service_role can insert because
-- service_role bypasses RLS entirely.

-- For extra safety, we create explicit deny policies (always false)
-- This makes the intent clear and prevents accidental policy additions

-- Explicitly deny INSERT for anon role
DROP POLICY IF EXISTS "Deny anon insert" ON pulses;
CREATE POLICY "Deny anon insert" ON pulses
  FOR INSERT
  TO anon
  WITH CHECK (false);

-- Explicitly deny INSERT for authenticated role
DROP POLICY IF EXISTS "Deny authenticated insert" ON pulses;
CREATE POLICY "Deny authenticated insert" ON pulses
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Explicitly deny UPDATE for anon role
DROP POLICY IF EXISTS "Deny anon update" ON pulses;
CREATE POLICY "Deny anon update" ON pulses
  FOR UPDATE
  TO anon
  USING (false)
  WITH CHECK (false);

-- Explicitly deny UPDATE for authenticated role
DROP POLICY IF EXISTS "Deny authenticated update" ON pulses;
CREATE POLICY "Deny authenticated update" ON pulses
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- 5. OWNER-ONLY DELETE (unchanged from before)
-- Users can only delete their own pulses
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete own pulses" ON pulses;
CREATE POLICY "Users can delete own pulses" ON pulses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. PERFORMANCE INDEX: city + created_at
-- Optimizes feed queries that filter by city and sort by date
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pulses_city_created_at
  ON pulses (city, created_at DESC);

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE pulses IS 'User-submitted community updates. Writes only via /api/pulses (service role). RLS denies direct user inserts.';

COMMENT ON POLICY "Deny anon insert" ON pulses IS 'SECURITY: Blocks direct inserts from anonymous users. All writes must go through /api/pulses.';
COMMENT ON POLICY "Deny authenticated insert" ON pulses IS 'SECURITY: Blocks direct inserts from authenticated users. All writes must go through /api/pulses.';
COMMENT ON POLICY "Deny anon update" ON pulses IS 'SECURITY: Pulses cannot be updated after creation.';
COMMENT ON POLICY "Deny authenticated update" ON pulses IS 'SECURITY: Pulses cannot be updated after creation.';
COMMENT ON POLICY "Users can delete own pulses" ON pulses IS 'Users can delete only their own pulses.';
COMMENT ON POLICY "Public can read all pulses" ON pulses IS 'All pulses are publicly readable.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

/*
 * VALIDATION QUERIES (run manually to verify):
 *
 * -- 1. As anon user, try to insert (should fail):
 * INSERT INTO pulses (city, mood, tag, message, author)
 * VALUES ('Test', ':', 'General', 'test', 'test');
 * -- Expected: ERROR: new row violates row-level security policy
 *
 * -- 2. As authenticated user, try to insert (should fail):
 * -- (Use Supabase client with user JWT)
 * -- Expected: ERROR: new row violates row-level security policy
 *
 * -- 3. Check policies are in place:
 * SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
 * FROM pg_policies
 * WHERE tablename = 'pulses';
 *
 * -- 4. Verify index exists:
 * SELECT indexname, indexdef
 * FROM pg_indexes
 * WHERE tablename = 'pulses';
 */
