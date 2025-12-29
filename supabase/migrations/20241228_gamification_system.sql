-- Migration: Gamification System (Leaderboards, Badges, Levels)
-- Date: 2024-12-28
-- Purpose: Add status, recognition, and engagement incentives to Community Pulse
--
-- Philosophy: Status is earned through contribution.
-- Users become "local experts" through consistent, helpful posting.
-- The system rewards both quantity (posts) and quality (reactions received).

-- ============================================================================
-- 1. BADGE DEFINITIONS TABLE
-- Static definitions of all possible badges
-- ============================================================================

CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,                    -- Emoji or icon identifier
  category TEXT NOT NULL CHECK (category IN ('category', 'achievement', 'streak', 'milestone')),
  -- For category badges (Traffic Reporter, Weather Watcher, etc.)
  required_tag TEXT,                     -- NULL for non-category badges
  -- For leveled badges, the tier thresholds
  tier INTEGER DEFAULT 1 CHECK (tier >= 1 AND tier <= 5),
  -- Requirements to earn this badge
  required_pulse_count INTEGER DEFAULT 0,
  required_reaction_count INTEGER DEFAULT 0,  -- Total reactions received
  required_streak_days INTEGER DEFAULT 0,
  -- Special achievement conditions (JSON for flexibility)
  special_condition JSONB DEFAULT NULL,
  -- Display priority (lower = shown first)
  display_order INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. USER EARNED BADGES TABLE
-- Tracks which badges each user has earned
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  -- For time-based badges, when it expires (NULL = permanent)
  expires_at TIMESTAMPTZ DEFAULT NULL,
  -- Progress toward next tier (if applicable)
  current_progress INTEGER DEFAULT 0,

  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

-- ============================================================================
-- 3. USER STATS TABLE
-- Aggregated statistics for each user, updated on pulse/reaction events
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Pulse counts by category
  pulse_count_total INTEGER DEFAULT 0,
  pulse_count_traffic INTEGER DEFAULT 0,
  pulse_count_weather INTEGER DEFAULT 0,
  pulse_count_events INTEGER DEFAULT 0,
  pulse_count_general INTEGER DEFAULT 0,
  -- Reaction counts received
  reactions_received_total INTEGER DEFAULT 0,
  reactions_fire_received INTEGER DEFAULT 0,
  reactions_eyes_received INTEGER DEFAULT 0,
  reactions_check_received INTEGER DEFAULT 0,
  -- Streak tracking
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_pulse_date DATE,
  -- Weekly/Monthly aggregates (for leaderboard performance)
  pulses_this_week INTEGER DEFAULT 0,
  pulses_this_month INTEGER DEFAULT 0,
  reactions_this_week INTEGER DEFAULT 0,
  reactions_this_month INTEGER DEFAULT 0,
  week_start DATE,
  month_start DATE,
  -- Computed level (1-100 scale)
  level INTEGER DEFAULT 1,
  xp_total INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. LEADERBOARD CACHE TABLE
