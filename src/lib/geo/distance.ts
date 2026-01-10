/**
 * Geographic Distance Utilities
 *
 * Consolidates all distance calculation logic into one place.
 * Uses the Haversine formula for accurate great-circle distances.
 */

import { RADIUS_CONFIG } from "@/lib/constants/radius";

export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function calculateDistanceMiles(
  from: Coordinates,
  to: Coordinates
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance in kilometers
 */
export function calculateDistanceKm(
  from: Coordinates,
  to: Coordinates
): number {
  return calculateDistanceMiles(from, to) * RADIUS_CONFIG.MILES_TO_KM;
}

/**
 * Check if a point is within the primary radius
 */
export function isWithinRadius(
  center: Coordinates,
  point: Coordinates,
  radiusMiles: number = RADIUS_CONFIG.PRIMARY_RADIUS_MILES
): boolean {
  return calculateDistanceMiles(center, point) <= radiusMiles;
}

/**
 * Check if a point is within the primary 10-mile radius
 */
export function isWithinPrimaryRadius(
  center: Coordinates,
  point: Coordinates
): boolean {
  return isWithinRadius(center, point, RADIUS_CONFIG.PRIMARY_RADIUS_MILES);
}

/**
 * Format distance for display
 * @returns "X.X mi" or "X mi" for whole numbers
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles >= 100) return `${Math.round(miles)} mi`;
  if (Number.isInteger(miles)) return `${miles} mi`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Get distance callout text for out-of-radius content
 * @example getDistanceCallout(15, "Austin") → "Austin, 15 mi away"
 * @example getDistanceCallout(12.5) → "12.5 mi away"
 */
export function getDistanceCallout(
  miles: number,
  locationName?: string
): string {
  const formatted = formatDistance(miles);
  if (locationName) {
    return `${locationName}, ${formatted} away`;
  }
  return `${formatted} away`;
}

/**
 * Get bounding box for efficient database queries
 * Returns min/max lat/lon that encompasses a circle of given radius
 */
export function getBoundingBox(
  center: Coordinates,
  radiusMiles: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  // Approximate: 1 degree latitude = 69 miles
  const latDelta = radiusMiles / 69;
  // Longitude varies by latitude
  const lonDelta = radiusMiles / (69 * Math.cos(toRadians(center.lat)));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLon: center.lon - lonDelta,
    maxLon: center.lon + lonDelta,
  };
}

/**
 * Categorize distance for UI styling
 * @returns "local" (<10mi), "nearby" (10-25mi), or "distant" (25-50mi)
 */
export function categorizeDistance(
  miles: number
): "local" | "nearby" | "distant" {
  if (miles <= RADIUS_CONFIG.PRIMARY_RADIUS_MILES) {
    return "local";
  }
  if (miles <= 25) {
    return "nearby";
  }
  return "distant";
}
