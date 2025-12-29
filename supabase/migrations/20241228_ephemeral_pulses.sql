-- Migration: Ephemeral Pulses System
-- Date: 2024-12-28
-- Purpose: Add content decay based on category for fresh, urgent feeds
--
-- Philosophy:
--   - Stale feeds signal a dead app
--   - Time-sensitive content (traffic) shouldn't linger for days
--   - If users know content disappears, they check more frequently (FOMO)
--   - Decay should feel natural, not abrupt
--
-- Decay Rules:
--   | Category | Lifespan |
--   |----------|----------|
--   | Traffic  | 2 hours  |
--   | Weather  | 4 hours  |
--   | Events   | 24 hours |
--   | General  | 24 hours |
--
-- Grace Period:
--   - After "expiry", pulses remain visible for 1 additional hour (faded)
--   - This prevents jarring disappearance and gives users context
--   - Final deletion happens via cleanup job, not instant removal

-- ============================================================================
-- 1. ADD EXPIRES_AT COLUMN TO PULSES TABLE
-- ============================================================================

-- Add the expiry timestamp column
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index for efficient filtering of non-expired pulses
-- This index excludes already-expired pulses for faster queries
CREATE INDEX IF NOT EXISTS idx_pulses_expires_at ON pulses(expires_at)
  WHERE expires_at IS NULL OR expires_at > NOW();

-- Create index for cleanup job to find truly expired pulses (past grace period)
CREATE INDEX IF NOT EXISTS idx_pulses_expired_for_cleanup ON pulses(expires_at)
  WHERE expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '1 hour';

-- ============================================================================
-- 2. LIFESPAN CONFIGURATION FUNCTION
-- Returns lifespan interval based on tag category
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pulse_lifespan(p_tag TEXT)
RETURNS INTERVAL AS $$
BEGIN
  RETURN CASE p_tag
    WHEN 'Traffic' THEN INTERVAL '2 hours'
    WHEN 'Weather' THEN INTERVAL '4 hours'
    WHEN 'Events'  THEN INTERVAL '24 hours'
    WHEN 'General' THEN INTERVAL '24 hours'
    ELSE INTERVAL '24 hours'  -- Default fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_pulse_lifespan(TEXT) IS
  'Returns the lifespan interval for a pulse based on its tag category';

-- ============================================================================
-- 3. AUTO-CALCULATE EXPIRY TRIGGER
-- Automatically sets expires_at based on tag when pulse is created
-- ============================================================================

CREATE OR REPLACE FUNCTION set_pulse_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set expires_at if not already set (allows manual override if needed)
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + get_pulse_lifespan(NEW.tag);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotent migrations)
DROP TRIGGER IF EXISTS trigger_set_pulse_expiry ON pulses;

-- Create trigger to run before insert
CREATE TRIGGER trigger_set_pulse_expiry
  BEFORE INSERT ON pulses
  FOR EACH ROW
  EXECUTE FUNCTION set_pulse_expiry();

-- ============================================================================
-- 4. BACKFILL EXISTING PULSES
-- Set expires_at for pulses that don't have it yet
-- ============================================================================

UPDATE pulses
SET expires_at = created_at + get_pulse_lifespan(tag)
WHERE expires_at IS NULL;

-- ============================================================================
-- 5. ACTIVE PULSES VIEW (Optional convenience view)
-- Shows only pulses that are still "alive" (not past grace period)
-- ============================================================================

CREATE OR REPLACE VIEW active_pulses AS
SELECT *
FROM pulses
WHERE hidden = FALSE
  AND (
    expires_at IS NULL  -- Legacy pulses without expiry
    OR expires_at > NOW() - INTERVAL '1 hour'  -- Within grace period
  );

COMMENT ON VIEW active_pulses IS
  'Pulses that are still active (not expired past grace period)';

-- ============================================================================
-- 6. UPDATE RLS POLICY TO RESPECT EXPIRY (Optional)
-- Instead of modifying RLS, we'll filter in queries for more flexibility
-- This allows clients to handle "fading" pulses gracefully
-- ============================================================================

-- Note: We intentionally do NOT modify RLS to hide expired pulses.
-- This allows the client to:
--   1. Show pulses in a "faded" state during grace period
--   2. Filter client-side for immediate feedback
--   3. Query for recently-expired pulses if needed (e.g., for debugging)
--
-- The API layer will handle expiry filtering.

-- ============================================================================
-- 7. HELPER FUNCTIONS FOR CLIENT
-- ============================================================================

-- Function to check if a pulse is expired (past hard expiry)
CREATE OR REPLACE FUNCTION is_pulse_expired(p_expires_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_expires_at IS NOT NULL AND p_expires_at <= NOW();
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if pulse is in grace period (fading)
CREATE OR REPLACE FUNCTION is_pulse_fading(p_expires_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_expires_at IS NOT NULL
    AND p_expires_at <= NOW()
    AND p_expires_at > NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get remaining time until expiry (in seconds)
-- Returns NULL if no expiry, negative if expired
CREATE OR REPLACE FUNCTION get_pulse_remaining_seconds(p_expires_at TIMESTAMPTZ)
RETURNS INTEGER AS $$
BEGIN
  IF p_expires_at IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN EXTRACT(EPOCH FROM (p_expires_at - NOW()))::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. CLEANUP FUNCTION (To be called by cron job or edge function)
-- Soft deletes pulses that are past the grace period
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_pulses()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Hide (soft delete) pulses that are more than 1 hour past expiry
  -- We don't hard delete to preserve history for analytics
  UPDATE pulses
  SET hidden = TRUE
  WHERE hidden = FALSE
    AND expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup action
  RAISE NOTICE 'Cleaned up % expired pulses', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_pulses() IS
  'Soft deletes pulses that are more than 1 hour past their expiry time. Call via cron or edge function.';

-- ============================================================================
-- 9. EXPIRY STATISTICS FUNCTION (For debugging/monitoring)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_expiry_stats()
RETURNS TABLE(
  category TEXT,
  total_count BIGINT,
  active_count BIGINT,
  expiring_soon BIGINT,  -- Within 30 minutes
  in_grace_period BIGINT,
  expired_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.tag::TEXT as category,
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE p.expires_at > NOW())::BIGINT as active_count,
    COUNT(*) FILTER (WHERE p.expires_at > NOW() AND p.expires_at <= NOW() + INTERVAL '30 minutes')::BIGINT as expiring_soon,
    COUNT(*) FILTER (WHERE p.expires_at <= NOW() AND p.expires_at > NOW() - INTERVAL '1 hour')::BIGINT as in_grace_period,
    COUNT(*) FILTER (WHERE p.expires_at <= NOW() - INTERVAL '1 hour')::BIGINT as expired_count
  FROM pulses p
  WHERE p.hidden = FALSE
  GROUP BY p.tag
  ORDER BY p.tag;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
