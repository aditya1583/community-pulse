-- Migration: Add Road Closure and Weather Alert Notification Types
-- Date: 2026-01-21

-- 1. Add columns to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS road_closures_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS weather_alerts_enabled BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_notification_prefs_closures ON notification_preferences(city) WHERE road_closures_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_prefs_weather ON notification_preferences(city) WHERE weather_alerts_enabled = TRUE;

-- 2. Update CHECK constraint on notification_log
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_notification_type_check;
ALTER TABLE notification_log ADD CONSTRAINT notification_log_notification_type_check
CHECK (notification_type IN ('vibe_shift', 'spike_alert', 'keyword_cluster', 'engagement_prompt', 'road_closure', 'weather_alert'));

-- 3. Update get_notification_subscribers function
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
      OR (p_notification_type = 'road_closure' AND np.road_closures_enabled = TRUE)
      OR (p_notification_type = 'weather_alert' AND np.weather_alerts_enabled = TRUE)
      OR (p_notification_type = 'engagement_prompt' AND np.spike_alerts_enabled = TRUE)
    )
    AND (
      np.quiet_hours_start IS NULL
      OR np.quiet_hours_end IS NULL
      OR NOT (
        (NOW() AT TIME ZONE COALESCE(np.timezone, 'America/Chicago'))::TIME
        BETWEEN np.quiet_hours_start AND np.quiet_hours_end
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM notification_log nl
      WHERE nl.user_id = np.user_id
        AND nl.city = p_city
        AND nl.notification_type = p_notification_type
        AND nl.created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
