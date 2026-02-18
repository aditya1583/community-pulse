/**
 * Template Engine - Hyperlocal post generation
 *
 * Creates authentic-feeling posts using real city data
 * Now with AI-powered fun fact generation!
 */

import type {
  CityConfig,
  SituationContext,
  PostDecision,
  GeneratedPost,
  PostType,
} from "./types";
import { getRandomRoad, getRandomLandmark, getRandomSchool, getAltRoute } from "./city-configs";
import { addDataAttribution, getPostDataSources } from "./data-grounding";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import { formatDistance } from "@/lib/geo/distance";
import {
  generateFunFact,
  generateEventFunFact,
  generateWeatherFunFact,
  generateTrafficFunFact,
  formatFunFact,
  type FunFactResult,
} from "./fun-facts-ai";

// ============================================================================
// TEMPLATES - Organized by category and subcategory
// ============================================================================

const TRAFFIC_TEMPLATES = {
  "rushHour.morning": [
    "🚗 Morning rush: {road} at {congestion}% congestion near {landmark}.",
    "🚗 {road} slow near {landmark}. Alt: {altRoute}.",
    "🚗 Rush hour: {road} congested near {school}.",
  ],
  "rushHour.evening": [
    "🚗 Evening rush: {road} at {congestion}% near {landmark}.",
    "🚗 {road} congested. Alt: {altRoute}.",
    "🚗 Evening traffic: {road} slow near {landmark}.",
  ],
  schoolZone: [
    "🏫 School zone: {road} near {school} — expect delays.",
    "🚸 School dismissal: {road} near {school}.",
    "🏫 {school} zone active on {road}.",
  ],
  event: [
    "🚗 Post-event traffic expected near {venue} on {road}.",
    "🚗 {event} at {venue} ending soon. Expect {road} delays.",
  ],
  incident: [
    "⚠️ {road} partially blocked near {landmark}. Alt: {altRoute}.",
    "⚠️ Delays on {road} near {landmark}. {description}",
  ],
  general: [
    "🚗 {road} at {congestion}% congestion near {landmark}.",
    "🚗 {road}: {speed} mph near {landmark}.",
    "🚗 Traffic update: {road} near {landmark}.",
  ],
};

const WEATHER_TEMPLATES = {
  rain: [
    "🌧️ Rain in {city}. Wet roads on {road}.",
    "🌧️ Rain — reduced visibility on {highway}.",
  ],
  storm: [
    "⛈️ Storm in {city}. Heavy rain and lightning.",
    "⚠️ Severe weather in {city}.",
  ],
  heat: [
    "🥵 {temp}°F in {city}. Feels like {feelsLike}°F.",
    "🥵 High heat: {temp}°F in {city}. Limit outdoor activity.",
  ],
  cold: [
    "🥶 {temp}°F in {city}.",
    "❄️ Cold: {temp}°F. {bridge} may be icy.",
  ],
  fog: [
    "🌫️ Fog in {city}. Low visibility on {highway}.",
  ],
  uvAlert: [
    "☀️ UV index: {uvIndex}.",
  ],
  perfectWeather: [
    "☀️ {temp}°F and clear in {city}.",
    "🌤️ Clear skies, {temp}°F in {city}.",
  ],
  snow: [
    "❄️ Snow in {city}. {highway} conditions deteriorating.",
  ],
  forecast: [
    "🌡️ Forecast: {forecastDay} — {forecastCondition}, high {forecastHigh}°F, low {forecastLow}°F.",
    "📅 {forecastDay}: {forecastCondition}, {forecastHigh}°F/{forecastLow}°F.",
  ],
};

const GENERAL_TEMPLATES = {
  // NOTE: Weather judgments ("beautiful", "perfect") belong in WEATHER_TEMPLATES only.
  // General templates report temperature factually without claiming it's good or bad.
  // REMOVED: goodMorning, afternoon, weekend, lateNight — generic filler with zero informational value.
  // AI posts should ONLY contain real data: weather, traffic, events.
  goodMorning: [],
  afternoon: [],
  weekend: [],
  lateNight: [],

};

