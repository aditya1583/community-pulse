-- Migration: Predictions System - Turn Polls into Stakes
-- Date: 2026-01-12
-- Purpose: Extend polls to become predictions with XP stakes
--
-- Philosophy: Users become Players when outcomes have stakes.
-- By allowing users to "predict" local outcomes (weather, events, civic decisions),
-- we transform passive poll participation into active engagement with real rewards.

-- ============================================================================
-- 1. ADD PREDICTION FIELDS TO PULSES TABLE
-- ============================================================================

-- is_prediction: Marks this poll as a prediction (has stakes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'is_prediction'
  ) THEN
    ALTER TABLE pulses ADD COLUMN is_prediction BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- prediction_resolves_at: When the prediction outcome will be determined
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'prediction_resolves_at'
  ) THEN
    ALTER TABLE pulses ADD COLUMN prediction_resolves_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- prediction_resolved_at: When the prediction was actually resolved
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'prediction_resolved_at'
  ) THEN
    ALTER TABLE pulses ADD COLUMN prediction_resolved_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- prediction_winning_option: Index of the winning option (0 or 1 for binary)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'prediction_winning_option'
  ) THEN
    ALTER TABLE pulses ADD COLUMN prediction_winning_option INTEGER DEFAULT NULL;
  END IF;
END $$;

-- prediction_xp_reward: XP awarded to correct predictors (default 25 XP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'prediction_xp_reward'
  ) THEN
    ALTER TABLE pulses ADD COLUMN prediction_xp_reward INTEGER DEFAULT 25;
  END IF;
END $$;

-- prediction_category: Type of prediction for analytics and generation
-- e.g., 'weather', 'traffic', 'events', 'civic', 'local'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'prediction_category'
  ) THEN
    ALTER TABLE pulses ADD COLUMN prediction_category TEXT DEFAULT NULL;
  END IF;
END $$;

-- prediction_data_source: External data source for auto-resolution
-- e.g., 'openweather', 'manual', 'civic_api'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'prediction_data_source'
  ) THEN
    ALTER TABLE pulses ADD COLUMN prediction_data_source TEXT DEFAULT 'manual';
  END IF;
END $$;

-- Add index for finding unresolved predictions
CREATE INDEX IF NOT EXISTS idx_pulses_unresolved_predictions
  ON pulses(prediction_resolves_at)
  WHERE is_prediction = TRUE AND prediction_resolved_at IS NULL;

-- Add index for predictions by category
CREATE INDEX IF NOT EXISTS idx_pulses_prediction_category
  ON pulses(prediction_category)
  WHERE is_prediction = TRUE;

COMMENT ON COLUMN pulses.is_prediction IS 'TRUE if this poll is a prediction with XP stakes';
COMMENT ON COLUMN pulses.prediction_resolves_at IS 'When the prediction deadline passes and outcome is determined';
COMMENT ON COLUMN pulses.prediction_resolved_at IS 'When the prediction was actually resolved (NULL if pending)';
COMMENT ON COLUMN pulses.prediction_winning_option IS 'Index of the winning option after resolution';
COMMENT ON COLUMN pulses.prediction_xp_reward IS 'XP awarded to users who predicted correctly';
COMMENT ON COLUMN pulses.prediction_category IS 'Category of prediction: weather, traffic, events, civic, local';
COMMENT ON COLUMN pulses.prediction_data_source IS 'Data source for resolution: manual, openweather, civic_api';

