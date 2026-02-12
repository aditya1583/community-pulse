/**
 * Data Grounding Module
 * 
 * Ensures all AI-generated content is backed by real API data.
 * If no real data is available for a category, no pulse is generated.
 * 
 * CONFIGURED API KEYS:
 * - TomTom (traffic) ✅
 * - Open-Meteo (weather) ✅ (free, no key needed)
 * - USDA/OSM (farmers markets) ✅ (free, no key needed)
 * 
 * NOT CONFIGURED:
 * - Ticketmaster (events) ❌
 * - OpenWeather ❌ (we use Open-Meteo instead)
 * - Foursquare ❌
 * - NewsAPI ❌
 * - EIA ❌
 */

import type { SituationContext, TrafficData, WeatherData, EventData, FarmersMarketData } from "./types";

export interface DataAvailability {
  traffic: { available: boolean; source: string; fetchedAt: string };
  weather: { available: boolean; source: string; fetchedAt: string };
  events: { available: boolean; source: string; fetchedAt: string };
  farmersMarkets: { available: boolean; source: string; fetchedAt: string };
}

/**
 * Check which real data sources are available in the current context.
 * Returns a map of what's actually backed by API data.
 */
export function checkDataAvailability(ctx: SituationContext): DataAvailability {
  const now = new Date().toISOString();

  return {
    traffic: {
      available: isTrafficDataReal(ctx.traffic),
      source: "TomTom Traffic Flow API",
      fetchedAt: now,
    },
    weather: {
      available: isWeatherDataReal(ctx.weather),
      source: "Open-Meteo Forecast API",
      fetchedAt: now,
    },
    events: {
      available: ctx.events.length > 0,
      source: "Ticketmaster Discovery API",
      fetchedAt: now,
    },
    farmersMarkets: {
      available: (ctx.farmersMarkets?.length ?? 0) > 0,
      source: "USDA Local Food Directories / OpenStreetMap",
      fetchedAt: now,
    },
  };
}

/**
 * Check if traffic data is from a real API (not the default fallback).
 * The default fallback in data-fetchers.ts returns congestionLevel: 0.1, freeFlowSpeed: 45.
 */
function isTrafficDataReal(traffic: TrafficData): boolean {
  // Default fallback: congestionLevel 0.1, freeFlowSpeed 45, currentSpeed 40
  const isDefault = traffic.freeFlowSpeed === 45 && traffic.currentSpeed === 40 && traffic.congestionLevel === 0.1;
  return !isDefault;
}

/**
 * Check if weather data is from a real API (not the default fallback).
 * The default fallback in data-fetchers.ts returns temperature: 75, condition: "clear".
 */
function isWeatherDataReal(weather: WeatherData): boolean {
  // Default fallback: temperature 75, condition "clear", humidity 50, uvIndex 5
  const isDefault = weather.temperature === 75 && weather.humidity === 50 && weather.uvIndex === 5 && weather.windSpeed === 5;
  return !isDefault;
}

/**
 * Engagement types that are ALLOWED because they don't fabricate specific details.
 * These either use real API data or ask generic community questions.
 */
export const DATA_GROUNDED_ENGAGEMENT_TYPES = new Set([
  // Uses real weather data from Open-Meteo
  "this_or_that",       // Weather/time-contextual polls (uses real temp)
  "prediction",         // XP predictions (uses real weather/traffic data)
  "weather_alert",      // Forecast-based alerts (uses real forecast)

  // Uses real traffic data from TomTom
  "route_pulse",        // Traffic + retail (uses real congestion data)
  "school_alert",       // School dismissal traffic (time-based, real roads)

  // Uses real market data from USDA/OSM
  "farmers_market",     // Real market data with real addresses

  // Generic community questions (no specific claims fabricated)
  "confession_booth",   // "What's your unpopular opinion?" - no fabrication
  "neighbor_challenge", // "Describe {city} in 3 words" - no fabrication
  "would_you_rather",   // Hypothetical choices - clearly hypothetical
  "civic_alert",        // Civic awareness questions - no fabrication

  // Polls that ask questions without claiming specific facts
  "poll",               // "Best tacos in {city}?" - asks, doesn't claim
  "recommendation",     // "Where's good for lunch?" - asks, doesn't claim
]);

/**
 * Engagement types that FABRICATE specific details and should be DISABLED
 * until backed by real data sources.
 */
export const FABRICATING_ENGAGEMENT_TYPES = new Set([
  "hot_take",           // Fabricates claims about specific restaurants/roads
  "insider_tip",        // Fabricates "secret menu items", specific times, parking tips
  "nostalgia_trigger",  // Fabricates specific memories, old business names
  "community_callout",  // Fabricates specific actions at specific locations
  "fomo_alert",         // Fabricates happy hour times, restaurant wait times
  "weekly_roundup",     // Fabricates trending topics, weather summaries
  "local_spotlight",    // Fabricates restaurant appreciation claims
  "venue_checkin",      // References venues from city config as if they're verified
  "landmark_food",      // Fabricates specific food recommendations near landmarks
]);

/**
 * Add a data source attribution line to a post message.
 * This enables freshness auditing.
 */
export function addDataAttribution(message: string, sources: string[]): string {
  if (sources.length === 0) return message;
  const timestamp = new Date().toISOString();
  const sourceStr = sources.join(", ");
  return `${message}\n\n📡 Data: ${sourceStr} • ${timestamp}`;
}

/**
 * Get the data sources used for a specific post type.
 */
export function getPostDataSources(
  tag: string,
  engagementType?: string,
  availability?: DataAvailability
): string[] {
  const sources: string[] = [];

  if (tag === "Traffic" || engagementType === "route_pulse" || engagementType === "school_alert") {
    sources.push("TomTom");
  }
  if (tag === "Weather" || engagementType === "weather_alert" || engagementType === "prediction") {
    sources.push("Open-Meteo");
  }
  if (tag === "Events") {
    sources.push("Ticketmaster");
  }
  if (engagementType === "farmers_market") {
    sources.push("USDA/OSM");
  }
  // Contextual polls use weather data
  if (engagementType === "this_or_that") {
    sources.push("Open-Meteo");
  }

  return sources;
}