-- Pre-computed leaderboard rankings, refreshed periodically
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,                -- Cached for display
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'alltime')),
  city TEXT,                             -- NULL = global, otherwise city-specific
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,                -- Combined score (pulses + reactions)
  pulse_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, period, city)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_period_city ON leaderboard_cache(period, city, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard_cache(user_id);

-- ============================================================================
-- 5. INSERT DEFAULT BADGE DEFINITIONS
-- ============================================================================

-- Category Expertise Badges (Levels 1-5)
INSERT INTO badge_definitions (id, name, description, icon, category, required_tag, tier, required_pulse_count, display_order)
VALUES
  ('traffic_reporter_1', 'Traffic Reporter', 'Posted 5 traffic updates', '🚗', 'category', 'Traffic', 1, 5, 10),
  ('traffic_reporter_2', 'Traffic Reporter II', 'Posted 25 traffic updates', '🚗', 'category', 'Traffic', 2, 25, 11),
  ('traffic_reporter_3', 'Traffic Reporter III', 'Posted 100 traffic updates', '🚙', 'category', 'Traffic', 3, 100, 12),
  ('traffic_reporter_4', 'Traffic Reporter IV', 'Posted 250 traffic updates', '🚕', 'category', 'Traffic', 4, 250, 13),
  ('traffic_reporter_5', 'Traffic Master', 'Posted 500 traffic updates', '🏎️', 'category', 'Traffic', 5, 500, 14),

  ('weather_watcher_1', 'Weather Watcher', 'Posted 5 weather updates', '🌤️', 'category', 'Weather', 1, 5, 20),
  ('weather_watcher_2', 'Weather Watcher II', 'Posted 25 weather updates', '⛅', 'category', 'Weather', 2, 25, 21),
  ('weather_watcher_3', 'Weather Watcher III', 'Posted 100 weather updates', '🌦️', 'category', 'Weather', 3, 100, 22),
  ('weather_watcher_4', 'Weather Watcher IV', 'Posted 250 weather updates', '🌈', 'category', 'Weather', 4, 250, 23),
  ('weather_watcher_5', 'Weather Sage', 'Posted 500 weather updates', '⚡', 'category', 'Weather', 5, 500, 24),

  ('event_scout_1', 'Event Scout', 'Posted 5 event updates', '🎪', 'category', 'Events', 1, 5, 30),
  ('event_scout_2', 'Event Scout II', 'Posted 25 event updates', '🎭', 'category', 'Events', 2, 25, 31),
  ('event_scout_3', 'Event Scout III', 'Posted 100 event updates', '🎉', 'category', 'Events', 3, 100, 32),
  ('event_scout_4', 'Event Scout IV', 'Posted 250 event updates', '🎊', 'category', 'Events', 4, 250, 33),
  ('event_scout_5', 'Event Master', 'Posted 500 event updates', '🏆', 'category', 'Events', 5, 500, 34),

  ('local_voice_1', 'Local Voice', 'Posted 5 general updates', '💬', 'category', 'General', 1, 5, 40),
  ('local_voice_2', 'Local Voice II', 'Posted 25 general updates', '🗣️', 'category', 'General', 2, 25, 41),
  ('local_voice_3', 'Local Voice III', 'Posted 100 general updates', '📢', 'category', 'General', 3, 100, 42),
  ('local_voice_4', 'Local Voice IV', 'Posted 250 general updates', '📣', 'category', 'General', 4, 250, 43),
  ('local_voice_5', 'Community Legend', 'Posted 500 general updates', '👑', 'category', 'General', 5, 500, 44)
ON CONFLICT (id) DO NOTHING;

-- Achievement Badges
INSERT INTO badge_definitions (id, name, description, icon, category, required_pulse_count, required_reaction_count, display_order, special_condition)
VALUES
  ('first_pulse', 'First Pulse', 'Posted your first pulse', '🌟', 'achievement', 1, 0, 1, NULL),
  ('helpful_10', 'Helpful', 'Received 10 reactions', '👍', 'achievement', 0, 10, 50, NULL),
  ('helpful_50', 'Very Helpful', 'Received 50 reactions', '🙌', 'achievement', 0, 50, 51, NULL),
  ('helpful_100', 'Community Helper', 'Received 100 reactions', '🤝', 'achievement', 0, 100, 52, NULL),
  ('helpful_500', 'Community Hero', 'Received 500 reactions', '🦸', 'achievement', 0, 500, 53, NULL),
  ('trendsetter', 'Trendsetter', 'Had a pulse get 10+ reactions', '🔥', 'achievement', 0, 0, 60, '{"single_pulse_reactions": 10}'),
  ('viral', 'Gone Viral', 'Had a pulse get 50+ reactions', '📈', 'achievement', 0, 0, 61, '{"single_pulse_reactions": 50}'),
  ('early_bird', 'Early Bird', 'First pulse of the day in your city', '🐦', 'achievement', 0, 0, 70, '{"first_of_day": true}'),
  ('night_owl', 'Night Owl', 'Posted after midnight', '🦉', 'achievement', 0, 0, 71, '{"posted_after_midnight": true}')
ON CONFLICT (id) DO NOTHING;

-- Streak Badges
INSERT INTO badge_definitions (id, name, description, icon, category, required_streak_days, display_order)
VALUES
  ('streak_3', 'Getting Started', '3-day posting streak', '🔥', 'streak', 3, 80),
  ('streak_7', 'Week Warrior', '7-day posting streak', '🔥', 'streak', 7, 81),
  ('streak_14', 'Dedicated', '14-day posting streak', '💪', 'streak', 14, 82),
  ('streak_30', 'Streak Master', '30-day posting streak', '⚡', 'streak', 30, 83),
  ('streak_100', 'Legendary Streak', '100-day posting streak', '🏆', 'streak', 100, 84)
ON CONFLICT (id) DO NOTHING;

-- Milestone Badges
INSERT INTO badge_definitions (id, name, description, icon, category, required_pulse_count, display_order)
VALUES
  ('milestone_10', 'Active Contributor', 'Posted 10 pulses', '📝', 'milestone', 10, 90),
  ('milestone_50', 'Regular', 'Posted 50 pulses', '📊', 'milestone', 50, 91),
  ('milestone_100', 'Dedicated Contributor', 'Posted 100 pulses', '⭐', 'milestone', 100, 92),
  ('milestone_250', 'Power User', 'Posted 250 pulses', '💎', 'milestone', 250, 93),
  ('milestone_500', 'Local Expert', 'Posted 500 pulses', '🏅', 'milestone', 500, 94),
  ('milestone_1000', 'Community Pillar', 'Posted 1000 pulses', '👑', 'milestone', 1000, 95)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. FUNCTIONS FOR XP AND LEVEL CALCULATION
-- ============================================================================

-- XP Formula: pulses give base XP, reactions received give bonus XP
-- Level = floor(sqrt(xp / 100)) + 1, capped at 100
CREATE OR REPLACE FUNCTION calculate_user_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN LEAST(100, GREATEST(1, FLOOR(SQRT(xp::FLOAT / 100)) + 1));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate total XP from stats
-- Pulses: 10 XP each
-- Fire reactions: 5 XP each
-- Eyes reactions: 3 XP each
-- Check reactions: 2 XP each
-- Streak bonus: current_streak * 2 XP per day
CREATE OR REPLACE FUNCTION calculate_total_xp(stats user_stats)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    (stats.pulse_count_total * 10) +
    (stats.reactions_fire_received * 5) +
    (stats.reactions_eyes_received * 3) +
    (stats.reactions_check_received * 2) +
    (stats.current_streak_days * 2)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 7. TRIGGER: UPDATE USER STATS ON PULSE INSERT
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
    -- Calculate new streak
    IF existing_stats.last_pulse_date = today THEN
      -- Already posted today, keep current streak
      new_streak := existing_stats.current_streak_days;
    ELSIF existing_stats.last_pulse_date = today - 1 THEN
      -- Posted yesterday, increment streak
      new_streak := existing_stats.current_streak_days + 1;
    ELSE
      -- Streak broken, reset to 1
      new_streak := 1;
    END IF;

    -- Reset weekly/monthly counters if needed
    UPDATE user_stats SET
      pulse_count_total = pulse_count_total + 1,
      pulse_count_traffic = pulse_count_traffic + CASE WHEN NEW.tag = 'Traffic' THEN 1 ELSE 0 END,
      pulse_count_weather = pulse_count_weather + CASE WHEN NEW.tag = 'Weather' THEN 1 ELSE 0 END,
      pulse_count_events = pulse_count_events + CASE WHEN NEW.tag = 'Events' THEN 1 ELSE 0 END,
      pulse_count_general = pulse_count_general + CASE WHEN NEW.tag = 'General' THEN 1 ELSE 0 END,
      current_streak_days = new_streak,
      longest_streak_days = GREATEST(longest_streak_days, new_streak),
      last_pulse_date = today,
      pulses_this_week = CASE
        WHEN week_start IS NULL OR week_start < week_start_date THEN 1
        ELSE pulses_this_week + 1
      END,
      pulses_this_month = CASE
        WHEN month_start IS NULL OR month_start < month_start_date THEN 1
        ELSE pulses_this_month + 1
      END,
      week_start = week_start_date,
      month_start = month_start_date,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;

    -- Recalculate XP and level
    UPDATE user_stats us SET
      xp_total = (
        (us.pulse_count_total * 10) +
        (us.reactions_fire_received * 5) +
        (us.reactions_eyes_received * 3) +
        (us.reactions_check_received * 2) +
        (us.current_streak_days * 2)
      ),
      level = calculate_user_level(
        (us.pulse_count_total * 10) +
        (us.reactions_fire_received * 5) +
        (us.reactions_eyes_received * 3) +
        (us.reactions_check_received * 2) +
        (us.current_streak_days * 2)
      )
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop if exists for idempotency)
DROP TRIGGER IF EXISTS trg_update_user_stats_on_pulse ON pulses;
CREATE TRIGGER trg_update_user_stats_on_pulse
  AFTER INSERT ON pulses
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_pulse();

