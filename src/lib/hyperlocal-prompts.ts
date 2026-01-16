/**
 * Hyperlocal Pulse Prompt Configuration
 *
 * Provides city-specific placeholder examples for pulse inputs.
 * These prompts reference ACTUAL places within a 10-mile radius of each city.
 *
 * Design principles:
 * - HYPERLOCAL: Every place mentioned must be within 10 miles
 * - AUTHENTIC: Use real road names, real businesses, real landmarks
 * - RELATABLE: Sound like something a local would actually say
 */

import type { PulseCategory } from "@/components/types";
import { getCityConfig } from "./intelligent-bots/city-configs";
import type { CityConfig } from "./intelligent-bots/types";

/**
 * Placeholder prompts by category and city
 * Falls back to generic prompts if city not configured
 */
type CityPrompts = {
  Traffic: string[];
  Events: string[];
  General: string[];
  Weather: string[];
};

/**
 * Generate city-specific prompts from the intelligent-bots city config
 */
function generatePromptsFromConfig(config: CityConfig): CityPrompts {
  const { roads, landmarks } = config;

  // Pick representative roads and places for natural-sounding prompts
  const majorRoad = roads.major[0] || "Main St";
  const secondaryRoad = roads.major[1] || roads.major[0] || "downtown";
  const highway = roads.highways[0] || "the highway";
  const tollRoad = roads.highways.find((r) => r.toLowerCase().includes("toll")) || roads.highways[1] || highway;

  const store = landmarks.shopping[0] || "the grocery store";
  const venue = landmarks.venues[0] || "the park";
  const restaurant = landmarks.restaurants[0] || "that taco spot";
  const secondRestaurant = landmarks.restaurants[1] || landmarks.restaurants[0] || "the coffee shop";

  return {
    Traffic: [
      `${majorRoad} traffic is backed up right now`,
      `${highway} moving slow near the exit - give yourself extra time`,
      `${tollRoad} is clear, smooth sailing today`,
      `Construction on ${secondaryRoad} causing delays`,
      `School zone backup on ${roads.schoolZones?.[0] || majorRoad}`,
    ],
    Events: [
      `The line at ${venue} is crazy long today`,
      `Great weather for ${venue} - packed but worth it`,
      `${venue} has a big event going on - parking is tough`,
      `Just left ${venue} - amazing vibes today`,
    ],
    General: [
      `${restaurant} has a 20 min wait right now`,
      `${store} is packed today - long checkout lines`,
      `Found a parking spot near ${secondRestaurant}`,
      `The new coffee shop near ${store} is worth checking out`,
      `${secondRestaurant} vibes are good today`,
    ],
    Weather: [
      "It's way hotter than the forecast said",
      `Perfect patio weather near ${venue}`,
      "Flooding on low water crossings - be careful",
      `Beautiful sunset from ${venue} tonight`,
    ],
  };
}

/**
 * Pre-configured prompts for known cities
 * These are hand-crafted for maximum authenticity
 */