const EVENT_TEMPLATES = {
  upcoming: [
    "📅 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  concert: [
    "🎵 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  sports: [
    "🏈 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  festival: [
    "🎪 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  community: [
    "🏘️ {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  comedy: [
    "🎤 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  arts: [
    "🎨 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  food: [
    "🍔 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
  general: [
    "📅 {eventDate}: {event} at {venue} {eventDistanceCallout}.",
  ],
};

// ============================================================================
// MOOD MAPPINGS
// ============================================================================

const MOOD_BY_CATEGORY: Record<string, string[]> = {
  "rushHour.morning": ["😤", "☕", "🙄", "😅"],
  "rushHour.evening": ["😩", "🏠", "😤", "🙄"],
  schoolZone: ["🚸", "📚", "🏫", "⚠️"],
  event: ["🎉", "🎸", "🎭", "😊"],
  incident: ["⚠️", "😬", "🚨", "😟"],
  rain: ["🌧️", "☔", "😐", "🌦️"],
  storm: ["⛈️", "😰", "⚠️", "🌩️"],
  heat: ["🥵", "☀️", "😅", "🔥"],
  cold: ["🥶", "❄️", "😖", "🧊"],
  fog: ["🌫️", "😶", "⚠️", "🌁"],
  uvAlert: ["☀️", "🧴", "😎", "🌞"],
  perfectWeather: ["🌤️", "☀️", "😊", "✨"],
  snow: ["❄️", "😱", "🌨️", "⚠️"],
  goodMorning: ["☀️", "😊", "🌅", "☕"],
  afternoon: ["📍", "🌤️", "☕", "🏙️"],
  weekend: ["🎉", "😎", "🌳", "🍕"],
  lateNight: ["🌙", "😌", "✨", "🦉"],
  upcoming: ["🎭", "🎸", "🎉", "😊"],
  concert: ["🎸", "🎵", "🎤", "🎶"],
  sports: ["🏈", "⚽", "🏀", "🏒"],
  festival: ["🎪", "🎉", "🌟", "🎠"],
  community: ["🏘️", "👥", "🎈", "🌳"],
  comedy: ["😂", "🎤", "😆", "🤣"],
  arts: ["🎨", "🖼️", "🎭", "✨"],
  food: ["🍔", "🍕", "🌮", "😋"],
  general: ["📍", "🚗", "🚦", "😐"],
};

// ============================================================================
// BOT NAME GENERATOR
// ============================================================================

// Extended post types to include engagement and new high-engagement types
export type ExtendedPostType =
  | PostType
  | "Engagement"
  | "SchoolTraffic"
  | "VenueCheck"
  | "Local"
  // NEW HIGH-ENGAGEMENT TYPES
  | "HotTake"
  | "InsiderTip"
  | "Nostalgia"
  | "Challenge"
  | "Callout"
  | "WouldYouRather"
  | "Confession";

interface BotPersona {
  name: string;
  emoji: string;
}

// Single bot persona — all posts come from "Voxlo AI 🤖"
const PULSE_BOT: BotPersona = { name: "Voxlo AI", emoji: "🤖" };

export function getBotPersona(_postType?: PostType | ExtendedPostType): BotPersona {
  return PULSE_BOT;
}

function getBotName(_postType: PostType | ExtendedPostType, cityName: string): string {
  return `${cityName} ${PULSE_BOT.name} ${PULSE_BOT.emoji}`;
}

function getMood(templateCategory: string): string {
  const moods = MOOD_BY_CATEGORY[templateCategory] || MOOD_BY_CATEGORY.general;
  return moods[Math.floor(Math.random() * moods.length)];
}

// ============================================================================
// FUN FACT INJECTION SYSTEM
// ============================================================================

// Track recently used facts to avoid repetition (in-memory, resets on restart)
const usedFactsCache: Map<string, Set<string>> = new Map();
const FUN_FACT_INJECTION_RATE = 0.25; // 25% of posts get a fun fact
const FACT_CACHE_MAX_SIZE = 20; // Max facts to remember per city

type FactCategory = "traffic" | "weather" | "events" | "local";

/**
 * Map post types to fact categories
 */
function getFactCategoryForPostType(postType: PostType): FactCategory {
  switch (postType) {
    case "Traffic":
      return "traffic";
    case "Weather":
      return "weather";
    case "Events":
      return "events";
    case "General":
      return "local";
    default:
      return "local";
  }
}

/**
 * Get a random fact from a city's fun facts, avoiding recently used ones
 */
function getRandomFact(city: CityConfig, category: FactCategory): string | null {
  if (!city.funFacts) return null;

  const facts = city.funFacts[category];
  if (!facts || facts.length === 0) return null;

  // Get or create used facts set for this city
  const cacheKey = `${city.name}-${category}`;
  if (!usedFactsCache.has(cacheKey)) {
    usedFactsCache.set(cacheKey, new Set());
  }
  const usedFacts = usedFactsCache.get(cacheKey)!;

  // Filter out recently used facts
  const availableFacts = facts.filter((f) => !usedFacts.has(f));

  // If all facts used, reset the cache for this category
  if (availableFacts.length === 0) {
    usedFacts.clear();
    return facts[Math.floor(Math.random() * facts.length)];
  }

  // Select random available fact
  const selectedFact = availableFacts[Math.floor(Math.random() * availableFacts.length)];

  // Mark as used
  usedFacts.add(selectedFact);

  // Trim cache if too large
  if (usedFacts.size > FACT_CACHE_MAX_SIZE) {
    const iterator = usedFacts.values();
    const oldest = iterator.next().value;
    if (oldest) usedFacts.delete(oldest);
  }

  return selectedFact;
}

/**
 * Maybe inject a fun fact into a post message
 * Returns the original or enhanced message
 */
function maybeInjectFunFact(
  message: string,
  city: CityConfig,
  postType: PostType,
  forceInject: boolean = false
): string {
  // NEVER inject trivia into traffic posts — traffic = data only
  if (postType === "Traffic") {
    return message;
  }

  // Check injection rate (unless forced)
  if (!forceInject && Math.random() > FUN_FACT_INJECTION_RATE) {
    return message;
  }

  const category = getFactCategoryForPostType(postType);
  const fact = getRandomFact(city, category);

  if (!fact) return message;

  // Format the fun fact nicely
  const factPrefixes = ["💡 Fun fact:", "🤓 Did you know?", "📚 Trivia:", "✨ BTW:"];
  const prefix = factPrefixes[Math.floor(Math.random() * factPrefixes.length)];

  return `${message}\n\n${prefix} ${fact}`;
}

/**
 * Get a cuisine-related fun fact for Local tab posts
 */
export function getCuisineFact(
  city: CityConfig,
  cuisineType?: "tacos" | "bbq" | "coffee" | "pizza" | "burgers"
): string | null {
  if (!city.funFacts?.cuisine) return null;

  const cuisine = city.funFacts.cuisine;
  let facts: string[];

  if (cuisineType && cuisine[cuisineType] && cuisine[cuisineType].length > 0) {
    facts = cuisine[cuisineType];
  } else {
    // Fall back to general cuisine facts
    facts = cuisine.general || [];
  }

  if (facts.length === 0) return null;
  return facts[Math.floor(Math.random() * facts.length)];
}

// ============================================================================
// TEMPLATE SELECTION AND FILLING
// ============================================================================

function getTemplates(postType: PostType, category: string): string[] {
  switch (postType) {
    case "Traffic":
      return TRAFFIC_TEMPLATES[category as keyof typeof TRAFFIC_TEMPLATES] || TRAFFIC_TEMPLATES.general;
    case "Weather":
      return WEATHER_TEMPLATES[category as keyof typeof WEATHER_TEMPLATES] || [];
    case "Events":
      return EVENT_TEMPLATES[category as keyof typeof EVENT_TEMPLATES] || [];
    case "General":
      return GENERAL_TEMPLATES[category as keyof typeof GENERAL_TEMPLATES] || [];
    default:
      return [];
  }
}

function selectTemplate(templates: string[]): string {
  if (templates.length === 0) return "";
  return templates[Math.floor(Math.random() * templates.length)];
}

interface TemplateVariables {
  city: string;
  road: string;
  highway: string;
  altRoute: string;
  landmark: string;
  school: string;
  park: string;
  venue: string;
  restaurant: string;
  bridge: string;
  congestion: string;
  speed: string;
  temp: string;
  feelsLike: string;
  uvIndex: string;
  condition: string;
  weather: string;
  traffic: string;
  event: string;
  description: string;
  eventDistance: string;
  eventDistanceCallout: string;
  eventDate: string;
  venueCity: string;
  // New variables
  forecastHigh: string;
  forecastLow: string;
  forecastCondition: string;
  forecastDay: string;
}

/**
 * Format event date for display
 * e.g., "2026-01-10T19:00:00" → "Jan 10"
 */
function formatEventDate(startTime?: Date | string): string {
  if (!startTime) return "Soon";
  try {
    const d = startTime instanceof Date ? startTime : new Date(startTime);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Soon";
  }
}

function buildVariables(ctx: SituationContext, eventIndex: number = 0): TemplateVariables {
  const { city, traffic, weather, events } = ctx;

  const primaryRoad = getRandomRoad(city, "major");
  const altRoute = getAltRoute(city, primaryRoad) || getRandomRoad(city, "highways");

  // Describe weather briefly
  const weatherDesc = weather.condition === "clear"
    ? `${weather.temperature}°F and clear`
    : `${weather.temperature}°F, ${weather.condition}`;

  // Describe traffic briefly
  const congestionPct = Math.round(traffic.congestionLevel * 100);
  const trafficDesc = congestionPct > 30 ? "heavy traffic" : congestionPct > 15 ? "moderate traffic" : "light traffic";

  // Get the event at the specified index (for handling multiple event posts)
  const event = events[eventIndex] || events[0];

  // Get actual event venue if available, otherwise fallback to random landmark
  const eventVenue = event?.venue || getRandomLandmark(city, "venues");

  // Calculate event distance info for out-of-radius callouts
  const eventDistance = event?.distanceMiles;
  const isOutOfRadius = eventDistance && eventDistance > RADIUS_CONFIG.PRIMARY_RADIUS_MILES;
  const distanceStr = eventDistance ? formatDistance(eventDistance) : "";
  const distanceCallout = isOutOfRadius ? `(${distanceStr} away)` : "";

  // Format event date
  const eventDate = formatEventDate(event?.startTime);

  return {
    city: city.name,
    road: primaryRoad,
    highway: getRandomRoad(city, "highways"),
    altRoute,
    landmark: getRandomLandmark(city, "shopping"),
    school: getRandomSchool(city, "high"),
    park: getRandomLandmark(city, "venues"),
    venue: eventVenue,
    restaurant: getRandomLandmark(city, "restaurants"),
    bridge: `${primaryRoad} overpass`, // Generic bridge reference
    congestion: String(congestionPct),
    speed: String(Math.round(traffic.currentSpeed)),
    temp: String(weather.temperature),
    feelsLike: String(weather.feelsLike),
    uvIndex: String(weather.uvIndex),
    condition: weather.condition,
    weather: weatherDesc,
    traffic: trafficDesc,
    event: event?.name || "the event",
    description: traffic.incidents[0]?.description || "Delay reported",
    eventDistance: distanceStr,
    eventDistanceCallout: distanceCallout,
    eventDate,
    venueCity: "", // Will be populated when we have venue city data
    // New variables logic
    forecastHigh: ctx.weather.forecast?.[0]?.tempHigh.toString() || "--",
    forecastLow: ctx.weather.forecast?.[0]?.tempLow.toString() || "--",
    forecastCondition: ctx.weather.forecast?.[0]?.condition || "clear",
    forecastDay: "Tomorrow",
  };
}

function fillTemplateStandard(template: string, variables: TemplateVariables): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return result;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a post based on the situation analysis
 * Uses standard data-grounded templates + optional AI fun facts.
 */
export async function generatePost(
  ctx: SituationContext,
  decision: PostDecision,
  options: { injectFunFact?: boolean; useAIFacts?: boolean } = {}
): Promise<GeneratedPost | null> {
  if (!decision.shouldPost || !decision.postType) {
    return null;
  }

  const variables = buildVariables(ctx);
  let message: string;
  let mood: string;

  // Use standard templates
  const templates = getTemplates(decision.postType, decision.templateCategory);
  if (templates.length === 0) {
    console.warn(`[TemplateEngine] No templates for ${decision.postType}/${decision.templateCategory}`);
    return null;
  }
  const template = selectTemplate(templates);
  message = fillTemplateStandard(template, variables);
  mood = getMood(decision.templateCategory);

  // Should we add a fun fact?
  const shouldInjectFact = options.injectFunFact || Math.random() < FUN_FACT_INJECTION_RATE;

  if (shouldInjectFact) {
    // Try AI-generated fact first (if enabled or by default)
    const useAI = options.useAIFacts !== false; // Default to true

    if (useAI) {
      const aiFact = await getAIFunFact(ctx, decision.postType, variables);
      if (aiFact) {
        message = `${message}\n\n${formatFunFact(aiFact.fact)}`;
        console.log(`[TemplateEngine] Added AI fact: "${aiFact.fact}"`);
      } else {
        // Fall back to static facts if AI fails
        message = maybeInjectFunFact(message, ctx.city, decision.postType, true);
      }
    } else {
      // Use static facts
      message = maybeInjectFunFact(message, ctx.city, decision.postType, true);
    }
  }

  // Add data source attribution for freshness auditing
  const sources = getPostDataSources(decision.postType);
  if (sources.length > 0) {
    message = addDataAttribution(message, sources);
  }

  return {
    message,
    tag: decision.postType,
    mood,
    author: getBotName(decision.postType, ctx.city.name),
    is_bot: true,
    hidden: false,
  };
}

/**
 * Get an AI-generated fun fact based on the post type
 */
async function getAIFunFact(
  ctx: SituationContext,
  postType: PostType,
  variables: TemplateVariables
): Promise<FunFactResult | null> {
  try {
    switch (postType) {
      case "Events":
        if (ctx.events.length > 0) {
          return await generateEventFunFact(ctx.events[0], ctx.city.name);
        }
        break;
      case "Weather":
        return await generateWeatherFunFact(
          ctx.weather.condition,
          ctx.weather.temperature,
          ctx.city.name
        );
      case "Traffic":
        return await generateTrafficFunFact(variables.road, ctx.city.name);
      case "General":
      default:
        return await generateFunFact(ctx, postType);
    }
  } catch (error) {
    console.error("[TemplateEngine] AI fact generation failed:", error);
  }
  return null;
}

/**
 * Generate multiple posts for cold-start seeding
 * Uses different categories to provide variety
 */
export async function generateSeedPosts(
  ctx: SituationContext,
  count: number = 3,
  options: { useAIFacts?: boolean } = {}
): Promise<GeneratedPost[]> {
  const posts: GeneratedPost[] = [];
  const usedCategories = new Set<string>();

  // Categories to try, in priority order - avoid redundancy
  // Rule: Only ONE post per type (except Events can have 2 if different events)
  // Events are now sorted by distance, so events[0] is always the closest/most local
  const categoryOptions: Array<{ type: PostType; category: string; eventIndex?: number }> = [
    // Traffic - only one
    { type: "Traffic", category: ctx.time.isRushHour ? `rushHour.${ctx.time.rushHourType}` : "general" },
    // Weather - only one, skip if conditions are unremarkable
    ...(getWeatherCategory(ctx) ? [{ type: "Weather" as PostType, category: getWeatherCategory(ctx) }] : []),
    // Events: LOCAL event first (events[0] is closest due to distance sorting)
    ...(ctx.events.length > 0 ? [{ type: "Events" as PostType, category: getEventCategory(ctx.events[0]), eventIndex: 0 }] : []),
    // Events: Second event (if different) - this will be farther away
    ...(ctx.events.length > 1 ? [{ type: "Events" as PostType, category: getEventCategory(ctx.events[1]), eventIndex: 1 }] : []),
    // General - only if NOT already posting weather (to avoid redundancy)
    // Skip during normal hours when weather post already covers the vibe
    ...(
      !getWeatherCategory(ctx) ? [{ type: "General" as PostType, category: getGeneralCategory(ctx) }] : []
    ),
    // School zone as alternative to general traffic (only during dismissal)
    ...(ctx.time.isSchoolDismissal ? [{ type: "Traffic" as PostType, category: "schoolZone" }] : []),
  ];

  // Track which event names we've posted about to prevent duplicates
  const usedEventNames = new Set<string>();

  for (const option of categoryOptions) {
    if (posts.length >= count) break;
    if (usedCategories.has(`${option.type}-${option.category}`)) continue;

    // For Events, check if we've already posted about this specific event
    if (option.type === "Events" && option.eventIndex !== undefined) {
      const eventName = ctx.events[option.eventIndex]?.name?.toLowerCase().trim();
      if (eventName && usedEventNames.has(eventName)) {
        console.log(`[TemplateEngine] Skipping duplicate event: ${eventName}`);
        continue;
      }
      if (eventName) usedEventNames.add(eventName);
    }

    const templates = getTemplates(option.type, option.category);
    if (templates.length === 0) continue;

    const template = selectTemplate(templates);
    // Pass eventIndex to buildVariables so each event post uses the correct event
    const variables = buildVariables(ctx, option.eventIndex ?? 0);
    
    let message: string = fillTemplateStandard(template, variables);
    let postMood: string = getMood(option.category);

    // Inject fun facts into seed posts more frequently (~40% for variety)
    if (Math.random() < 0.4) {
      const useAI = options.useAIFacts !== false;

      if (useAI) {
        const aiFact = await getAIFunFact(ctx, option.type, variables);
        if (aiFact) {
          message = `${message}\n\n${formatFunFact(aiFact.fact)}`;
          console.log(`[TemplateEngine] Seed post AI fact: "${aiFact.fact}"`);
        } else {
          message = maybeInjectFunFact(message, ctx.city, option.type, true);
        }
      } else {
        message = maybeInjectFunFact(message, ctx.city, option.type, true);
      }
    }

    posts.push({
      message,
      tag: option.type,
      mood: postMood,
      author: getBotName(option.type, ctx.city.name),
      is_bot: true,
      hidden: false,
    });

    usedCategories.add(`${option.type}-${option.category}`);
  }

  return posts;
}

/**
 * Determine event category from event data
 *
 * IMPORTANT: Order matters! More specific patterns (food, festival) must be
 * checked BEFORE broader patterns (concert/music) to avoid false matches.
 */
function getEventCategory(event: { category: string; name: string }): string {
  const nameLower = event.name.toLowerCase();
  const categoryLower = event.category.toLowerCase();

  // Food detection (check BEFORE festival - "Food & Wine Festival" should be food)
  if (
    categoryLower.includes("food") ||
    categoryLower.includes("culinary") ||
    nameLower.includes("food") ||
    nameLower.includes("tasting") ||
    nameLower.includes("cook") ||
    nameLower.includes("bbq")
  ) {
    return "food";
  }

  // Festival detection (check BEFORE concert - "ACL Fest" should be festival)
  if (
    categoryLower.includes("festival") ||
    nameLower.includes("festival") ||
    nameLower.includes("fest") ||
    nameLower.includes("sxsw") ||
    nameLower.includes("acl")
  ) {
    return "festival";
  }

  // Sports detection
  if (
    categoryLower.includes("sport") ||
    categoryLower.includes("game") ||
    nameLower.includes("vs") ||
    nameLower.includes("game") ||
    nameLower.includes("match") ||
    nameLower.includes("football") ||
    nameLower.includes("basketball") ||
    nameLower.includes("soccer") ||
    nameLower.includes("hockey") ||
    nameLower.includes("baseball") ||
    nameLower.includes("stars") ||
    nameLower.includes("spurs") ||
    nameLower.includes("longhorns")
  ) {
    return "sports";
  }

  // Comedy detection
  if (
    categoryLower.includes("comedy") ||
    nameLower.includes("comedy") ||
    nameLower.includes("standup") ||
    nameLower.includes("stand-up") ||
    nameLower.includes("comedian")
  ) {
    return "comedy";
  }

  // Arts/Theater detection
  if (
    categoryLower.includes("theater") ||
    categoryLower.includes("theatre") ||
    categoryLower.includes("arts") ||
    nameLower.includes("theater") ||
    nameLower.includes("theatre") ||
    nameLower.includes("ballet") ||
    nameLower.includes("symphony") ||
    nameLower.includes("opera") ||
    nameLower.includes("broadway")
  ) {
    return "arts";
  }

  // Music/Concert detection (check AFTER more specific categories)
  if (
    categoryLower.includes("music") ||
    categoryLower.includes("concert") ||
    nameLower.includes("concert") ||
    nameLower.includes("live music") ||
    nameLower.includes("tour") ||
    nameLower.includes("band")
  ) {
    return "concert";
  }

  // Community detection
  if (
    categoryLower.includes("community") ||
    categoryLower.includes("family") ||
    nameLower.includes("community") ||
    nameLower.includes("family") ||
    nameLower.includes("market") ||
    nameLower.includes("fair") ||
    nameLower.includes("farmers")
  ) {
    return "community";
  }

  // Default to general
  return "general";
}

function getGeneralCategory(ctx: SituationContext): string {
  if (ctx.time.isWeekend) return "weekend";
  if (ctx.time.hour >= 6 && ctx.time.hour <= 11) return "goodMorning";
  if (ctx.time.hour >= 20 || ctx.time.hour < 6) return "lateNight";
  // Midday on weekdays (12-7pm) - use afternoon category
  return "afternoon";
}

function getWeatherCategory(ctx: SituationContext): string {
  const { weather } = ctx;

  // PRIORITY ORDER: Adverse conditions always come first to ensure accurate reporting
  // Never report "perfect" weather when conditions are actually problematic

  // 1. Active precipitation/adverse conditions - HIGHEST priority
  // But downgrade storm to empty (skip) if no actual precipitation
  if (weather.condition === "storm" && weather.precipitation < 0.1) {
    // Storm code with no precip — don't generate a storm post
    return "";
  }
  if (["rain", "storm", "snow", "fog"].includes(weather.condition)) {
    return weather.condition;
  }

  // 2. Extreme temperatures
  if (weather.temperature > 100) return "heat";
  if (weather.temperature < 32) return "cold";

  // 3. High UV warning
  if (weather.uvIndex >= 8) return "uvAlert";

  // 4. Hot but not extreme
  if (weather.temperature > 85) return "heat";

  // 5. Cold but not freezing (32-50F)
  if (weather.temperature < 50) return "cold";

  // 6. Perfect weather - ONLY for clear skies at comfortable temps (60-85F)
  // IMPORTANT: "cloudy" is NOT perfect weather - only "clear" qualifies
  if (
    weather.temperature >= 60 &&
    weather.temperature <= 85 &&
    weather.condition === "clear"
  ) {
    return "perfectWeather";
  }

  // 7. Skip weather posts for unremarkable conditions (cloudy but not extreme)
  // This prevents posting misleading "perfect conditions" for average days
  return "";
}