-- ============================================================================
-- 8. TRIGGER: UPDATE USER STATS ON REACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_stats_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
  pulse_owner_id UUID;
  week_start_date DATE := date_trunc('week', CURRENT_DATE)::DATE;
  month_start_date DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  -- Get the owner of the pulse that received the reaction
  SELECT user_id INTO pulse_owner_id FROM pulses WHERE id = NEW.pulse_id;

  IF pulse_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure user_stats exists
  INSERT INTO user_stats (user_id, week_start, month_start)
  VALUES (pulse_owner_id, week_start_date, month_start_date)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update reaction counts
  UPDATE user_stats SET
    reactions_received_total = reactions_received_total + 1,
    reactions_fire_received = reactions_fire_received + CASE WHEN NEW.reaction_type = 'fire' THEN 1 ELSE 0 END,
    reactions_eyes_received = reactions_eyes_received + CASE WHEN NEW.reaction_type = 'eyes' THEN 1 ELSE 0 END,
    reactions_check_received = reactions_check_received + CASE WHEN NEW.reaction_type = 'check' THEN 1 ELSE 0 END,
    reactions_this_week = CASE
      WHEN week_start IS NULL OR week_start < week_start_date THEN 1
      ELSE reactions_this_week + 1
    END,
    reactions_this_month = CASE
      WHEN month_start IS NULL OR month_start < month_start_date THEN 1
      ELSE reactions_this_month + 1
    END,
    week_start = week_start_date,
    month_start = month_start_date,
    updated_at = NOW()
  WHERE user_id = pulse_owner_id;

  -- Recalculate XP and level
  UPDATE user_stats us SET
    xp_total = (
      (us.pulse_count_total * 10) +
      (us.reactions_fire_received * 5) +
      (us.reactions_eyes_received * 3) +
      (us.reactions_check_received * 2) +
      (us.current_streak_days * 2)
    ),
    level = calculate_user_level(
      (us.pulse_count_total * 10) +
      (us.reactions_fire_received * 5) +
      (us.reactions_eyes_received * 3) +
      (us.reactions_check_received * 2) +
      (us.current_streak_days * 2)
    )
  WHERE user_id = pulse_owner_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_user_stats_on_reaction ON pulse_reactions;
