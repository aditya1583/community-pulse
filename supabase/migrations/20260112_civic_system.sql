-- Migration: Civic TL;DR System
-- Date: 2026-01-12
-- Purpose: Manual entry system for civic meetings with witty template-based announcements
--
-- Philosophy: Civic engagement shouldn't feel like homework.
-- School board and city council decisions affect everyone, but meeting agendas
-- are impenetrable. This system transforms dry civic data into "Morning Brew"
-- style digestible content that makes people actually want to engage.
--
-- This is NOT scraping - it's a manual data entry system for admins to input
-- meeting information, which then gets transformed into witty announcements.

-- ============================================================================
-- 1. CIVIC MEETINGS TABLE
-- Core meeting definitions, manually entered by admins
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geographic context
  city TEXT NOT NULL, -- 'Leander', 'Cedar Park', 'Austin'

  -- Entity information
  entity TEXT NOT NULL, -- 'LISD', 'City of Leander', 'City of Cedar Park'
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('school_district', 'city_council', 'committee', 'county', 'utility')
  ),

  -- Meeting type
  meeting_type TEXT NOT NULL CHECK (
    meeting_type IN ('board', 'council', 'special', 'workshop', 'hearing', 'budget')
  ),

  -- Meeting details
  title TEXT, -- Optional override title (e.g., "Budget Showdown 2026")
  meeting_date TIMESTAMPTZ NOT NULL,

  -- Topics array: [{title, summary, stakes: high/medium/low}]
  -- Example: [{"title": "Faubion Elementary Consolidation", "summary": "Vote on whether to close...", "stakes": "high"}]
  topics JSONB DEFAULT '[]'::jsonb,

  -- Links
  livestream_url TEXT,
  agenda_url TEXT,
  location TEXT, -- e.g., "LISD Admin Building, Room 101"

  -- Generated content
  pulse_id BIGINT REFERENCES pulses(id) ON DELETE SET NULL, -- Pre-meeting announcement
  summary_pulse_id BIGINT REFERENCES pulses(id) ON DELETE SET NULL, -- Post-meeting summary

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'cancelled')
  ),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CIVIC DECISIONS TABLE
