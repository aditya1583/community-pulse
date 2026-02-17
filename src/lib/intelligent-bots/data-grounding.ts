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
  // FACTS ONLY — real data, no engagement bait, no fluff
  "weather_alert",      // Real forecast data from Open-Meteo
  "route_pulse",        // Real traffic congestion from TomTom
  "school_alert",       // Real school dismissal times + traffic

  // DISABLED — all engagement bait, polls, predictions, recommendations:
  // "prediction"       — crystal ball gimmick, same stale format
  // "poll"             — "Best tacos?" repeated endlessly
  // "recommendation"   — generic local recs with no real data
  // "farmers_market"   — fabricated market info
  // "civic_alert"      — too vague without real agenda data
  // "confession_booth", "neighbor_challenge", "would_you_rather", "this_or_that"
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
  const now = new Date();
  // Human-readable timestamp: "Mon 4:27 PM" format
  const timestamp = now.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
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