CREATE TRIGGER trg_update_user_stats_on_reaction
  AFTER INSERT ON pulse_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_reaction();

-- ============================================================================
-- 9. FUNCTION: CHECK AND AWARD BADGES
-- Called after stats update to check if user earned new badges
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID)
RETURNS TABLE(badge_id TEXT, badge_name TEXT, badge_icon TEXT) AS $$
DECLARE
  stats user_stats%ROWTYPE;
  badge badge_definitions%ROWTYPE;
  already_has BOOLEAN;
BEGIN
  -- Get user stats
  SELECT * INTO stats FROM user_stats WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check each badge definition
  FOR badge IN SELECT * FROM badge_definitions ORDER BY display_order LOOP
    -- Skip if user already has this badge
    SELECT EXISTS(
      SELECT 1 FROM user_badges
      WHERE user_badges.user_id = p_user_id AND user_badges.badge_id = badge.id
    ) INTO already_has;

    IF already_has THEN
      CONTINUE;
    END IF;

    -- Check if user qualifies for this badge
    CASE badge.category
      WHEN 'category' THEN
        -- Category badges based on tag-specific counts
        IF badge.required_tag = 'Traffic' AND stats.pulse_count_traffic >= badge.required_pulse_count THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        ELSIF badge.required_tag = 'Weather' AND stats.pulse_count_weather >= badge.required_pulse_count THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        ELSIF badge.required_tag = 'Events' AND stats.pulse_count_events >= badge.required_pulse_count THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        ELSIF badge.required_tag = 'General' AND stats.pulse_count_general >= badge.required_pulse_count THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        END IF;

      WHEN 'milestone' THEN
        -- Milestone badges based on total pulse count
        IF stats.pulse_count_total >= badge.required_pulse_count THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        END IF;

      WHEN 'streak' THEN
        -- Streak badges
        IF stats.longest_streak_days >= badge.required_streak_days THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        END IF;

      WHEN 'achievement' THEN
        -- Achievement badges (various conditions)
        IF badge.id = 'first_pulse' AND stats.pulse_count_total >= 1 THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        ELSIF badge.id IN ('helpful_10', 'helpful_50', 'helpful_100', 'helpful_500')
              AND stats.reactions_received_total >= badge.required_reaction_count THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, badge.id);
          badge_id := badge.id; badge_name := badge.name; badge_icon := badge.icon;
          RETURN NEXT;
        END IF;
        -- Note: trendsetter, viral, early_bird, night_owl require special logic
        -- These are checked at pulse creation time in the API
    END CASE;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. FUNCTION: REFRESH LEADERBOARD CACHE