-- Post-meeting outcomes for each topic
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to meeting
  meeting_id UUID NOT NULL REFERENCES civic_meetings(id) ON DELETE CASCADE,

  -- Topic this decision addresses
  topic_title TEXT NOT NULL,

  -- Outcome
  decision TEXT NOT NULL CHECK (
    decision IN ('approved', 'denied', 'tabled', 'amended', 'withdrawn', 'no_action')
  ),

  -- Vote count (if applicable)
  vote_for INTEGER,
  vote_against INTEGER,
  vote_abstain INTEGER,

  -- Summary of what happened
  summary TEXT,

  -- Notable moments (for "the drama" sections)
  notable_moment TEXT, -- e.g., "Trustee Martinez walked out during the vote"

  -- Impact description (for high-stakes decisions)
  impact_summary TEXT, -- e.g., "Property taxes will increase by 2.3%"

  -- Generated announcement
  pulse_id BIGINT REFERENCES pulses(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. CIVIC PREDICTIONS TABLE
-- Track predictions made about civic outcomes for XP awards
-- ============================================================================

CREATE TABLE IF NOT EXISTS civic_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  meeting_id UUID NOT NULL REFERENCES civic_meetings(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  pulse_id BIGINT REFERENCES pulses(id) ON DELETE SET NULL,

  -- Prediction options
  option_a TEXT NOT NULL, -- e.g., "Passes"
  option_b TEXT NOT NULL, -- e.g., "Gets Tabled"

  -- Resolution
  resolved_at TIMESTAMPTZ,
  winning_option TEXT CHECK (winning_option IN ('a', 'b')),
  decision_id UUID REFERENCES civic_decisions(id) ON DELETE SET NULL,

  -- XP reward (higher for civic predictions)
  xp_reward INTEGER DEFAULT 50,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- Find upcoming meetings efficiently (by status, date sorted)
CREATE INDEX IF NOT EXISTS idx_civic_meetings_upcoming
  ON civic_meetings(meeting_date)
  WHERE status = 'scheduled';

-- Find meetings by city
CREATE INDEX IF NOT EXISTS idx_civic_meetings_city
  ON civic_meetings(city, meeting_date DESC);

-- Find meetings by entity
CREATE INDEX IF NOT EXISTS idx_civic_meetings_entity
  ON civic_meetings(entity, meeting_date DESC);

-- Find decisions by meeting
CREATE INDEX IF NOT EXISTS idx_civic_decisions_meeting
  ON civic_decisions(meeting_id);

-- Find predictions by meeting
CREATE INDEX IF NOT EXISTS idx_civic_predictions_meeting
  ON civic_predictions(meeting_id);

-- Find unresolved predictions
CREATE INDEX IF NOT EXISTS idx_civic_predictions_unresolved
  ON civic_predictions(resolved_at)
  WHERE resolved_at IS NULL;

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Get upcoming civic meetings for a city
CREATE OR REPLACE FUNCTION get_upcoming_civic_meetings(
  p_city TEXT,
  p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE(
  id UUID,
  city TEXT,
  entity TEXT,
  entity_type TEXT,
  meeting_type TEXT,
  title TEXT,
  meeting_date TIMESTAMPTZ,
  topics JSONB,
  livestream_url TEXT,
  agenda_url TEXT,
  location TEXT,
  high_stakes_count INTEGER,
  pulse_id BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.city,
    m.entity,
    m.entity_type,
    m.meeting_type,
    m.title,
    m.meeting_date,
    m.topics,
    m.livestream_url,
    m.agenda_url,
    m.location,
    (
      SELECT COUNT(*)::INTEGER
      FROM jsonb_array_elements(m.topics) t
      WHERE t->>'stakes' = 'high'
    ) as high_stakes_count,
    m.pulse_id
  FROM civic_meetings m
  WHERE m.city = p_city
    AND m.status = 'scheduled'
    AND m.meeting_date > NOW()
    AND m.meeting_date < NOW() + (p_days_ahead || ' days')::INTERVAL
  ORDER BY m.meeting_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get today's civic meetings (for alert generation)
CREATE OR REPLACE FUNCTION get_todays_civic_meetings(p_city TEXT)
RETURNS TABLE(
  id UUID,
  city TEXT,
  entity TEXT,
  entity_type TEXT,
  meeting_type TEXT,
  title TEXT,
  meeting_date TIMESTAMPTZ,
  topics JSONB,
  livestream_url TEXT,
  agenda_url TEXT,
  location TEXT,
  high_stakes_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.city,
    m.entity,
    m.entity_type,
    m.meeting_type,
    m.title,
    m.meeting_date,
    m.topics,
    m.livestream_url,
    m.agenda_url,
    m.location,
    (
      SELECT COUNT(*)::INTEGER
      FROM jsonb_array_elements(m.topics) t
      WHERE t->>'stakes' = 'high'
    ) as high_stakes_count
  FROM civic_meetings m
  WHERE m.city = p_city
    AND m.status = 'scheduled'
    AND DATE(m.meeting_date AT TIME ZONE 'America/Chicago') = DATE(NOW() AT TIME ZONE 'America/Chicago')
  ORDER BY m.meeting_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get meeting with decisions (for summary generation)
CREATE OR REPLACE FUNCTION get_meeting_with_decisions(p_meeting_id UUID)
RETURNS TABLE(
  meeting_id UUID,
  city TEXT,
  entity TEXT,
  entity_type TEXT,
  meeting_type TEXT,
  title TEXT,
  meeting_date TIMESTAMPTZ,
  topics JSONB,
  decisions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as meeting_id,
    m.city,
    m.entity,
    m.entity_type,
    m.meeting_type,
    m.title,
    m.meeting_date,
    m.topics,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'topic_title', d.topic_title,
            'decision', d.decision,
            'vote_for', d.vote_for,
            'vote_against', d.vote_against,
            'vote_abstain', d.vote_abstain,
            'summary', d.summary,
            'notable_moment', d.notable_moment,
            'impact_summary', d.impact_summary
          )
        )
        FROM civic_decisions d
        WHERE d.meeting_id = m.id
      ),
      '[]'::jsonb
    ) as decisions
  FROM civic_meetings m
  WHERE m.id = p_meeting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Civic meetings: Public read, service role write
ALTER TABLE civic_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read civic meetings" ON civic_meetings;
CREATE POLICY "Public can read civic meetings" ON civic_meetings
  FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Service role can manage civic meetings" ON civic_meetings;
CREATE POLICY "Service role can manage civic meetings" ON civic_meetings
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Civic decisions: Public read, service role write
ALTER TABLE civic_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read civic decisions" ON civic_decisions;
CREATE POLICY "Public can read civic decisions" ON civic_decisions
  FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Service role can manage civic decisions" ON civic_decisions;
CREATE POLICY "Service role can manage civic decisions" ON civic_decisions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Civic predictions: Public read, service role write
ALTER TABLE civic_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read civic predictions" ON civic_predictions;
CREATE POLICY "Public can read civic predictions" ON civic_predictions
  FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Service role can manage civic predictions" ON civic_predictions;
CREATE POLICY "Service role can manage civic predictions" ON civic_predictions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT ON TABLE civic_meetings TO anon, authenticated;
GRANT SELECT ON TABLE civic_decisions TO anon, authenticated;
GRANT SELECT ON TABLE civic_predictions TO anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE civic_meetings TO service_role;
GRANT ALL PRIVILEGES ON TABLE civic_decisions TO service_role;
GRANT ALL PRIVILEGES ON TABLE civic_predictions TO service_role;

GRANT EXECUTE ON FUNCTION get_upcoming_civic_meetings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_todays_civic_meetings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_meeting_with_decisions TO anon, authenticated;

-- ============================================================================
-- 8. CIVIC-SPECIFIC BADGES
-- ============================================================================

INSERT INTO badge_definitions (id, name, description, icon, category, required_pulse_count, display_order, special_condition)
VALUES
  ('civic_oracle_1', 'Civic Watcher', 'Made your first civic prediction', '🏛️', 'achievement', 0, 120, '{"civic_predictions": 1}'),
  ('civic_oracle_5', 'Council Whisperer', 'Correctly predicted 5 civic outcomes', '🔮', 'achievement', 0, 121, '{"correct_civic_predictions": 5}'),
  ('civic_oracle_10', 'Political Prophet', 'Correctly predicted 10 civic outcomes', '👁️', 'achievement', 0, 122, '{"correct_civic_predictions": 10}'),
  ('civic_engaged', 'Civically Engaged', 'Engaged with civic content 10 times', '🗳️', 'achievement', 0, 123, '{"civic_engagement": 10}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. ADD CIVIC STATS TO USER_STATS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'civic_predictions_made'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN civic_predictions_made INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'civic_predictions_correct'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN civic_predictions_correct INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'civic_xp_earned'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN civic_xp_earned INTEGER DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN user_stats.civic_predictions_made IS 'Total civic predictions made';
COMMENT ON COLUMN user_stats.civic_predictions_correct IS 'Correct civic predictions (for oracle badges)';
COMMENT ON COLUMN user_stats.civic_xp_earned IS 'XP earned from civic predictions';

-- ============================================================================
-- 10. ENABLE REALTIME
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'civic_meetings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.civic_meetings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'civic_decisions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.civic_decisions;
  END IF;
END $$;

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE civic_meetings IS 'Manually entered civic meetings (school board, city council) for TL;DR style announcements';
COMMENT ON TABLE civic_decisions IS 'Post-meeting outcomes and votes for each topic discussed';
COMMENT ON TABLE civic_predictions IS 'User predictions about civic outcomes with XP rewards for correct predictions';

COMMENT ON FUNCTION get_upcoming_civic_meetings IS 'Returns upcoming civic meetings for a city within specified days';
COMMENT ON FUNCTION get_todays_civic_meetings IS 'Returns civic meetings happening today for pre-meeting alerts';
COMMENT ON FUNCTION get_meeting_with_decisions IS 'Returns a meeting with all its decisions for summary generation';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
