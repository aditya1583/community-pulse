-- Migration: Check-in Challenges System
-- Date: 2026-01-12
-- Purpose: GPS-verified location check-ins for XP rewards
--
-- Philosophy: Exploration creates connection. When users physically visit
-- landmarks in their community, they become invested in the place.
-- Challenges transform passive app users into active community explorers.

-- ============================================================================
-- 1. CHALLENGE TRAILS TABLE (created FIRST for foreign key reference)
-- e.g., "Taco Trail: Visit 5 taco spots for 200 XP bonus"
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenge_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trail metadata
  title TEXT NOT NULL, -- e.g., "Leander Taco Trail"
  description TEXT NOT NULL,

  -- Completion bonus (in addition to individual challenge XP)
  completion_bonus_xp INTEGER DEFAULT 100,

  -- Requirements
  required_stops INTEGER NOT NULL, -- Number of stops to complete trail

  -- City context
  city TEXT NOT NULL,

  -- Status and scheduling
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CHALLENGES TABLE
-- Core challenge definitions, linked to announcement pulses
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to announcement pulse (optional)
  pulse_id BIGINT REFERENCES pulses(id) ON DELETE SET NULL,

  -- Challenge metadata
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Target location for GPS verification
  target_lat DOUBLE PRECISION NOT NULL,
  target_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER DEFAULT 150,

  -- Location display info
  location_name TEXT NOT NULL,
  location_address TEXT,

  -- Rewards and limits
  xp_reward INTEGER NOT NULL CHECK (xp_reward >= 10 AND xp_reward <= 200),
  max_claims INTEGER DEFAULT NULL,
  claims_count INTEGER DEFAULT 0,

  -- Scheduling
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Challenge type
  challenge_type TEXT NOT NULL DEFAULT 'checkin' CHECK (
    challenge_type IN ('checkin', 'photo', 'trail')
  ),

  -- For trail challenges
  trail_id UUID REFERENCES challenge_trails(id) ON DELETE SET NULL,
  trail_order INTEGER,

  -- City context
  city TEXT NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_challenges_city_active
  ON challenges(city, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_challenges_expires
  ON challenges(expires_at)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_challenges_trail
  ON challenges(trail_id, trail_order);

CREATE INDEX IF NOT EXISTS idx_challenges_pulse
  ON challenges(pulse_id);

CREATE INDEX IF NOT EXISTS idx_trails_city_active
  ON challenge_trails(city, is_active)
  WHERE is_active = TRUE;

-- ============================================================================
-- 3. CHALLENGE CLAIMS TABLE
-- Tracks who has claimed each challenge
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenge_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Verification data
  verification_lat DOUBLE PRECISION NOT NULL,
  verification_lng DOUBLE PRECISION NOT NULL,
  verification_distance_meters DOUBLE PRECISION NOT NULL, -- Actual distance from target

  -- For photo challenges, link to the pulse they posted
  photo_pulse_id BIGINT REFERENCES pulses(id) ON DELETE SET NULL,

  -- XP awarded
  xp_awarded INTEGER NOT NULL,

  -- Timestamps
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);

-- One claim per user per challenge
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_claims_unique
  ON challenge_claims(challenge_id, user_identifier);

CREATE INDEX IF NOT EXISTS idx_challenge_claims_user
  ON challenge_claims(user_identifier);

