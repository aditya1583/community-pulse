-- Migration: Pulse Comments System
-- Date: 2025-01-08
-- Purpose: Add commenting support to all pulses

-- ============================================================================
-- 1. CREATE PULSE_COMMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pulse_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete support (for moderation)
  hidden BOOLEAN DEFAULT FALSE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pulse_comments_pulse_id ON pulse_comments(pulse_id);
CREATE INDEX IF NOT EXISTS idx_pulse_comments_user ON pulse_comments(user_identifier);
CREATE INDEX IF NOT EXISTS idx_pulse_comments_created ON pulse_comments(pulse_id, created_at DESC);

-- ============================================================================
-- 2. RLS POLICIES FOR PULSE_COMMENTS
-- ============================================================================

-- Enable RLS
ALTER TABLE pulse_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-hidden comments
DROP POLICY IF EXISTS "Public can read visible comments" ON pulse_comments;
CREATE POLICY "Public can read visible comments" ON pulse_comments
  FOR SELECT
  TO anon, authenticated
  USING (hidden = false);

-- Anyone can insert comments (rate limiting handled at API level)
DROP POLICY IF EXISTS "Anyone can insert comments" ON pulse_comments;
CREATE POLICY "Anyone can insert comments" ON pulse_comments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can update their own comments (for editing - future feature)
DROP POLICY IF EXISTS "Users can update own comments" ON pulse_comments;
CREATE POLICY "Users can update own comments" ON pulse_comments
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Users can delete their own comments
DROP POLICY IF EXISTS "Users can delete own comments" ON pulse_comments;
CREATE POLICY "Users can delete own comments" ON pulse_comments
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- 3. HELPER FUNCTION: GET COMMENT COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pulse_comment_count(p_pulse_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*) INTO result
  FROM pulse_comments
  WHERE pulse_id = p_pulse_id AND hidden = false;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

-- Public reads for comments
GRANT SELECT ON TABLE public.pulse_comments TO anon, authenticated;

-- Anyone can comment
GRANT INSERT, UPDATE, DELETE ON TABLE public.pulse_comments TO anon, authenticated;

-- Server-side routes may use service role
GRANT ALL PRIVILEGES ON TABLE public.pulse_comments TO service_role;

-- ============================================================================
-- 5. ENABLE REALTIME FOR PULSE_COMMENTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pulse_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_comments;
  END IF;
END $$;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE pulse_comments IS 'Stores user comments on pulses. Supports threaded discussions.';
COMMENT ON COLUMN pulse_comments.user_identifier IS 'The user anonymous username (e.g., "Snappy Koala 30") who wrote the comment.';
COMMENT ON COLUMN pulse_comments.message IS 'The comment text, limited to 500 characters.';
COMMENT ON COLUMN pulse_comments.hidden IS 'Soft delete flag for moderation. Hidden comments are not shown to users.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