-- ============================================================================
-- 2. CREATE PREDICTION_REWARDS TABLE
-- Tracks XP awarded for correct predictions (audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  option_voted INTEGER NOT NULL,
  xp_awarded INTEGER NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),

  -- One reward per user per prediction
  UNIQUE(pulse_id, user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_prediction_rewards_pulse ON prediction_rewards(pulse_id);
CREATE INDEX IF NOT EXISTS idx_prediction_rewards_user ON prediction_rewards(user_identifier);
CREATE INDEX IF NOT EXISTS idx_prediction_rewards_user_id ON prediction_rewards(user_id);

COMMENT ON TABLE prediction_rewards IS 'Audit log of XP rewards given for correct predictions';

-- ============================================================================
-- 3. ADD PREDICTION STATS TO USER_STATS TABLE
-- ============================================================================

-- predictions_made: Total predictions participated in
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'predictions_made'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN predictions_made INTEGER DEFAULT 0;
  END IF;
END $$;

-- predictions_correct: Number of correct predictions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'predictions_correct'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN predictions_correct INTEGER DEFAULT 0;
  END IF;
END $$;

-- prediction_xp_earned: Total XP earned from predictions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'prediction_xp_earned'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN prediction_xp_earned INTEGER DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN user_stats.predictions_made IS 'Total number of predictions participated in';
COMMENT ON COLUMN user_stats.predictions_correct IS 'Number of correct predictions';
COMMENT ON COLUMN user_stats.prediction_xp_earned IS 'Total XP earned from correct predictions';

-- ============================================================================
-- 4. ADD PREDICTION BADGES
-- ============================================================================

INSERT INTO badge_definitions (id, name, description, icon, category, required_pulse_count, display_order, special_condition)
VALUES
  ('oracle_1', 'Fortune Teller', 'Got 3 predictions correct', '🔮', 'achievement', 0, 100, '{"predictions_correct": 3}'),
  ('oracle_2', 'Local Oracle', 'Got 10 predictions correct', '🔮', 'achievement', 0, 101, '{"predictions_correct": 10}'),
  ('oracle_3', 'Seer', 'Got 25 predictions correct', '🎱', 'achievement', 0, 102, '{"predictions_correct": 25}'),
  ('oracle_4', 'Nostradamus', 'Got 50 predictions correct', '🌟', 'achievement', 0, 103, '{"predictions_correct": 50}'),
  ('predictor_streak', 'Hot Streak', '5 correct predictions in a row', '🔥', 'achievement', 0, 104, '{"prediction_streak": 5}'),
  ('weather_prophet', 'Weather Prophet', 'Got 10 weather predictions right', '⛈️', 'achievement', 0, 105, '{"weather_predictions_correct": 10}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. FUNCTION: RESOLVE A PREDICTION
-- Called when prediction deadline passes, awards XP to winners
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_prediction(
  p_pulse_id BIGINT,
  p_winning_option INTEGER
)
RETURNS TABLE(
  users_rewarded INTEGER,
  total_xp_awarded INTEGER,
  winning_votes INTEGER,
  total_votes INTEGER
) AS $$
DECLARE
  v_pulse RECORD;
  v_vote RECORD;
  v_users_rewarded INTEGER := 0;
  v_total_xp INTEGER := 0;
  v_winning_votes INTEGER := 0;
  v_total_votes INTEGER := 0;
BEGIN
  -- Get the pulse and verify it's an unresolved prediction
  SELECT * INTO v_pulse FROM pulses WHERE id = p_pulse_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pulse not found';
  END IF;

  IF NOT v_pulse.is_prediction THEN
    RAISE EXCEPTION 'Pulse is not a prediction';
  END IF;

  IF v_pulse.prediction_resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Prediction already resolved';
  END IF;

  -- Mark the prediction as resolved
  UPDATE pulses SET
    prediction_resolved_at = NOW(),
    prediction_winning_option = p_winning_option
  WHERE id = p_pulse_id;

  -- Count total votes
  SELECT COUNT(*) INTO v_total_votes FROM poll_votes WHERE pulse_id = p_pulse_id;

  -- Award XP to each correct voter
  FOR v_vote IN
    SELECT pv.*, u.id as auth_user_id
    FROM poll_votes pv
    LEFT JOIN auth.users u ON pv.user_identifier = (
      SELECT anon_name FROM profiles WHERE id = u.id
    )
    WHERE pv.pulse_id = p_pulse_id
      AND pv.option_index = p_winning_option
  LOOP
    v_winning_votes := v_winning_votes + 1;

    -- Insert reward record
    INSERT INTO prediction_rewards (pulse_id, user_identifier, user_id, option_voted, xp_awarded)
    VALUES (p_pulse_id, v_vote.user_identifier, v_vote.auth_user_id, v_vote.option_index, v_pulse.prediction_xp_reward)
    ON CONFLICT (pulse_id, user_identifier) DO NOTHING;

    IF FOUND THEN
      v_users_rewarded := v_users_rewarded + 1;
      v_total_xp := v_total_xp + v_pulse.prediction_xp_reward;

      -- Update user stats if we have their auth ID
      IF v_vote.auth_user_id IS NOT NULL THEN
        UPDATE user_stats SET
          predictions_correct = predictions_correct + 1,
          prediction_xp_earned = prediction_xp_earned + v_pulse.prediction_xp_reward,
          xp_total = xp_total + v_pulse.prediction_xp_reward,
          level = calculate_user_level(xp_total + v_pulse.prediction_xp_reward)
        WHERE user_id = v_vote.auth_user_id;
      END IF;
    END IF;
  END LOOP;

  -- Return summary
  users_rewarded := v_users_rewarded;
  total_xp_awarded := v_total_xp;
  winning_votes := v_winning_votes;
  total_votes := v_total_votes;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION resolve_prediction IS 'Resolves a prediction and awards XP to correct voters';

-- ============================================================================
-- 6. FUNCTION: GET PREDICTION STATS FOR A USER
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_prediction_stats(p_user_identifier TEXT)
RETURNS TABLE(
  predictions_participated INTEGER,
  predictions_won INTEGER,
  total_xp_earned INTEGER,
  accuracy_percent NUMERIC
) AS $$
DECLARE
  v_participated INTEGER;
  v_won INTEGER;
  v_xp INTEGER;
BEGIN
  -- Count predictions participated in (voted on predictions that resolved)
  SELECT COUNT(DISTINCT pv.pulse_id) INTO v_participated
  FROM poll_votes pv
  JOIN pulses p ON p.id = pv.pulse_id
  WHERE pv.user_identifier = p_user_identifier
    AND p.is_prediction = TRUE
    AND p.prediction_resolved_at IS NOT NULL;

  -- Count predictions won
  SELECT COUNT(*), COALESCE(SUM(xp_awarded), 0) INTO v_won, v_xp
  FROM prediction_rewards
  WHERE user_identifier = p_user_identifier;

  predictions_participated := v_participated;
  predictions_won := v_won;
  total_xp_earned := v_xp;

  IF v_participated > 0 THEN
    accuracy_percent := ROUND((v_won::NUMERIC / v_participated::NUMERIC) * 100, 1);
  ELSE
    accuracy_percent := 0;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. RLS POLICIES FOR PREDICTION_REWARDS
-- ============================================================================

ALTER TABLE prediction_rewards ENABLE ROW LEVEL SECURITY;

-- Anyone can read rewards (for leaderboards and transparency)
DROP POLICY IF EXISTS "Public can read prediction rewards" ON prediction_rewards;
CREATE POLICY "Public can read prediction rewards" ON prediction_rewards
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role can insert (via resolve_prediction function)
DROP POLICY IF EXISTS "Service role can insert prediction rewards" ON prediction_rewards;
CREATE POLICY "Service role can insert prediction rewards" ON prediction_rewards
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT SELECT ON TABLE prediction_rewards TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE prediction_rewards TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION resolve_prediction TO service_role;
GRANT EXECUTE ON FUNCTION get_user_prediction_stats TO anon, authenticated;

-- ============================================================================
-- 9. ENABLE REALTIME FOR PREDICTIONS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'prediction_rewards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_rewards;
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
