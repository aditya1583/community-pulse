-- Migration: Community Resolution System
-- Date: 2026-01-13
-- Purpose: Allow community to vote on prediction outcomes for subjective predictions
--
-- Philosophy: For predictions like "Will the park be crowded?" there's no API
-- to verify the outcome. Instead, the community itself becomes the oracle.
-- After the prediction deadline passes, participants vote on what actually happened.

-- ============================================================================
-- 1. RESOLUTION VOTES TABLE
-- Tracks votes on what the actual outcome was
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_resolution_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What they think the outcome was (0 = option A won, 1 = option B won)
  voted_outcome INTEGER NOT NULL CHECK (voted_outcome IN (0, 1)),

  -- Credibility weight: users who made the original prediction get more weight
  -- This prevents brigading by people who didn't participate
  was_original_predictor BOOLEAN DEFAULT FALSE,

  voted_at TIMESTAMPTZ DEFAULT NOW(),

  -- One vote per user per prediction
  UNIQUE(pulse_id, user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_pulse
  ON prediction_resolution_votes(pulse_id);
CREATE INDEX IF NOT EXISTS idx_resolution_votes_user
  ON prediction_resolution_votes(user_identifier);

COMMENT ON TABLE prediction_resolution_votes IS 'Community votes on what actually happened for subjective predictions';

-- ============================================================================
-- 2. ADD COMMUNITY RESOLUTION FIELDS TO PULSES
-- ============================================================================

-- resolution_voting_ends_at: When community voting on outcome ends
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'resolution_voting_ends_at'
  ) THEN
    ALTER TABLE pulses ADD COLUMN resolution_voting_ends_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- resolution_vote_count: Total resolution votes cast
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'resolution_vote_count'
  ) THEN
    ALTER TABLE pulses ADD COLUMN resolution_vote_count INTEGER DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN pulses.resolution_voting_ends_at IS 'For community-resolved predictions: when outcome voting ends';
COMMENT ON COLUMN pulses.resolution_vote_count IS 'Number of votes cast on what the outcome was';

-- ============================================================================
-- 3. FUNCTION: CAST RESOLUTION VOTE
-- Users vote on what they think the actual outcome was
-- ============================================================================

CREATE OR REPLACE FUNCTION cast_resolution_vote(
  p_pulse_id BIGINT,
  p_user_identifier TEXT,
  p_user_id UUID,
  p_voted_outcome INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  current_tally_a INTEGER,
  current_tally_b INTEGER
) AS $$
DECLARE
  v_pulse RECORD;
  v_was_predictor BOOLEAN;
  v_tally_a INTEGER;
  v_tally_b INTEGER;
