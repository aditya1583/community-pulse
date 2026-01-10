-- Migration: Add coordinate columns to pulses for distance-based filtering
-- Date: 2026-01-09
-- Purpose: Enable true 10-mile radius filtering instead of city-name matching

-- Add latitude and longitude columns to pulses table
ALTER TABLE pulses
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;

-- Create spatial index for efficient distance queries
-- Only index rows that have coordinates
CREATE INDEX IF NOT EXISTS idx_pulses_coordinates
ON pulses (lat, lon)
WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN pulses.lat IS 'Latitude where pulse was created (for distance filtering)';
COMMENT ON COLUMN pulses.lon IS 'Longitude where pulse was created (for distance filtering)';

-- Backfill coordinates from city name using known city centers
-- This gives approximate location for existing pulses
UPDATE pulses SET
  lat = CASE
    WHEN city ILIKE 'Leander%' THEN 30.5788
    WHEN city ILIKE 'Cedar Park%' THEN 30.5052
    WHEN city ILIKE 'Austin%' THEN 30.2672
    WHEN city ILIKE 'Round Rock%' THEN 30.5083
    WHEN city ILIKE 'Georgetown%' THEN 30.6333
    WHEN city ILIKE 'Pflugerville%' THEN 30.4394
    WHEN city ILIKE 'Kyle%' THEN 29.9894
    WHEN city ILIKE 'San Marcos%' THEN 29.8833
    WHEN city ILIKE 'Buda%' THEN 30.0852
    WHEN city ILIKE 'Hutto%' THEN 30.5427
    WHEN city ILIKE 'Taylor%' THEN 30.5708
    WHEN city ILIKE 'Lakeway%' THEN 30.3641
    WHEN city ILIKE 'Dripping Springs%' THEN 30.1902
    WHEN city ILIKE 'Bee Cave%' THEN 30.3085
    WHEN city ILIKE 'Manor%' THEN 30.3416
    ELSE NULL
  END,
  lon = CASE
    WHEN city ILIKE 'Leander%' THEN -97.8531
    WHEN city ILIKE 'Cedar Park%' THEN -97.8203
    WHEN city ILIKE 'Austin%' THEN -97.7431
    WHEN city ILIKE 'Round Rock%' THEN -97.6789
    WHEN city ILIKE 'Georgetown%' THEN -97.6780
    WHEN city ILIKE 'Pflugerville%' THEN -97.6200
    WHEN city ILIKE 'Kyle%' THEN -97.8772
    WHEN city ILIKE 'San Marcos%' THEN -97.9414
    WHEN city ILIKE 'Buda%' THEN -97.8403
    WHEN city ILIKE 'Hutto%' THEN -97.5467
    WHEN city ILIKE 'Taylor%' THEN -97.4097
    WHEN city ILIKE 'Lakeway%' THEN -97.9797
    WHEN city ILIKE 'Dripping Springs%' THEN -98.0867
    WHEN city ILIKE 'Bee Cave%' THEN -97.9469
    WHEN city ILIKE 'Manor%' THEN -97.5567
    ELSE NULL
  END
WHERE lat IS NULL AND lon IS NULL;
