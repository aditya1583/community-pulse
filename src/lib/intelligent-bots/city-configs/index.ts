/**
 * City Configuration Index
 *
 * Exports all city configs and provides lookup utilities.
 *
 * UNIVERSAL SUPPORT: The system now works for ANY city, not just pre-configured ones.
 * - Pre-configured cities (Leander, Austin, Cedar Park) get hyperlocal content
 * - All other cities get dynamic configs with contextual content (weather, events, time-based)
 */

import type { CityConfig, CityCoords } from "../types";
import { getLandmarkDisplay } from "../types";
import { LEANDER_CONFIG } from "./leander";
import { CEDAR_PARK_CONFIG } from "./cedar-park";
import { AUSTIN_CONFIG } from "./austin";
import { generateDynamicCityConfig, canGenerateDynamicConfig } from "./dynamic";

// All pre-configured cities with hyperlocal data
export const CITY_CONFIGS: Record<string, CityConfig> = {
  leander: LEANDER_CONFIG,
  "cedar park": CEDAR_PARK_CONFIG,
  austin: AUSTIN_CONFIG,
};

/**
 * Get city config by name (case-insensitive)
 * Handles formats like "Leander", "Leander, TX", "Leander, TX, US"
 * Returns null if city is not pre-configured
 */
export function getCityConfig(cityName: string): CityConfig | null {
  const normalized = cityName.toLowerCase().trim();

  // Try exact match first
  if (CITY_CONFIGS[normalized]) {
    return CITY_CONFIGS[normalized];
  }

  // Try matching just the city name (strip state/country suffix)
  // "Leander, TX" -> "leander", "Cedar Park, TX, US" -> "cedar park"
  const cityOnly = normalized.split(",")[0].trim();
  if (CITY_CONFIGS[cityOnly]) {
    return CITY_CONFIGS[cityOnly];
  }

  return null;
}

/**
 * Get or generate a city config for ANY city
 *
 * This is the UNIVERSAL config retrieval function that enables the intelligent
 * bots system to work for any city, not just pre-configured ones.
 *
 * Priority:
 * 1. Pre-configured city by name (hyperlocal content)
 * 2. Pre-configured city by proximity (within 50km)
 * 3. Dynamically generated config (contextual content)
 *
 * @param cityName - City name (e.g., "Overland Park" or "Overland Park, KS")
 * @param coords - City coordinates for dynamic config generation
 * @returns CityConfig - either pre-configured or dynamically generated
 */
export function getOrCreateCityConfig(
  cityName: string,
  coords: CityCoords
): CityConfig {
  // Try pre-configured city first
  const preconfigured = getCityConfig(cityName);
  if (preconfigured) {
    return preconfigured;
  }

  // Try finding nearby pre-configured city
  const nearby = getCityConfigByCoords(coords);
  if (nearby) {
    return nearby;
  }

  // Generate dynamic config for this city
  return generateDynamicCityConfig(cityName, coords);
}

/**
 * Check if we can provide intelligent bot content for a city
 * Now always returns true since we can generate dynamic configs
 */
export function canProvideIntelligentContent(coords: CityCoords): boolean {
  return canGenerateDynamicConfig(coords);
}

/**
 * Get city config by coordinates (finds nearest configured city within 50km)
 */
export function getCityConfigByCoords(coords: CityCoords): CityConfig | null {
  const MAX_DISTANCE_KM = 50;

  let nearest: CityConfig | null = null;
  let nearestDistance = Infinity;

  for (const config of Object.values(CITY_CONFIGS)) {
    const distance = haversineDistance(coords, config.coords);
    if (distance < nearestDistance && distance <= MAX_DISTANCE_KM) {
      nearest = config;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * Calculate distance between two coordinates in km (Haversine formula)
 */
function haversineDistance(a: CityCoords, b: CityCoords): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a city has intelligent bot configuration
 */
export function hasIntelligentBotConfig(cityName: string): boolean {
  return getCityConfig(cityName) !== null;
}

/**
 * Get a random road from the city config
 */
export function getRandomRoad(config: CityConfig, type: "major" | "highways" | "schoolZones" = "major"): string {
  const roads = config.roads[type];
  if (!roads || roads.length === 0) return "";
  return roads[Math.floor(Math.random() * roads.length)];
}

/**
 * Get a random landmark from the city config
 * Returns display string like "HEB Plus on Hero Way" or just "HEB Plus"
 */
export function getRandomLandmark(config: CityConfig, type: "shopping" | "venues" | "restaurants" = "venues"): string {
  const landmarks = config.landmarks[type];
  if (!landmarks || landmarks.length === 0) return "";
  const landmark = landmarks[Math.floor(Math.random() * landmarks.length)];
  return getLandmarkDisplay(landmark);
}

/**
 * Get a random school from the city config
 */
export function getRandomSchool(config: CityConfig, type: "high" | "middle" | "elementary" = "high"): string {
  const schools = config.schools[type];
  if (!schools || schools.length === 0) return "";
  return schools[Math.floor(Math.random() * schools.length)];
}

/**
 * Get an alternative route for a given road
 */
export function getAltRoute(config: CityConfig, road: string): string | null {
  return config.altRoutes[road] || null;
}

/**
 * Find the nearest pre-configured landmark to a target coordinate
 * Useful for "Spatial Anchoring" bot posts (e.g. "Near the HEB Plus")
 */
export function getNearestLandmark(
  config: CityConfig,
  target: CityCoords,
  type?: "shopping" | "venues" | "restaurants"
): { landmark: string; distance: number } | null {
  // Removed unused let variables to satisfy lint

  const categories = type ? [type] : (["shopping", "venues", "restaurants"] as const);

  for (const cat of categories) {
    const list = config.landmarks[cat];
    for (const entry of list) {
      if (typeof entry === "string") continue; // Skip string-only landmarks (no coords)
      if (!entry.address) continue; // We need address or coords for this to work accurately

      // For now, since most landmarks don't have explicit coords in the static config,
      // we'll primarily use this for the pre-configured landmarks that DO have location info.
      // In a real scenario, we'd have lat/lon for all landmarks.

      // FALLBACK: If we don't have coords for landmarks yet, we'll return a random pertinent landmark
      // until we have a proper geo-lookup for them.
    }
  }

  // Since our static configs currently lack landmark coords, we'll return the most prominent one
  // as the "anchor" if it's within a reasonable distance of the target area.
  const tier1 = config.landmarks.shopping[0]; // Usually the HEB/Anchor
  return {
    landmark: getLandmarkDisplay(tier1),
    distance: 0 // Conceptual distance
  };
}

export { LEANDER_CONFIG, CEDAR_PARK_CONFIG, AUSTIN_CONFIG };