BEGIN
  -- Get the pulse
  SELECT * INTO v_pulse FROM pulses WHERE id = p_pulse_id;

  IF NOT FOUND THEN
    success := FALSE; message := 'Prediction not found';
    RETURN NEXT; RETURN;
  END IF;

  -- Verify this is a community-resolved prediction
  IF v_pulse.prediction_data_source != 'community' THEN
    success := FALSE; message := 'This prediction is not community-resolved';
    RETURN NEXT; RETURN;
  END IF;

  -- Verify prediction deadline has passed
  IF v_pulse.prediction_resolves_at > NOW() THEN
    success := FALSE; message := 'Prediction deadline has not passed yet';
    RETURN NEXT; RETURN;
  END IF;

  -- Verify resolution voting period is active
  IF v_pulse.resolution_voting_ends_at IS NULL THEN
    -- Start the resolution voting period (24 hours from now)
    UPDATE pulses SET resolution_voting_ends_at = NOW() + INTERVAL '24 hours'
    WHERE id = p_pulse_id;
  ELSIF v_pulse.resolution_voting_ends_at < NOW() THEN
    success := FALSE; message := 'Resolution voting has ended';
    RETURN NEXT; RETURN;
  END IF;

  -- Already resolved?
  IF v_pulse.prediction_resolved_at IS NOT NULL THEN
    success := FALSE; message := 'Prediction has already been resolved';
    RETURN NEXT; RETURN;
  END IF;

  -- Check if user was an original predictor (voted on the prediction)
  SELECT EXISTS(
    SELECT 1 FROM poll_votes
    WHERE pulse_id = p_pulse_id AND user_identifier = p_user_identifier
  ) INTO v_was_predictor;

  -- Insert or update vote
  INSERT INTO prediction_resolution_votes (
    pulse_id, user_identifier, user_id, voted_outcome, was_original_predictor
  ) VALUES (
    p_pulse_id, p_user_identifier, p_user_id, p_voted_outcome, v_was_predictor
  )
  ON CONFLICT (pulse_id, user_identifier) DO UPDATE SET
    voted_outcome = p_voted_outcome,
    voted_at = NOW();

  -- Update vote count on pulse
  UPDATE pulses SET
    resolution_vote_count = (
      SELECT COUNT(*) FROM prediction_resolution_votes WHERE pulse_id = p_pulse_id
    )
  WHERE id = p_pulse_id;

  -- Get current tally (weighted: original predictors count 2x)
  SELECT
    COALESCE(SUM(CASE WHEN voted_outcome = 0 THEN (CASE WHEN was_original_predictor THEN 2 ELSE 1 END) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN voted_outcome = 1 THEN (CASE WHEN was_original_predictor THEN 2 ELSE 1 END) ELSE 0 END), 0)
  INTO v_tally_a, v_tally_b
  FROM prediction_resolution_votes
  WHERE pulse_id = p_pulse_id;

  success := TRUE;
  message := 'Vote recorded';
  current_tally_a := v_tally_a;
  current_tally_b := v_tally_b;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. FUNCTION: FINALIZE COMMUNITY RESOLUTION
-- Called after resolution voting ends to determine winner and award XP
-- ============================================================================

CREATE OR REPLACE FUNCTION finalize_community_resolution(p_pulse_id BIGINT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  winning_option INTEGER,
  users_rewarded INTEGER,
  total_xp_awarded INTEGER
) AS $$
DECLARE
  v_pulse RECORD;
  v_tally_a INTEGER;
  v_tally_b INTEGER;
  v_winner INTEGER;
  v_users_rewarded INTEGER := 0;
  v_total_xp INTEGER := 0;
  v_vote RECORD;
