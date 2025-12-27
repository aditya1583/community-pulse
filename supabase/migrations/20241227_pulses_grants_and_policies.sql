-- Migration: Fix Pulses GRANTs + RLS policies
-- Date: 2024-12-27
-- Purpose:
--   - Ensure anon/authenticated/service_role have correct table privileges
--   - Ensure RLS is enabled and policies match the app's server-authoritative design

-- ============================================================================
-- 1) PRIVILEGES (GRANTS)
-- ============================================================================

-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Pulses: public read, authenticated delete/update privileges (RLS still governs), service role full
GRANT SELECT ON TABLE public.pulses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.pulses TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.pulses TO service_role;

-- Identity/serial sequences (needed for inserts by roles that can insert)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- 2) RLS: pulses table
-- ============================================================================

ALTER TABLE public.pulses ENABLE ROW LEVEL SECURITY;

-- Public feed read
DROP POLICY IF EXISTS "Public can read all pulses" ON public.pulses;
CREATE POLICY "Public can read all pulses" ON public.pulses
  FOR SELECT
  USING (true);

-- Server-authoritative design: deny direct client inserts/updates
DROP POLICY IF EXISTS "Deny anon insert" ON public.pulses;
CREATE POLICY "Deny anon insert" ON public.pulses
  FOR INSERT
  TO anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny authenticated insert" ON public.pulses;
CREATE POLICY "Deny authenticated insert" ON public.pulses
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anon update" ON public.pulses;
CREATE POLICY "Deny anon update" ON public.pulses
  FOR UPDATE
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny authenticated update" ON public.pulses;
CREATE POLICY "Deny authenticated update" ON public.pulses
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Owner-only delete (least privilege)
DROP POLICY IF EXISTS "Users can delete own pulses" ON public.pulses;
CREATE POLICY "Users can delete own pulses" ON public.pulses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

