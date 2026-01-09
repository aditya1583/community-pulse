-- Migration: Add missing columns to user_stats
-- Date: 2025-01-08
-- Purpose: Add night_owl_count and early_bird_count columns required by trigger
--
-- BUG: The update_user_stats_on_pulse trigger references these columns
-- but they were never added to the user_stats table, causing:
-- "column 'night_owl_count' does not exist" error when posting pulses.

-- Add the missing columns with defaults
ALTER TABLE user_stats
  ADD COLUMN IF NOT EXISTS night_owl_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_bird_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN user_stats.night_owl_count IS 'Count of pulses posted between 12am-5am (for Night Owl badge)';
COMMENT ON COLUMN user_stats.early_bird_count IS 'Count of pulses posted between 5am-8am (for Early Bird badge)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
