-- Migration: Poll Voting System for This-or-That Polls
-- Date: 2025-01-07
-- Purpose: Add poll voting support to pulses

-- ============================================================================
-- 1. ADD POLL_OPTIONS COLUMN TO PULSES TABLE
-- ============================================================================

-- Add poll_options column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'poll_options'
  ) THEN
    ALTER TABLE pulses ADD COLUMN poll_options JSONB DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN pulses.poll_options IS 'Array of poll options for voting posts (e.g., ["🤠 Whataburger", "🍔 In-N-Out"])';

-- ============================================================================
-- 2. CREATE POLL_VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  option_index INTEGER NOT NULL CHECK (option_index >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One vote per user per poll
  UNIQUE(pulse_id, user_identifier)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_poll_votes_pulse_id ON poll_votes(pulse_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_identifier);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(pulse_id, option_index);

-- ============================================================================
-- 3. RLS POLICIES FOR POLL_VOTES
-- ============================================================================

-- Enable RLS
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read votes (counts are public)
DROP POLICY IF EXISTS "Public can read poll votes" ON poll_votes;
CREATE POLICY "Public can read poll votes" ON poll_votes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anyone can insert votes (toggle on)
DROP POLICY IF EXISTS "Anyone can insert poll votes" ON poll_votes;
CREATE POLICY "Anyone can insert poll votes" ON poll_votes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can update their own votes (change vote)
DROP POLICY IF EXISTS "Users can update own poll votes" ON poll_votes;
CREATE POLICY "Users can update own poll votes" ON poll_votes
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Users can delete their own votes
DROP POLICY IF EXISTS "Users can delete own poll votes" ON poll_votes;
CREATE POLICY "Users can delete own poll votes" ON poll_votes
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- 4. HELPER FUNCTION: GET POLL VOTE COUNTS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_poll_vote_counts(p_pulse_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_object_agg(option_index::text, vote_count),
    '{}'::jsonb
  ) INTO result
  FROM (
    SELECT option_index, COUNT(*) as vote_count
    FROM poll_votes
    WHERE pulse_id = p_pulse_id
    GROUP BY option_index
  ) counts;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

-- Public reads for counts
GRANT SELECT ON TABLE public.poll_votes TO anon, authenticated;

-- Anyone can vote
GRANT INSERT, UPDATE, DELETE ON TABLE public.poll_votes TO anon, authenticated;

-- Server-side routes may use service role
GRANT ALL PRIVILEGES ON TABLE public.poll_votes TO service_role;

-- ============================================================================
-- 6. ENABLE REALTIME FOR POLL_VOTES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
  END IF;
END $$;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE poll_votes IS 'Stores user votes on poll posts. Each user can only vote once per poll.';
COMMENT ON COLUMN poll_votes.user_identifier IS 'The user anonymous username (e.g., "Curious Capybara 67") used to track votes.';
COMMENT ON COLUMN poll_votes.option_index IS 'Index of the option voted for (0 = first option, 1 = second option).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
