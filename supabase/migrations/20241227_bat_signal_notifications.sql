-- Migration: Bat Signal Notification System
-- Date: 2024-12-27
-- Purpose: Smart geo-alerts that give users a reason to open the app
--
-- The Vision:
-- Users shouldn't have to remember to open the app.
-- The app should buzz their pocket when something worth knowing is happening.

-- ============================================================================
-- 1. NOTIFICATION PREFERENCES TABLE
-- Users control what notifications they receive
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- City to monitor (matches pulses.city)
  city TEXT NOT NULL,

  -- Notification types (all default to true for new subscribers)
  vibe_shifts_enabled BOOLEAN DEFAULT TRUE,      -- "The vibe just shifted from Calm to Chaotic"
  spike_alerts_enabled BOOLEAN DEFAULT TRUE,     -- "Something is happening in Leander"
  keyword_alerts_enabled BOOLEAN DEFAULT FALSE,  -- "3 people posted about 'Police'"

  -- Keyword configuration (JSONB array of strings)
  -- Example: ["police", "fire", "accident", "road closed"]
  alert_keywords JSONB DEFAULT '[]'::jsonb,

  -- Radius in miles for keyword clustering (default 1 mile)
  keyword_radius_miles NUMERIC(4,1) DEFAULT 1.0,

  -- Spike detection threshold (percentage increase, default 200%)
  spike_threshold_percent INTEGER DEFAULT 200,

  -- Quiet hours (don't send notifications during these times)
  quiet_hours_start TIME DEFAULT NULL,  -- e.g., '22:00'
  quiet_hours_end TIME DEFAULT NULL,    -- e.g., '07:00'

  -- Timezone for quiet hours
  timezone TEXT DEFAULT 'America/Chicago',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One preference set per user per city
  UNIQUE(user_id, city)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_city ON notification_preferences(city);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_enabled ON notification_preferences(city)
  WHERE vibe_shifts_enabled = TRUE OR spike_alerts_enabled = TRUE OR keyword_alerts_enabled = TRUE;

-- ============================================================================
-- 2. PUSH SUBSCRIPTIONS TABLE
-- Web Push API subscription data (VAPID)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Web Push subscription object (contains endpoint, keys)
  -- Format: { endpoint: string, keys: { p256dh: string, auth: string } }
  subscription JSONB NOT NULL,

  -- Unique endpoint to prevent duplicate subscriptions
  endpoint TEXT GENERATED ALWAYS AS (subscription->>'endpoint') STORED NOT NULL,

  -- Device/browser identifier (optional, for multi-device management)
  device_name TEXT,
  user_agent TEXT,

  -- Subscription status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  -- Track delivery issues
  consecutive_failures INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One subscription per endpoint
  UNIQUE(endpoint)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(user_id) WHERE is_active = TRUE;

-- ============================================================================
-- 3. VIBE VELOCITY STATS TABLE
-- Tracks pulse activity per city per hour for anomaly detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS vibe_velocity_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,

  -- Hour bucket (truncated to hour)
  hour_bucket TIMESTAMPTZ NOT NULL,

  -- Pulse count in this hour
  pulse_count INTEGER DEFAULT 0,

  -- Rolling average (updated by cron job)
  rolling_avg_7d NUMERIC(6,2),

  -- Dominant mood in this hour
  dominant_mood TEXT,
  dominant_mood_percent INTEGER,

  -- Intensity calculated at end of hour
  vibe_intensity TEXT CHECK (vibe_intensity IN ('quiet', 'active', 'buzzing', 'intense')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per city per hour
  UNIQUE(city, hour_bucket)
);

-- Indexes for efficient time-series queries
CREATE INDEX IF NOT EXISTS idx_vibe_velocity_city_time ON vibe_velocity_stats(city, hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_vibe_velocity_recent ON vibe_velocity_stats(hour_bucket DESC);

-- ============================================================================
-- 4. NOTIFICATION LOG TABLE
-- Track sent notifications to prevent spam and enable analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who received it
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,

  -- What type
  notification_type TEXT NOT NULL CHECK (notification_type IN ('vibe_shift', 'spike_alert', 'keyword_cluster')),

  -- Context
  city TEXT NOT NULL,

  -- Payload sent (for debugging and analytics)
  payload JSONB NOT NULL,

  -- Delivery status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'clicked')),

  -- Tracking
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics and rate limiting
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_city ON notification_log(city, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type, created_at DESC);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_velocity_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Notification Preferences: Users can only access their own
CREATE POLICY "Users can view own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notification preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences" ON notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Push Subscriptions: Users can only access their own
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Vibe Velocity Stats: Public read (it's aggregate data, no PII)
CREATE POLICY "Public can read vibe velocity stats" ON vibe_velocity_stats
  FOR SELECT USING (true);

-- Notification Log: Users can only see their own
CREATE POLICY "Users can view own notification log" ON notification_log
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to update vibe velocity stats when a pulse is created
CREATE OR REPLACE FUNCTION update_vibe_velocity_on_pulse()
RETURNS TRIGGER AS $$
DECLARE
  hour_start TIMESTAMPTZ;
BEGIN
  -- Truncate to current hour
  hour_start := date_trunc('hour', NEW.created_at);

  -- Upsert into vibe_velocity_stats
  INSERT INTO vibe_velocity_stats (city, hour_bucket, pulse_count)
  VALUES (NEW.city, hour_start, 1)
  ON CONFLICT (city, hour_bucket)
  DO UPDATE SET
    pulse_count = vibe_velocity_stats.pulse_count + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on pulse insert
DROP TRIGGER IF EXISTS trigger_update_vibe_velocity ON pulses;
CREATE TRIGGER trigger_update_vibe_velocity
  AFTER INSERT ON pulses
  FOR EACH ROW
  EXECUTE FUNCTION update_vibe_velocity_on_pulse();

-- Function to check if a spike alert should fire
-- Returns TRUE if current hour pulse count exceeds threshold vs rolling average
CREATE OR REPLACE FUNCTION check_spike_alert(
  p_city TEXT,
  p_threshold_percent INTEGER DEFAULT 200
)
RETURNS BOOLEAN AS $$
DECLARE
  current_hour_count INTEGER;
  rolling_avg NUMERIC;
  hour_start TIMESTAMPTZ;
BEGIN
  hour_start := date_trunc('hour', NOW());

  -- Get current hour count
  SELECT pulse_count INTO current_hour_count
  FROM vibe_velocity_stats
  WHERE city = p_city AND hour_bucket = hour_start;

  IF current_hour_count IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Calculate rolling average from past 7 days, same hour of day
  -- This accounts for daily patterns (rush hour, etc.)
  SELECT AVG(pulse_count) INTO rolling_avg
  FROM vibe_velocity_stats
  WHERE city = p_city
    AND hour_bucket < hour_start
    AND hour_bucket >= hour_start - INTERVAL '7 days'
    AND EXTRACT(HOUR FROM hour_bucket) = EXTRACT(HOUR FROM hour_start);

  -- If no historical data, use simple threshold of 5+ pulses
  IF rolling_avg IS NULL OR rolling_avg < 1 THEN
    RETURN current_hour_count >= 5;
  END IF;

  -- Check if current count exceeds threshold
  RETURN (current_hour_count::NUMERIC / rolling_avg * 100) >= p_threshold_percent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscribers for a city who should receive a specific notification type
CREATE OR REPLACE FUNCTION get_notification_subscribers(
  p_city TEXT,
  p_notification_type TEXT
)
RETURNS TABLE (
  user_id UUID,
  subscription JSONB,
  subscription_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.user_id,
    ps.subscription,
    ps.id as subscription_id
  FROM notification_preferences np
  INNER JOIN push_subscriptions ps ON ps.user_id = np.user_id AND ps.is_active = TRUE
  WHERE np.city = p_city
    AND (
      (p_notification_type = 'vibe_shift' AND np.vibe_shifts_enabled = TRUE)
      OR (p_notification_type = 'spike_alert' AND np.spike_alerts_enabled = TRUE)
      OR (p_notification_type = 'keyword_cluster' AND np.keyword_alerts_enabled = TRUE)
    )
    -- Respect quiet hours
    AND (
      np.quiet_hours_start IS NULL
      OR np.quiet_hours_end IS NULL
      OR NOT (
        (NOW() AT TIME ZONE COALESCE(np.timezone, 'America/Chicago'))::TIME
        BETWEEN np.quiet_hours_start AND np.quiet_hours_end
      )
    )
    -- Don't spam - no more than 1 notification per type per hour
    AND NOT EXISTS (
      SELECT 1 FROM notification_log nl
      WHERE nl.user_id = np.user_id
        AND nl.city = p_city
        AND nl.notification_type = p_notification_type
        AND nl.created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_vibe_velocity_updated_at ON vibe_velocity_stats;
CREATE TRIGGER trigger_vibe_velocity_updated_at
  BEFORE UPDATE ON vibe_velocity_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