const CITY_PROMPTS: Record<string, CityPrompts> = {
  leander: {
    Traffic: [
      "Ronald Reagan Blvd backed up near Crystal Falls",
      "183A Toll is clear - good alternative to 183",
      "School zone slowdown on Hero Way around 3pm",
      "Construction on FM 2243 causing delays",
      "Bagdad Rd moving slow near HEB Plus",
    ],
    Events: [
      "Robin Bledsoe Park is packed for the event today",
      "Long line at Robin Bledsoe Park pavilion",
      "Great turnout at Devine Lake Park",
      "Cap Metro Rail station has parking available",
    ],
    General: [
      "Torchy's near 183 has a 20 min wait",
      "HEB Plus checkout lines are long today",
      "In-N-Out line wrapping around the building",
      "Black Walnut Cafe on Crystal Falls is perfect right now",
      "Gateway at Leander parking lot is full",
    ],
    Weather: [
      "Way hotter than forecast out here in Leander",
      "Perfect evening for Robin Bledsoe Park",
      "Watch the low water crossings after yesterday's rain",
      "Beautiful Hill Country sunset tonight",
    ],
  },
  "cedar park": {
    Traffic: [
      "Whitestone Blvd backed up near 1890 Ranch",
      "183A Toll moving smooth - skip the 183 mess",
      "FM 1431 slow near Lakeline Mall",
      "Cypress Creek Rd school zone slowdown",
      "Parmer Lane construction causing backups",
    ],
    Events: [
      "HEB Center parking filling up fast",
      "Elizabeth Milburn Park event today - packed",
      "Veterans Memorial Park has a great turnout",
      "Cedar Park Rec Center busy this afternoon",
    ],
    General: [
      "1890 Ranch parking lot is chaos today",
      "Pluckers at 1890 has a wait",
      "Trudy's near Lakeline is poppin right now",
      "Costco lines are longer than usual",
      "Black Walnut Cafe patio is perfect today",
    ],
    Weather: [
      "Hotter than expected in Cedar Park today",
      "Perfect weather for Elizabeth Milburn Park",
      "Keep an eye on those low water crossings",
      "Great evening to walk around 1890 Ranch",
    ],
  },
  austin: {
    Traffic: [
      "I-35 downtown is a parking lot right now",
      "MoPac moving slow through central Austin",
      "South Congress backed up near downtown",
      "Lamar Blvd is your friend today - skip I-35",
      "6th Street blocked for an event",
    ],
    Events: [
      "Zilker Park packed for the festival",
      "Long line for the bats at Congress Bridge",
      "ACL Live show tonight - downtown is busy",
      "Q2 Stadium match day - plan for traffic",
      "The Domain has something going on - packed",
    ],
    General: [
      "Franklin BBQ line is 3+ hours today",
      "Home Slice on South Congress is slammed",
      "Found parking at Mueller surprisingly easy",
      "Torchy's on South 1st has no wait right now",
      "The Domain food court is packed",
    ],
    Weather: [
      "Lady Bird Lake is gorgeous right now",
      "Too hot for Barton Springs - even the water's warm",
      "Perfect weather for a 6th Street patio",
      "Watch the low water crossings on 360",
    ],
  },
};

/**
 * Generic fallback prompts for unconfigured cities
 */
const GENERIC_PROMPTS: CityPrompts = {
  Traffic: [
    "Traffic backed up on the main road",
    "Highway is moving slow near downtown",
    "Construction causing delays nearby",
    "School zone slowdown this afternoon",
  ],
  Events: [
    "The park is packed for the event today",
    "Long lines at the venue",
    "Great turnout at the community center",
  ],
  General: [
    "The local taco spot has a 20 min wait",
    "Grocery store is packed today",
    "Found a great parking spot downtown",
    "Coffee shop vibes are good today",
  ],
  Weather: [
    "It's hotter than the forecast said",
    "Perfect patio weather today",
    "Watch for flooding after the rain",
    "Beautiful sunset tonight",
  ],
};

/**
 * Extract the city name from various formats:
 * - "Leander, TX, US" -> "leander"
 * - "Cedar Park" -> "cedar park"
 * - "Austin" -> "austin"
 */
function normalizeCityName(cityInput: string): string {
  // Handle displayName format: "City Name, ST, Country"
  const parts = cityInput.split(",");
  const cityPart = parts[0].trim().toLowerCase();
  return cityPart;
}

/**
 * Get hyperlocal prompts for a specific city and category
 *
 * @param cityName - The user's selected city (e.g., "Leander", "Austin", or "Leander, TX, US")
 * @param category - The pulse category (Traffic, Events, General, Weather)
 * @returns Array of hyperlocal placeholder strings
 */
export function getHyperlocalPrompts(
  cityName: string,
  category: PulseCategory
): string[] {
  const normalized = normalizeCityName(cityName);

  // First, check our hand-crafted prompts
  if (CITY_PROMPTS[normalized]) {
    return CITY_PROMPTS[normalized][category] || GENERIC_PROMPTS[category];
  }

  // Next, try to generate from intelligent-bots city config
  const config = getCityConfig(normalized);
  if (config) {
    const generated = generatePromptsFromConfig(config);
    return generated[category] || GENERIC_PROMPTS[category];
  }

  // Fall back to generic prompts
  return GENERIC_PROMPTS[category];
}

/**
 * Get a single stable placeholder that changes periodically
 * Uses time-based rotation to avoid jarring changes
 *
 * @param cityName - The user's selected city
 * @param category - The pulse category
 * @returns A single placeholder string
 */
export function getStableHyperlocalPlaceholder(
  cityName: string,
  category: PulseCategory
): string {
  const prompts = getHyperlocalPrompts(cityName, category);
  // Rotate every 3 minutes based on time
  const index = Math.floor(Date.now() / (3 * 60 * 1000)) % prompts.length;
  return prompts[index];
}
