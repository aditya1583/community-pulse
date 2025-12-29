-- Migration: Pulse Reactions System
-- Date: 2024-12-26
-- Purpose: Add reaction system to pulses (fire, eyes, check)

-- ============================================================================
-- 1. CREATE PULSE_REACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pulse_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('fire', 'eyes', 'check')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate reactions of same type from same user on same pulse
  UNIQUE(pulse_id, user_identifier, reaction_type)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pulse_reactions_pulse_id ON pulse_reactions(pulse_id);
CREATE INDEX IF NOT EXISTS idx_pulse_reactions_user ON pulse_reactions(user_identifier);
CREATE INDEX IF NOT EXISTS idx_pulse_reactions_type ON pulse_reactions(reaction_type);

-- ============================================================================
-- 2. RLS POLICIES FOR PULSE_REACTIONS
-- ============================================================================

-- Enable RLS
ALTER TABLE pulse_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions (counts are public)
DROP POLICY IF EXISTS "Public can read reactions" ON pulse_reactions;
CREATE POLICY "Public can read reactions" ON pulse_reactions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only authenticated users can insert reactions (toggle on)
DROP POLICY IF EXISTS "Anyone can insert reactions" ON pulse_reactions;
CREATE POLICY "Anyone can insert reactions" ON pulse_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only authenticated users can delete reactions (toggle off)
-- Note: Ownership is tracked by user_identifier (not auth.uid), so RLS cannot
-- securely enforce per-user deletes without schema changes.
DROP POLICY IF EXISTS "Users can delete own reactions" ON pulse_reactions;
CREATE POLICY "Users can delete own reactions" ON pulse_reactions
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 3. HELPER FUNCTION: GET REACTION COUNTS FOR A PULSE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pulse_reaction_counts(p_pulse_id BIGINT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'fire', COALESCE(SUM(CASE WHEN reaction_type = 'fire' THEN 1 ELSE 0 END), 0),
    'eyes', COALESCE(SUM(CASE WHEN reaction_type = 'eyes' THEN 1 ELSE 0 END), 0),
    'check', COALESCE(SUM(CASE WHEN reaction_type = 'check' THEN 1 ELSE 0 END), 0)
  ) INTO result
  FROM pulse_reactions
  WHERE pulse_id = p_pulse_id;

  RETURN COALESCE(result, '{"fire": 0, "eyes": 0, "check": 0}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3.5 GRANTS
-- ============================================================================

-- Public reads for counts
GRANT SELECT ON TABLE public.pulse_reactions TO anon, authenticated;

-- Signed-in users can react
GRANT INSERT, DELETE ON TABLE public.pulse_reactions TO authenticated;

-- Server-side routes may use service role
GRANT ALL PRIVILEGES ON TABLE public.pulse_reactions TO service_role;

-- Allow reading sequences/identity columns as needed
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE pulse_reactions IS 'Stores user reactions to pulses. Each user can have one of each reaction type per pulse.';
COMMENT ON COLUMN pulse_reactions.user_identifier IS 'The user anonymous username (e.g., "Curious Capybara 67") used to track reactions.';
COMMENT ON COLUMN pulse_reactions.reaction_type IS 'Type of reaction: fire (hot/trending), eyes (interesting), check (verified/accurate).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
