-- Migration: Fix notification_log CHECK constraint
-- Date: 2025-01-08
-- Purpose: Add 'engagement_prompt' to allowed notification types
--
-- BUG: The original migration only allowed 3 notification types,
-- but the code sends 'engagement_prompt' for daily prompts.
-- This caused all engagement prompts to fail with constraint violation.

-- Drop and recreate the constraint to include engagement_prompt
ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_notification_type_check;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_notification_type_check
  CHECK (notification_type IN ('vibe_shift', 'spike_alert', 'keyword_cluster', 'engagement_prompt'));

-- Also update the get_notification_subscribers function to handle engagement_prompt
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
      -- Engagement prompts go to anyone with any notification enabled
      OR (p_notification_type = 'engagement_prompt' AND (
        np.vibe_shifts_enabled = TRUE
        OR np.spike_alerts_enabled = TRUE
        OR np.keyword_alerts_enabled = TRUE
      ))
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
-- END OF MIGRATION
-- ============================================================================
