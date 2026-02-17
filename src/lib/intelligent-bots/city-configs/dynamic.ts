/**
 * Dynamic City Configuration Generator
 *
 * Creates a minimal but functional CityConfig for ANY city based on
 * coordinates and city name. This enables the intelligent bots system
 * to work universally, not just for pre-configured Texas cities.
 *
 * Philosophy: Rather than requiring detailed hyperlocal data for every city,
 * we generate sensible defaults that still enable contextual posting.
 * The posts will be slightly less hyperlocal (no specific road names),
 * but still contextually relevant (weather, events, time-based content).
 */

import type { CityConfig, CityCoords } from "../types";

/**
 * Generate a dynamic CityConfig for any city
 *
 * This creates a minimal config that enables:
 * - Weather-based posts (uses real weather data)
 * - Event-based posts (uses Ticketmaster)
 * - Time-based posts (rush hour, weekends)
 * - Farmers market posts (uses USDA/OSM data)
 * - Engagement posts (polls, recommendations)
 *
 * What it CANNOT do without real local data:
 * - Specific road name callouts
 * - School zone alerts with real school names
 * - Landmark-specific recommendations
 */
export function generateDynamicCityConfig(
  cityName: string,
  coords: CityCoords,
  state?: string
): CityConfig {
  // Extract state from city name if provided in "City, ST" format
  let extractedState = state || "US";
  const cityParts = cityName.split(",");
  const cleanCityName = cityParts[0].trim();

  if (cityParts.length > 1) {
    extractedState = cityParts[1].trim().toUpperCase();
  }

  // Determine timezone based on coordinates (simplified)
  const timezone = guessTimezone(coords);

  return {
    name: cleanCityName,
    state: extractedState,
    coords,
    timezone,

    // Empty roads/landmarks/schools — dynamic cities should NOT generate
    // traffic/school content with fake names. Only weather + general + events.
    roads: {
      major: [],
      highways: [],
      schoolZones: [],
    },

    landmarks: {
      shopping: [],
      venues: [],
      restaurants: [],
    },

    schools: {
      high: [],
      middle: [],
      elementary: [],
    },

    // Standard rush hours (universal for US cities)
    rushHours: {
      morning: { start: 7, end: 9 },
      evening: { start: 16, end: 18 },
      schoolDismissal: 15,
    },

    // No specific alternate routes for dynamic configs
    altRoutes: {},

    // Generic fun facts that apply broadly
    funFacts: {
      traffic: [
        "Rush hour traffic patterns are similar across most US metro areas",
        "The average American spends 54 minutes commuting daily",
      ],
      weather: [
        "Local weather patterns can vary significantly within just a few miles",
        "Microclimates are common in areas with varied terrain",
      ],
      events: [
        "Community events bring neighbors together year-round",
        "Local venues host a variety of entertainment throughout the year",
      ],
      local: [
        "Every neighborhood has its own unique character and charm",
        "Local businesses are the backbone of community life",
      ],
      cuisine: {
        tacos: ["Tacos have become a beloved food across America"],
        bbq: ["BBQ styles vary by region, each with devoted fans"],
        coffee: ["Coffee shops have become community gathering places"],
        pizza: ["Pizza preferences vary widely by region"],
        burgers: ["The humble burger is an American classic"],
        general: [
          "Food brings communities together",
          "Local restaurants reflect the character of their neighborhoods",
        ],
      },
    },
  };
}

/**
 * Guess timezone from coordinates (simplified approach)
 *
 * For a production app, you'd use a proper timezone database,
 * but this covers the major US timezones which is our primary market.
 */
function guessTimezone(coords: CityCoords): string {
  const { lon } = coords;

  // Simplified US timezone detection based on longitude
  // This works well for continental US
  if (lon > -67.5) {
    return "America/New_York"; // Eastern
  } else if (lon > -82.5) {
    return "America/New_York"; // Eastern (eastern edge)
  } else if (lon > -90) {
    return "America/Chicago"; // Central (eastern edge)
  } else if (lon > -105) {
    return "America/Chicago"; // Central
  } else if (lon > -115) {
    return "America/Denver"; // Mountain
  } else if (lon > -125) {
    return "America/Los_Angeles"; // Pacific
  } else {
    return "America/Los_Angeles"; // Pacific (Alaska/Hawaii would need special handling)
  }
}

/**
 * Check if a city has a dynamic config available
 * (Always returns true since we can generate configs for any coordinates)
 */
export function canGenerateDynamicConfig(coords: CityCoords): boolean {
  // We can generate a config for any valid coordinates
  return (
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lon >= -180 &&
    coords.lon <= 180
  );
}