CREATE INDEX IF NOT EXISTS idx_challenge_claims_user_id
  ON challenge_claims(user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_claims_challenge
  ON challenge_claims(challenge_id);

-- ============================================================================
-- 4. TRAIL PROGRESS TABLE
-- Tracks user progress on multi-stop trails
-- ============================================================================

CREATE TABLE IF NOT EXISTS trail_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  trail_id UUID NOT NULL REFERENCES challenge_trails(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Progress tracking
  stops_completed INTEGER DEFAULT 0,
  completed_challenge_ids UUID[] DEFAULT '{}',

  -- Completion
  is_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  bonus_xp_awarded INTEGER, -- NULL until complete

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trail_progress_unique
  ON trail_progress(trail_id, user_identifier);

CREATE INDEX IF NOT EXISTS idx_trail_progress_user
  ON trail_progress(user_identifier);

-- ============================================================================
-- 5. ADD CHALLENGE STATS TO USER_STATS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'challenges_completed'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN challenges_completed INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'trails_completed'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN trails_completed INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'challenge_xp_earned'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN challenge_xp_earned INTEGER DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN user_stats.challenges_completed IS 'Total number of challenges completed';
COMMENT ON COLUMN user_stats.trails_completed IS 'Total number of multi-stop trails completed';
COMMENT ON COLUMN user_stats.challenge_xp_earned IS 'Total XP earned from challenges';

-- ============================================================================
-- 6. EXPLORER BADGE DEFINITIONS
-- ============================================================================

INSERT INTO badge_definitions (id, name, description, icon, category, required_pulse_count, display_order, special_condition)
VALUES
  ('explorer_1', 'First Steps', 'Completed your first check-in challenge', '🧭', 'achievement', 0, 110, '{"challenges_completed": 1}'),
  ('explorer_5', 'Explorer', 'Completed 5 check-in challenges', '🗺️', 'achievement', 0, 111, '{"challenges_completed": 5}'),
  ('explorer_15', 'Adventurer', 'Completed 15 check-in challenges', '🏔️', 'achievement', 0, 112, '{"challenges_completed": 15}'),
  ('explorer_30', 'Trailblazer', 'Completed 30 check-in challenges', '🌟', 'achievement', 0, 113, '{"challenges_completed": 30}'),
  ('trail_master_1', 'Trail Starter', 'Completed your first trail challenge', '🥾', 'achievement', 0, 114, '{"trails_completed": 1}'),
  ('trail_master_3', 'Trail Master', 'Completed 3 trail challenges', '🏆', 'achievement', 0, 115, '{"trails_completed": 3}'),
  ('local_legend', 'Local Legend', 'Explored 10 unique locations in your city', '👑', 'achievement', 0, 116, '{"unique_locations": 10}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. FUNCTION: CLAIM A CHALLENGE
-- Verifies GPS, awards XP, updates stats
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_challenge(
  p_challenge_id UUID,
  p_user_identifier TEXT,
  p_user_id UUID,
  p_verification_lat DOUBLE PRECISION,
  p_verification_lng DOUBLE PRECISION
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  xp_awarded INTEGER,
  new_total_xp INTEGER,
  badge_earned TEXT
) AS $$
DECLARE
  v_challenge RECORD;
  v_distance_meters DOUBLE PRECISION;
  v_already_claimed BOOLEAN;
  v_xp INTEGER;
  v_trail_complete BOOLEAN := FALSE;
  v_badge TEXT := NULL;
  v_new_xp INTEGER;
BEGIN
  -- Get challenge details
  SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;

  IF NOT FOUND THEN
    success := FALSE; message := 'Challenge not found'; xp_awarded := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- Check if challenge is active and not expired
  IF NOT v_challenge.is_active OR v_challenge.expires_at < NOW() THEN
    success := FALSE; message := 'Challenge has expired'; xp_awarded := 0;
    RETURN NEXT; RETURN;
  END IF;

  IF v_challenge.starts_at > NOW() THEN
    success := FALSE; message := 'Challenge has not started yet'; xp_awarded := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- Check if user already claimed
  SELECT EXISTS(
    SELECT 1 FROM challenge_claims
    WHERE challenge_id = p_challenge_id AND user_identifier = p_user_identifier
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    success := FALSE; message := 'You have already claimed this challenge'; xp_awarded := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- Check if max claims reached
  IF v_challenge.max_claims IS NOT NULL AND v_challenge.claims_count >= v_challenge.max_claims THEN
    success := FALSE; message := 'All spots for this challenge have been claimed'; xp_awarded := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- Calculate distance from target (Haversine formula in meters)
  v_distance_meters := 6371000 * 2 * ASIN(SQRT(
    SIN(RADIANS(p_verification_lat - v_challenge.target_lat) / 2) ^ 2 +
    COS(RADIANS(v_challenge.target_lat)) * COS(RADIANS(p_verification_lat)) *
    SIN(RADIANS(p_verification_lng - v_challenge.target_lng) / 2) ^ 2
  ));

  -- Verify user is within radius
  IF v_distance_meters > v_challenge.radius_meters THEN
    success := FALSE;
    message := format('You are %.0f meters away. Get within %s meters to claim.',
      v_distance_meters, v_challenge.radius_meters);
    xp_awarded := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- All checks passed! Create the claim
  v_xp := v_challenge.xp_reward;

  INSERT INTO challenge_claims (
    challenge_id, user_identifier, user_id,
    verification_lat, verification_lng, verification_distance_meters,
    xp_awarded
  ) VALUES (
    p_challenge_id, p_user_identifier, p_user_id,
    p_verification_lat, p_verification_lng, v_distance_meters,
    v_xp
  );

  -- Increment claims count
  UPDATE challenges SET
    claims_count = claims_count + 1,
    updated_at = NOW()
  WHERE id = p_challenge_id;

  -- Update user stats (upsert)
  INSERT INTO user_stats (user_id, challenges_completed, challenge_xp_earned, xp_total)
  VALUES (p_user_id, 1, v_xp, v_xp)
  ON CONFLICT (user_id) DO UPDATE SET
    challenges_completed = user_stats.challenges_completed + 1,
    challenge_xp_earned = user_stats.challenge_xp_earned + v_xp,
    xp_total = user_stats.xp_total + v_xp,
    level = calculate_user_level(user_stats.xp_total + v_xp),
    updated_at = NOW();

  -- Get new total XP
  SELECT xp_total INTO v_new_xp FROM user_stats WHERE user_id = p_user_id;

  -- Handle trail progress if this is a trail challenge
  IF v_challenge.trail_id IS NOT NULL THEN
    PERFORM update_trail_progress(
      v_challenge.trail_id,
      p_challenge_id,
      p_user_identifier,
      p_user_id
    );
  END IF;

  -- Check for new badges (simplified - just check Explorer badge)
  DECLARE
    v_challenges_count INTEGER;
  BEGIN
    SELECT challenges_completed INTO v_challenges_count
    FROM user_stats WHERE user_id = p_user_id;

    IF v_challenges_count = 1 THEN
      v_badge := 'First Steps';
    ELSIF v_challenges_count = 5 THEN
      v_badge := 'Explorer';
    ELSIF v_challenges_count = 15 THEN
      v_badge := 'Adventurer';
    ELSIF v_challenges_count = 30 THEN
      v_badge := 'Trailblazer';
    END IF;

    -- Award badge if earned
    IF v_badge IS NOT NULL AND p_user_id IS NOT NULL THEN
      DECLARE
        v_badge_id TEXT;
      BEGIN
        SELECT id INTO v_badge_id FROM badge_definitions WHERE name = v_badge;
        IF v_badge_id IS NOT NULL THEN
          INSERT INTO user_badges (user_id, badge_id)
          VALUES (p_user_id, v_badge_id)
          ON CONFLICT (user_id, badge_id) DO NOTHING;
        END IF;
      END;
    END IF;
  END;

  success := TRUE;
  message := format('Challenge claimed! +%s XP', v_xp);
  xp_awarded := v_xp;
  new_total_xp := v_new_xp;
  badge_earned := v_badge;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. FUNCTION: UPDATE TRAIL PROGRESS
-- Called when a trail challenge is claimed
-- ============================================================================

CREATE OR REPLACE FUNCTION update_trail_progress(
  p_trail_id UUID,
  p_challenge_id UUID,
  p_user_identifier TEXT,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_trail RECORD;
  v_progress RECORD;
  v_new_stops INTEGER;
  v_is_complete BOOLEAN;
BEGIN
  -- Get trail details
  SELECT * INTO v_trail FROM challenge_trails WHERE id = p_trail_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Get or create progress record
  SELECT * INTO v_progress FROM trail_progress
  WHERE trail_id = p_trail_id AND user_identifier = p_user_identifier;

  IF NOT FOUND THEN
    INSERT INTO trail_progress (trail_id, user_identifier, user_id, stops_completed, completed_challenge_ids)
    VALUES (p_trail_id, p_user_identifier, p_user_id, 1, ARRAY[p_challenge_id])
    RETURNING * INTO v_progress;
  ELSE
    -- Check if this challenge was already counted
    IF p_challenge_id = ANY(v_progress.completed_challenge_ids) THEN
      RETURN;
    END IF;

    v_new_stops := v_progress.stops_completed + 1;
    v_is_complete := v_new_stops >= v_trail.required_stops;

    UPDATE trail_progress SET
      stops_completed = v_new_stops,
      completed_challenge_ids = array_append(completed_challenge_ids, p_challenge_id),
      is_complete = v_is_complete,
      completed_at = CASE WHEN v_is_complete THEN NOW() ELSE NULL END,
      bonus_xp_awarded = CASE WHEN v_is_complete THEN v_trail.completion_bonus_xp ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_progress.id;

    -- Award bonus XP if trail complete
    IF v_is_complete AND p_user_id IS NOT NULL THEN
      UPDATE user_stats SET
        trails_completed = trails_completed + 1,
        challenge_xp_earned = challenge_xp_earned + v_trail.completion_bonus_xp,
        xp_total = xp_total + v_trail.completion_bonus_xp,
        level = calculate_user_level(xp_total + v_trail.completion_bonus_xp)
      WHERE user_id = p_user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. FUNCTION: GET ACTIVE CHALLENGES FOR A CITY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_challenges(
  p_city TEXT,
  p_user_identifier TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  target_lat DOUBLE PRECISION,
  target_lng DOUBLE PRECISION,
  radius_meters INTEGER,
  location_name TEXT,
  location_address TEXT,
  xp_reward INTEGER,
  max_claims INTEGER,
  claims_count INTEGER,
  spots_remaining INTEGER,
  expires_at TIMESTAMPTZ,
  challenge_type TEXT,
  trail_id UUID,
  trail_title TEXT,
  trail_order INTEGER,
  user_has_claimed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    c.target_lat,
    c.target_lng,
    c.radius_meters,
    c.location_name,
    c.location_address,
    c.xp_reward,
    c.max_claims,
    c.claims_count,
    CASE
      WHEN c.max_claims IS NULL THEN NULL
      ELSE c.max_claims - c.claims_count
    END as spots_remaining,
    c.expires_at,
    c.challenge_type,
    c.trail_id,
    t.title as trail_title,
    c.trail_order,
    EXISTS(
      SELECT 1 FROM challenge_claims cc
      WHERE cc.challenge_id = c.id AND cc.user_identifier = p_user_identifier
    ) as user_has_claimed
  FROM challenges c
  LEFT JOIN challenge_trails t ON c.trail_id = t.id
  WHERE c.city = p_city
    AND c.is_active = TRUE
    AND c.expires_at > NOW()
    AND c.starts_at <= NOW()
  ORDER BY
    c.trail_id NULLS LAST, -- Group trail challenges together
    c.trail_order,
    c.expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. RLS POLICIES
-- ============================================================================

-- Challenges: Public read
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read challenges" ON challenges;
CREATE POLICY "Public can read challenges" ON challenges
  FOR SELECT TO anon, authenticated USING (is_active = TRUE);

-- Challenge trails: Public read
ALTER TABLE challenge_trails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read trails" ON challenge_trails;
CREATE POLICY "Public can read trails" ON challenge_trails
  FOR SELECT TO anon, authenticated USING (is_active = TRUE);

-- Challenge claims: Public read, anyone can insert (via function)
ALTER TABLE challenge_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read claims" ON challenge_claims;
CREATE POLICY "Public can read claims" ON challenge_claims
  FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Service role can insert claims" ON challenge_claims;
CREATE POLICY "Service role can insert claims" ON challenge_claims
  FOR INSERT TO service_role WITH CHECK (TRUE);

-- Trail progress: Public read
ALTER TABLE trail_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read trail progress" ON trail_progress;
CREATE POLICY "Public can read trail progress" ON trail_progress
  FOR SELECT TO anon, authenticated USING (TRUE);

-- ============================================================================
-- 11. GRANTS
-- ============================================================================

GRANT SELECT ON TABLE challenges TO anon, authenticated;
GRANT SELECT ON TABLE challenge_trails TO anon, authenticated;
GRANT SELECT ON TABLE challenge_claims TO anon, authenticated;
GRANT SELECT ON TABLE trail_progress TO anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE challenges TO service_role;
GRANT ALL PRIVILEGES ON TABLE challenge_trails TO service_role;
GRANT ALL PRIVILEGES ON TABLE challenge_claims TO service_role;
GRANT ALL PRIVILEGES ON TABLE trail_progress TO service_role;

GRANT EXECUTE ON FUNCTION claim_challenge TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_trail_progress TO service_role;
GRANT EXECUTE ON FUNCTION get_active_challenges TO anon, authenticated;

-- ============================================================================
-- 12. ENABLE REALTIME
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'challenges'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'challenge_claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_claims;
  END IF;
END $$;

-- ============================================================================
-- 13. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE challenges IS 'GPS-verified check-in challenges that reward XP for visiting local landmarks';
COMMENT ON TABLE challenge_trails IS 'Multi-stop challenge trails (e.g., Taco Trail) with completion bonuses';
COMMENT ON TABLE challenge_claims IS 'Records of users claiming challenges with GPS verification data';
COMMENT ON TABLE trail_progress IS 'Tracks user progress through multi-stop trail challenges';

COMMENT ON FUNCTION claim_challenge IS 'Verifies GPS location and awards XP for challenge completion';
COMMENT ON FUNCTION get_active_challenges IS 'Returns all active challenges for a city with user claim status';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