-- Should be called periodically (e.g., every 5 minutes via cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_leaderboard_cache(p_city TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  week_start_date DATE := date_trunc('week', CURRENT_DATE)::DATE;
  month_start_date DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  -- Clear existing cache for this city (or global if NULL)
  DELETE FROM leaderboard_cache WHERE city IS NOT DISTINCT FROM p_city;

  -- Weekly leaderboard
  INSERT INTO leaderboard_cache (user_id, username, period, city, rank, score, pulse_count, reaction_count)
  SELECT
    us.user_id,
    COALESCE(p.anon_name, 'Anonymous'),
    'weekly',
    p_city,
    ROW_NUMBER() OVER (ORDER BY (us.pulses_this_week * 2 + us.reactions_this_week) DESC),
    (us.pulses_this_week * 2 + us.reactions_this_week),
    us.pulses_this_week,
    us.reactions_this_week
  FROM user_stats us
  JOIN profiles p ON p.id = us.user_id
  WHERE us.week_start >= week_start_date
    AND (us.pulses_this_week > 0 OR us.reactions_this_week > 0)
  ORDER BY (us.pulses_this_week * 2 + us.reactions_this_week) DESC
  LIMIT 100;

  -- Monthly leaderboard
  INSERT INTO leaderboard_cache (user_id, username, period, city, rank, score, pulse_count, reaction_count)
  SELECT
    us.user_id,
    COALESCE(p.anon_name, 'Anonymous'),
    'monthly',
    p_city,
    ROW_NUMBER() OVER (ORDER BY (us.pulses_this_month * 2 + us.reactions_this_month) DESC),
    (us.pulses_this_month * 2 + us.reactions_this_month),
    us.pulses_this_month,
    us.reactions_this_month
  FROM user_stats us
  JOIN profiles p ON p.id = us.user_id
  WHERE us.month_start >= month_start_date
    AND (us.pulses_this_month > 0 OR us.reactions_this_month > 0)
  ORDER BY (us.pulses_this_month * 2 + us.reactions_this_month) DESC
  LIMIT 100;

  -- All-time leaderboard
  INSERT INTO leaderboard_cache (user_id, username, period, city, rank, score, pulse_count, reaction_count)
  SELECT
    us.user_id,
    COALESCE(p.anon_name, 'Anonymous'),
    'alltime',
    p_city,
    ROW_NUMBER() OVER (ORDER BY us.xp_total DESC),
    us.xp_total,
    us.pulse_count_total,
    us.reactions_received_total
  FROM user_stats us
  JOIN profiles p ON p.id = us.user_id
  WHERE us.pulse_count_total > 0
  ORDER BY us.xp_total DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. FUNCTION: GET USER LEADERBOARD RANK (for showing "You are #X")
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_leaderboard_rank(
  p_user_id UUID,
  p_period TEXT DEFAULT 'weekly',
  p_city TEXT DEFAULT NULL
)
RETURNS TABLE(rank INTEGER, score INTEGER, total_users INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.rank,
    lc.score,
    (SELECT COUNT(*)::INTEGER FROM leaderboard_cache WHERE period = p_period AND city IS NOT DISTINCT FROM p_city)
  FROM leaderboard_cache lc
  WHERE lc.user_id = p_user_id
    AND lc.period = p_period
    AND lc.city IS NOT DISTINCT FROM p_city;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. RLS POLICIES
-- ============================================================================

-- Badge definitions: Public read (anyone can see what badges exist)
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read badge definitions" ON badge_definitions;
CREATE POLICY "Public can read badge definitions" ON badge_definitions
  FOR SELECT TO anon, authenticated USING (true);

-- User badges: Public read (anyone can see what badges users have)
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read user badges" ON user_badges;
CREATE POLICY "Public can read user badges" ON user_badges
  FOR SELECT TO anon, authenticated USING (true);

-- User stats: Public read (for leaderboards)
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read user stats" ON user_stats;
CREATE POLICY "Public can read user stats" ON user_stats
  FOR SELECT TO anon, authenticated USING (true);

-- Leaderboard cache: Public read
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read leaderboard" ON leaderboard_cache;
CREATE POLICY "Public can read leaderboard" ON leaderboard_cache
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================================
-- 13. GRANTS
-- ============================================================================

GRANT SELECT ON TABLE badge_definitions TO anon, authenticated;
GRANT SELECT ON TABLE user_badges TO anon, authenticated;
GRANT SELECT ON TABLE user_stats TO anon, authenticated;
GRANT SELECT ON TABLE leaderboard_cache TO anon, authenticated;

-- Service role needs full access for triggers and functions
GRANT ALL PRIVILEGES ON TABLE badge_definitions TO service_role;
GRANT ALL PRIVILEGES ON TABLE user_badges TO service_role;
GRANT ALL PRIVILEGES ON TABLE user_stats TO service_role;
GRANT ALL PRIVILEGES ON TABLE leaderboard_cache TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- 14. COMMENTS
-- ============================================================================

COMMENT ON TABLE badge_definitions IS 'Static definitions of all achievable badges in the gamification system';
COMMENT ON TABLE user_badges IS 'Tracks which badges each user has earned';
COMMENT ON TABLE user_stats IS 'Aggregated user statistics for leaderboards and badge calculations';
COMMENT ON TABLE leaderboard_cache IS 'Pre-computed leaderboard rankings, refreshed periodically';
COMMENT ON FUNCTION calculate_user_level IS 'Converts XP to level (1-100) using sqrt curve';
COMMENT ON FUNCTION check_and_award_badges IS 'Checks if user qualifies for new badges and awards them';
COMMENT ON FUNCTION refresh_leaderboard_cache IS 'Rebuilds the leaderboard cache for a given city';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
