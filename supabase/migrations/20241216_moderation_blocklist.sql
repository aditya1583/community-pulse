-- Migration: Dynamic Moderation Blocklist
-- Date: 2024-12-16
-- Purpose: Create moderation_blocklist table for server-side dynamic content filtering

-- ============================================================================
-- 1. CREATE MODERATION BLOCKLIST TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS moderation_blocklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phrase TEXT NOT NULL,
  language TEXT,
  severity TEXT NOT NULL DEFAULT 'block' CHECK (severity IN ('block', 'warn')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Create index on phrase for fast lookups
CREATE INDEX IF NOT EXISTS idx_moderation_blocklist_phrase
  ON moderation_blocklist (phrase);

-- Create index on severity for filtering
CREATE INDEX IF NOT EXISTS idx_moderation_blocklist_severity
  ON moderation_blocklist (severity);

-- ============================================================================
-- 2. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE moderation_blocklist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Service role can manage blocklist" ON moderation_blocklist;
DROP POLICY IF EXISTS "Authenticated can read blocklist" ON moderation_blocklist;

-- Only service role can insert/update/delete (admin operations)
-- This prevents any user from modifying the blocklist directly
CREATE POLICY "Service role can manage blocklist" ON moderation_blocklist
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Allow authenticated users to read blocklist (for caching purposes)
-- The API routes will read this to check content
CREATE POLICY "Authenticated can read blocklist" ON moderation_blocklist
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- ============================================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_moderation_blocklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_moderation_blocklist_updated_at_trigger
  ON moderation_blocklist;

-- Create the trigger
CREATE TRIGGER update_moderation_blocklist_updated_at_trigger
  BEFORE UPDATE ON moderation_blocklist
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_blocklist_updated_at();

-- ============================================================================
-- 4. SEED DATA (optional - common bypass terms)
-- These can be removed or modified based on your community's needs
-- ============================================================================

-- Note: Uncomment and customize the following if you want initial seed data
-- INSERT INTO moderation_blocklist (phrase, severity, notes) VALUES
--   ('example_term', 'block', 'Seed data - remove or customize')
-- ON CONFLICT DO NOTHING;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
