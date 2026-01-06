-- Migration: Fix Bot Pulse Trigger
-- Date: 2025-01-05
-- Purpose: Allow bot pulses (user_id = NULL) to bypass gamification triggers
--
-- The update_user_stats_on_pulse trigger was failing for bot-seeded pulses
-- because it tried to insert into user_stats with a NULL user_id.

-- ============================================================================
-- 1. UPDATE PULSE STATS TRIGGER TO SKIP BOT PULSES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_stats_on_pulse()
RETURNS TRIGGER AS $$
DECLARE
  today DATE := CURRENT_DATE;
  week_start_date DATE := date_trunc('week', CURRENT_DATE)::DATE;
  month_start_date DATE := date_trunc('month', CURRENT_DATE)::DATE;
  existing_stats user_stats%ROWTYPE;
  new_streak INTEGER;
  posted_hour INTEGER;
BEGIN
  -- Skip stats update for bot pulses (no user_id)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get or create user stats
  SELECT * INTO existing_stats FROM user_stats WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    -- Create new stats record
    INSERT INTO user_stats (
      user_id,
      pulse_count_total,
      pulse_count_traffic,
      pulse_count_weather,
      pulse_count_events,
      pulse_count_general,
      current_streak_days,
      longest_streak_days,
      last_pulse_date,
      pulses_this_week,
      pulses_this_month,
      week_start,
      month_start
    ) VALUES (
      NEW.user_id,
      1,
      CASE WHEN NEW.tag = 'Traffic' THEN 1 ELSE 0 END,
      CASE WHEN NEW.tag = 'Weather' THEN 1 ELSE 0 END,
      CASE WHEN NEW.tag = 'Events' THEN 1 ELSE 0 END,
      CASE WHEN NEW.tag = 'General' THEN 1 ELSE 0 END,
      1, -- First pulse starts streak at 1
      1,
      today,
      1,
      1,
      week_start_date,
      month_start_date
    );

    -- Update XP and level
    UPDATE user_stats
    SET xp_total = 10, level = calculate_user_level(10)
    WHERE user_id = NEW.user_id;
  ELSE
    -- Update existing stats

    -- Calculate new streak
    IF existing_stats.last_pulse_date = today THEN
      -- Same day, no streak change
      new_streak := existing_stats.current_streak_days;
    ELSIF existing_stats.last_pulse_date = today - 1 THEN
      -- Consecutive day, increment streak
      new_streak := existing_stats.current_streak_days + 1;
    ELSE
      -- Streak broken, reset to 1
      new_streak := 1;
    END IF;

    -- Reset week/month counters if needed
    IF existing_stats.week_start < week_start_date THEN
      UPDATE user_stats SET
        pulses_this_week = 0,
        week_start = week_start_date
      WHERE user_id = NEW.user_id;
    END IF;

    IF existing_stats.month_start < month_start_date THEN
      UPDATE user_stats SET
        pulses_this_month = 0,
        month_start = month_start_date
      WHERE user_id = NEW.user_id;
    END IF;

    -- Update stats
    UPDATE user_stats us SET
      pulse_count_total = us.pulse_count_total + 1,
      pulse_count_traffic = us.pulse_count_traffic + CASE WHEN NEW.tag = 'Traffic' THEN 1 ELSE 0 END,
      pulse_count_weather = us.pulse_count_weather + CASE WHEN NEW.tag = 'Weather' THEN 1 ELSE 0 END,
      pulse_count_events = us.pulse_count_events + CASE WHEN NEW.tag = 'Events' THEN 1 ELSE 0 END,
      pulse_count_general = us.pulse_count_general + CASE WHEN NEW.tag = 'General' THEN 1 ELSE 0 END,
      current_streak_days = new_streak,
      longest_streak_days = GREATEST(us.longest_streak_days, new_streak),
      last_pulse_date = today,
      pulses_this_week = us.pulses_this_week + 1,
      pulses_this_month = us.pulses_this_month + 1,
      xp_total = us.xp_total + 10,
      level = calculate_user_level(us.xp_total + 10)
    WHERE user_id = NEW.user_id;
  END IF;

  -- Track posting time for "Night Owl" and "Early Bird" badges
  posted_hour := EXTRACT(HOUR FROM NEW.created_at);

  IF posted_hour >= 0 AND posted_hour < 5 THEN
    UPDATE user_stats SET night_owl_count = night_owl_count + 1 WHERE user_id = NEW.user_id;
  ELSIF posted_hour >= 5 AND posted_hour < 8 THEN
    UPDATE user_stats SET early_bird_count = early_bird_count + 1 WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION update_user_stats_on_pulse() IS
  'Updates user statistics when a pulse is created. Skips bot pulses (user_id = NULL).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