BEGIN
  -- Get the pulse
  SELECT * INTO v_pulse FROM pulses WHERE id = p_pulse_id;

  IF NOT FOUND THEN
    success := FALSE; message := 'Prediction not found';
    RETURN NEXT; RETURN;
  END IF;

  -- Already resolved?
  IF v_pulse.prediction_resolved_at IS NOT NULL THEN
    success := FALSE; message := 'Already resolved';
    RETURN NEXT; RETURN;
  END IF;

  -- Resolution voting must have ended
  IF v_pulse.resolution_voting_ends_at IS NULL OR v_pulse.resolution_voting_ends_at > NOW() THEN
    success := FALSE; message := 'Resolution voting has not ended yet';
    RETURN NEXT; RETURN;
  END IF;

  -- Get weighted tally
  SELECT
    COALESCE(SUM(CASE WHEN voted_outcome = 0 THEN (CASE WHEN was_original_predictor THEN 2 ELSE 1 END) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN voted_outcome = 1 THEN (CASE WHEN was_original_predictor THEN 2 ELSE 1 END) ELSE 0 END), 0)
  INTO v_tally_a, v_tally_b
  FROM prediction_resolution_votes
  WHERE pulse_id = p_pulse_id;

  -- Need at least 3 votes to resolve
  IF (v_tally_a + v_tally_b) < 3 THEN
    -- Not enough votes - refund/cancel (mark as resolved with no winner)
    UPDATE pulses SET
      prediction_resolved_at = NOW(),
      prediction_winning_option = -1  -- -1 indicates cancelled/insufficient votes
    WHERE id = p_pulse_id;

    success := TRUE;
    message := 'Insufficient votes - prediction cancelled';
    winning_option := -1;
    users_rewarded := 0;
    total_xp_awarded := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- Determine winner (ties go to option A)
  v_winner := CASE WHEN v_tally_a >= v_tally_b THEN 0 ELSE 1 END;

  -- Mark as resolved
  UPDATE pulses SET
    prediction_resolved_at = NOW(),
    prediction_winning_option = v_winner
  WHERE id = p_pulse_id;

  -- Award XP to correct predictors
  FOR v_vote IN
    SELECT pv.*, u.id as auth_user_id
    FROM poll_votes pv
    LEFT JOIN auth.users u ON pv.user_identifier = (
      SELECT anon_name FROM profiles WHERE id = u.id
    )
    WHERE pv.pulse_id = p_pulse_id
      AND pv.option_index = v_winner
  LOOP
    -- Insert reward record
    INSERT INTO prediction_rewards (pulse_id, user_identifier, user_id, option_voted, xp_awarded)
    VALUES (p_pulse_id, v_vote.user_identifier, v_vote.auth_user_id, v_vote.option_index, v_pulse.prediction_xp_reward)
    ON CONFLICT (pulse_id, user_identifier) DO NOTHING;

    IF FOUND THEN
      v_users_rewarded := v_users_rewarded + 1;
      v_total_xp := v_total_xp + v_pulse.prediction_xp_reward;

      -- Update user stats
      IF v_vote.auth_user_id IS NOT NULL THEN
        UPDATE user_stats SET
          predictions_correct = predictions_correct + 1,
          prediction_xp_earned = prediction_xp_earned + v_pulse.prediction_xp_reward,
          xp_total = xp_total + v_pulse.prediction_xp_reward
        WHERE user_id = v_vote.auth_user_id;
      END IF;
    END IF;
  END LOOP;

  success := TRUE;
  message := format('Resolved! Option %s won. %s users awarded %s XP total.',
    CASE WHEN v_winner = 0 THEN 'A' ELSE 'B' END, v_users_rewarded, v_total_xp);
  winning_option := v_winner;
  users_rewarded := v_users_rewarded;
  total_xp_awarded := v_total_xp;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNCTION: GET PREDICTIONS NEEDING COMMUNITY RESOLUTION
-- For CRON job to trigger resolution voting
-- ============================================================================

CREATE OR REPLACE FUNCTION get_predictions_needing_resolution()
RETURNS TABLE(
  pulse_id BIGINT,
  city TEXT,
  prediction_resolves_at TIMESTAMPTZ,
  resolution_voting_ends_at TIMESTAMPTZ,
  data_source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as pulse_id,
    p.city,
    p.prediction_resolves_at,
    p.resolution_voting_ends_at,
    p.prediction_data_source as data_source
  FROM pulses p
  WHERE p.is_prediction = TRUE
    AND p.prediction_resolved_at IS NULL
    AND p.prediction_resolves_at < NOW()
    AND p.prediction_data_source = 'community'
  ORDER BY p.prediction_resolves_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE prediction_resolution_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read resolution votes" ON prediction_resolution_votes;
CREATE POLICY "Public can read resolution votes" ON prediction_resolution_votes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can vote on resolution" ON prediction_resolution_votes;
CREATE POLICY "Anyone can vote on resolution" ON prediction_resolution_votes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own vote" ON prediction_resolution_votes;
CREATE POLICY "Users can update own vote" ON prediction_resolution_votes
  FOR UPDATE TO anon, authenticated
  USING (user_identifier = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON TABLE prediction_resolution_votes TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE prediction_resolution_votes TO service_role;

GRANT EXECUTE ON FUNCTION cast_resolution_vote TO anon, authenticated;
GRANT EXECUTE ON FUNCTION finalize_community_resolution TO service_role;
GRANT EXECUTE ON FUNCTION get_predictions_needing_resolution TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
