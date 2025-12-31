-- =====================================================
-- ADD CITY COLUMN TO VENUE_VIBES
-- =====================================================
-- This migration adds city filtering capability to venue vibes
-- so vibes from one city don't show up in another city
-- =====================================================

-- Add city column
ALTER TABLE venue_vibes ADD COLUMN IF NOT EXISTS city TEXT;

-- Create index for city filtering
CREATE INDEX IF NOT EXISTS idx_venue_vibes_city ON venue_vibes(city);

-- Backfill existing vibes (mark as unknown city, they'll expire anyway)
UPDATE venue_vibes SET city = 'Unknown' WHERE city IS NULL;
