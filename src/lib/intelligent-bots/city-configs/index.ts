/**
 * City Configuration Index
 *
 * Exports all city configs and provides lookup utilities
 */

import type { CityConfig, CityCoords } from "../types";
import { LEANDER_CONFIG } from "./leander";
import { CEDAR_PARK_CONFIG } from "./cedar-park";
import { AUSTIN_CONFIG } from "./austin";

// All configured cities
export const CITY_CONFIGS: Record<string, CityConfig> = {
  leander: LEANDER_CONFIG,
  "cedar park": CEDAR_PARK_CONFIG,
  austin: AUSTIN_CONFIG,
};

/**
 * Get city config by name (case-insensitive)
 */
export function getCityConfig(cityName: string): CityConfig | null {
  const normalized = cityName.toLowerCase().trim();
  return CITY_CONFIGS[normalized] || null;
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
  return roads[Math.floor(Math.random() * roads.length)];
}

/**
 * Get a random landmark from the city config
 */
export function getRandomLandmark(config: CityConfig, type: "shopping" | "venues" | "restaurants" = "venues"): string {
  const landmarks = config.landmarks[type];
  return landmarks[Math.floor(Math.random() * landmarks.length)];
}

/**
 * Get a random school from the city config
 */
export function getRandomSchool(config: CityConfig, type: "high" | "middle" | "elementary" = "high"): string {
  const schools = config.schools[type];
  return schools[Math.floor(Math.random() * schools.length)];
}

/**
 * Get an alternative route for a given road
 */
export function getAltRoute(config: CityConfig, road: string): string | null {
  return config.altRoutes[road] || null;
}

export { LEANDER_CONFIG, CEDAR_PARK_CONFIG, AUSTIN_CONFIG };
