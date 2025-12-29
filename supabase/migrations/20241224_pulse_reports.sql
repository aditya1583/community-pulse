-- Migration: Pulse Reports for Community Moderation
-- Date: 2024-12-24
-- Purpose: Add pulse reporting system with auto-hide after 3 reports

-- ============================================================================
-- 1. ADD HIDDEN COLUMN TO PULSES TABLE
-- ============================================================================

ALTER TABLE pulses ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;

-- Create index for efficient filtering of non-hidden pulses
CREATE INDEX IF NOT EXISTS idx_pulses_hidden ON pulses(hidden) WHERE hidden = FALSE;

-- ============================================================================
-- 2. CREATE PULSE_REPORTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pulse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,

  -- Prevent duplicate reports from same user on same pulse
  UNIQUE(pulse_id, reporter_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pulse_reports_pulse_id ON pulse_reports(pulse_id);
CREATE INDEX IF NOT EXISTS idx_pulse_reports_created_at ON pulse_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_reports_unreviewed ON pulse_reports(reviewed) WHERE reviewed = FALSE;

-- ============================================================================
-- 3. RLS POLICIES FOR PULSE_REPORTS
-- ============================================================================

-- Enable RLS
ALTER TABLE pulse_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can create reports" ON pulse_reports
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON pulse_reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

-- ============================================================================
-- 4. AUTO-HIDE TRIGGER FUNCTION
-- When a pulse receives 3 or more reports, automatically hide it
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_hide_reported_pulse()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  -- Count total reports for this pulse
  SELECT COUNT(*) INTO report_count
  FROM pulse_reports
  WHERE pulse_id = NEW.pulse_id;

  -- If 3 or more reports, hide the pulse
  IF report_count >= 3 THEN
    UPDATE pulses
    SET hidden = TRUE
    WHERE id = NEW.pulse_id
    AND hidden = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run after each report insert
DROP TRIGGER IF EXISTS trigger_auto_hide_pulse ON pulse_reports;
CREATE TRIGGER trigger_auto_hide_pulse
  AFTER INSERT ON pulse_reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_hide_reported_pulse();

-- ============================================================================
-- 5. UPDATE PULSES SELECT POLICY TO EXCLUDE HIDDEN
-- Only show non-hidden pulses to public
-- ============================================================================

-- Drop and recreate the public read policy to exclude hidden pulses
DROP POLICY IF EXISTS "Public can read all pulses" ON pulses;

CREATE POLICY "Public can read visible pulses" ON pulses
  FOR SELECT
  USING (hidden = FALSE OR hidden IS NULL);

-- ============================================================================
-- 6. HELPER FUNCTION: GET REPORT COUNT FOR A PULSE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pulse_report_count(p_pulse_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM pulse_reports
  WHERE pulse_id = p_pulse_id;
  RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
