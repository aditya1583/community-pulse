/**
 * Engagement Posts - AI-Driven Community Engagement
 *
 * Generates dynamic, contextual posts designed to spark conversations:
 * - Polls ("Best tacos in Leander?")
 * - Recommendation asks ("Looking for a good coffee spot near...")
 * - Venue check-ins ("What's happening at [venue] tonight?")
 * - School pickup alerts
 *
 * === ENGAGEMENT PHILOSOPHY ===
 * People don't engage with information. They engage with:
 * 1. IDENTITY - Content that makes them feel part of something
 * 2. CONTROVERSY - Hot takes they can't resist responding to
 * 3. NOSTALGIA - Memories that trigger emotional responses
 * 4. INSIDER STATUS - Knowledge that makes them feel special
 * 5. CHALLENGES - Direct calls to action they want to answer
 * 6. SOCIAL PROOF - What everyone else is doing/thinking
 *
 * All content is AI-generated to avoid repetitive/static questions.
 */

import type { CityConfig, SituationContext, PostType, GeneratedPost, PredictionMetadata, PredictionCategory, PredictionDataSource, LandmarkEntry, ForecastDay } from "./types";
import { getLandmarkName, getLandmarkDisplay } from "./types";
import { getRandomLandmark, getNearestLandmark, getRandomRoad } from "./city-configs";
import { ExtendedPostType } from "./template-engine";

// ============================================================================
// ENGAGEMENT POST TYPES
// ============================================================================

export type EngagementType =
  | "poll"
  | "recommendation"
  | "venue_checkin"
  | "school_alert"
  | "local_spotlight"
  | "this_or_that"           // Binary choice polls
  | "fomo_alert"             // Time-sensitive urgency posts
  | "weekly_roundup"         // Weekly summary posts
  | "hot_take"               // Controversial local opinions
  | "insider_tip"            // "Only locals know" content
  | "nostalgia_trigger"      // "Remember when..." posts
  | "neighbor_challenge"     // Call-to-action engagement
  | "community_callout"      // Celebrate/call out local behavior
  | "would_you_rather"       // Hypothetical local scenarios
  | "confession_booth"       // Anonymous-style local confessions
  | "farmers_market"         // Hyperlocal farmers market content
  | "prediction"             // XP-staked predictions about local outcomes
  | "civic_alert"            // Civic meeting alerts and predictions (50 XP)
  | "landmark_food"          // Food/coffee spots anchored to local landmarks
  | "weather_alert"          // Proactive weather alerts
  | "route_pulse";           // FACTUAL: Retail + landmark + traffic intent posts

/**
 * Action metadata for actionable posts (e.g., farmers market posts with directions)
 * Enables PulseCard to render interactive elements
 */
export interface PostActionData {
  /** Type of action - navigation to tab or external link */
  type: "navigate_tab" | "directions" | "website" | "traffic_check";
  /** Target for navigation (e.g., "local/markets") or URL for external */
  target: string;
  /** Display label for the action button */
  label: string;
  /** Optional venue/market data for rich rendering */
  venue?: {
    name: string;
    address: string;
    lat?: number;
    lon?: number;
    website?: string;
  };
}

export interface EngagementPost extends Omit<GeneratedPost, "tag"> {
  tag: PostType | "General";
  engagementType: EngagementType;
  options?: string[];  // For polls
  /** Action metadata for actionable posts */
  action?: PostActionData;
  /** Prediction metadata for prediction posts - transforms poll into XP-staked prediction */
  prediction?: PredictionMetadata;
}

// ============================================================================
// AI PROMPT CONTEXTS - Keeps it fresh and non-repetitive
// ============================================================================

const POLL_CONTEXTS = {
  food: [
    { topic: "tacos", emoji: "🌮", variants: ["breakfast tacos", "street tacos", "fish tacos"] },
    { topic: "coffee", emoji: "☕", variants: ["coffee shop", "espresso", "cold brew spot"] },
    { topic: "bbq", emoji: "🍖", variants: ["BBQ joint", "brisket", "smoked ribs"] },
    { topic: "pizza", emoji: "🍕", variants: ["pizza place", "NY style pizza", "wood-fired pizza"] },
    { topic: "burgers", emoji: "🍔", variants: ["burger spot", "smash burger", "loaded burger"] },
    { topic: "brunch", emoji: "🥞", variants: ["brunch spot", "weekend brunch", "mimosas"] },
    { topic: "happy hour", emoji: "🍻", variants: ["happy hour deals", "after-work drinks", "patio drinks"] },
    { topic: "date night", emoji: "💑", variants: ["date night restaurant", "romantic dinner", "special occasion"] },
  ],
  activities: [
    { topic: "hiking", emoji: "🥾", variants: ["hiking trail", "nature walk", "outdoor spot"] },
    { topic: "parks", emoji: "🌳", variants: ["park", "playground", "green space"] },
    { topic: "family fun", emoji: "👨‍👩‍👧‍👦", variants: ["family activity", "kids entertainment", "family outing"] },
    { topic: "live music", emoji: "🎸", variants: ["live music venue", "local band", "open mic"] },
  ],
  services: [
    { topic: "haircut", emoji: "💇", variants: ["barber", "hair stylist", "salon"] },
    { topic: "mechanic", emoji: "🔧", variants: ["auto mechanic", "car repair", "oil change"] },
    { topic: "vet", emoji: "🐕", variants: ["vet", "pet groomer", "dog park"] },
  ],
};

// Witty one-liner templates for venue check-ins
const VENUE_CHECKIN_TEMPLATES = [
  "👀 Anyone at {venue} right now? What's the vibe?",
  "📍 {venue} check - packed or chill tonight?",
  "🎯 Real talk: How's the crowd at {venue}?",
  "👋 {venue} crew, give us the scoop! Busy?",
  "🤔 Thinking about hitting up {venue}... worth it tonight?",
  "📊 {venue} vibe check! What are we looking at?",
  "🎤 What's the scene at {venue} rn?",
  "✨ {venue} status report - crowded or nah?",
  "🔥 {venue} - hot or not tonight? 🤷",
  "📡 Live from {venue}... anyone got eyes on the situation?",
];

// School pickup alert templates - witty and helpful
const SCHOOL_ALERT_TEMPLATES = [
  "🏫 Heads up! {school} letting out in ~15 min. {road} about to get spicy 🌶️",
  "🚸 School's almost out at {school}! {road} traffic incoming in 15...",
  "⏰ PSA: {school} dismissal soon. If you're on {road}, prepare yourself mentally.",
  "📚 3PM vibes: {school} parents assembling. {road} will need patience.",
  "🎒 The daily {school} exodus approaches. {road} veterans know the drill.",
  "⚠️ T-minus 15 min until {school} pickup chaos. {road} escapees, go now!",
  "🚗 {school} dismissal alert! {road} about to become a parking lot. Plan accordingly.",
  "🏃 Beat the {school} rush! Leave now or embrace the {road} crawl.",
];

// Recommendation ask templates - conversational and engaging
const RECOMMENDATION_TEMPLATES = [
  "🤔 Looking for recommendations: {query}",
  "👋 Hey neighbors! Anyone got a go-to for {query}?",
  "💡 Need local knowledge: {query}",
  "🗣️ Crowdsourcing: Where do y'all go for {query}?",
  "📍 New to the area... best spot for {query}?",
  "🙋 Quick question: Your favorite place for {query}?",
  "🔍 On the hunt for {query}. What's your pick?",
  "💭 Been craving {query}. Where should I go?",
];

// ============================================================================
// THIS OR THAT - TRULY CONTEXTUAL Polls
// ============================================================================
//
// PHILOSOPHY: Generic food polls are BORING. Users scroll past "Tacos vs Burritos"
// because it's not relevant to their moment. CONTEXTUAL polls engage because they
// reflect the user's current reality - the weather outside, the time of day,
// what's happening in town, and the traffic they're sitting in.
//
// These polls should feel like a friend asking "given what's happening RIGHT NOW,
// what would you do?" - not a generic survey.
// ============================================================================

type PollChoice = {
  a: string;
  b: string;
  category: string;
  // Optional context filters
  seasons?: ("spring" | "summer" | "fall" | "winter")[];
  weather?: ("hot" | "cold" | "rain" | "nice")[];
  timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
  dayType?: ("weekday" | "weekend")[];
};

// ============================================================================
// CONTEXTUAL POLL TEMPLATES - These use {variables} filled at generation time
// ============================================================================

type ContextualPollTemplate = {
  template: string;           // Message template with {variables}
  optionA: string;            // First poll option
  optionB: string;            // Second poll option
  // Context requirements - poll only shows when ALL conditions match
  conditions: {
    minTemp?: number;         // Minimum temperature
    maxTemp?: number;         // Maximum temperature
    weatherConditions?: string[];  // rain, clear, cloudy, storm
    timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
    dayType?: ("weekday" | "weekend")[];
    requiresEvents?: boolean; // Only show if events are happening
    requiresTraffic?: boolean; // Only show if traffic is notable
  };
};

// WEATHER-BASED CONTEXTUAL POLLS
const WEATHER_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  // HOT weather (>85F)
  {
    template: "🥵 {temp}°F outside. Perfect day for:",
    optionA: "🏊 Pool time",
    optionB: "❄️ AC & Netflix",
    conditions: { minTemp: 85 }
  },
  {
    template: "🌡️ It's {temp}°F in {city}. How are you beating the heat?",
    optionA: "🧊 Iced drinks patio",
    optionB: "🏠 Staying inside",
    conditions: { minTemp: 85 }
  },
  {
    template: "☀️ {temp}°F and sunny. Your move:",
    optionA: "🏖️ Lake day",
    optionB: "🎬 Movie theater AC",
    conditions: { minTemp: 90 }
  },
  {
    template: "🔥 Triple digits coming! {temp}°F right now. You're choosing:",
    optionA: "🍹 Frozen margs",
    optionB: "🍦 Ice cream run",
    conditions: { minTemp: 95 }
  },
  // COLD weather (<50F)
  {
    template: "🥶 {temp}°F in {city}. Perfect weather for:",
    optionA: "☕ Hot coffee run",
    optionB: "🛋️ Cozy at home",
    conditions: { maxTemp: 50 }
  },
  {
    template: "❄️ Brr! {temp}°F out there. You're reaching for:",
    optionA: "🧥 Jacket + outside",
    optionB: "🔥 Blanket + couch",
    conditions: { maxTemp: 45 }
  },
  {
    template: "🌡️ {temp}°F - finally hoodie weather! You're:",
    optionA: "🚶 Walking the trails",
    optionB: "☕ Cafe hopping",
    conditions: { minTemp: 45, maxTemp: 60 }
  },
  // RAINY weather
  {
    template: "☔ Rainy day in {city}. Your vibe:",
    optionA: "🍲 Soup & stay in",
    optionB: "☕ Cozy cafe",
    conditions: { weatherConditions: ["rain", "storm"] }
  },
  {
    template: "🌧️ Rain moving through {city}. Perfect excuse for:",
    optionA: "📚 Reading day",
    optionB: "🎮 Gaming session",
    conditions: { weatherConditions: ["rain", "storm"] }
  },
  {
    template: "⛈️ Stormy in {city}! You're choosing:",
    optionA: "😴 Nap time",
    optionB: "🍿 Movie marathon",
    conditions: { weatherConditions: ["storm"] }
  },
  // PERFECT weather (65-80F, clear)
  {
    template: "✨ {temp}°F and gorgeous in {city}! You're:",
    optionA: "🚴 Outside exploring",
    optionB: "🍽️ Patio dining",
    conditions: { minTemp: 65, maxTemp: 80, weatherConditions: ["clear"] }
  },
  {
    template: "🌤️ Perfect {temp}°F weather! {city}, what's the move:",
    optionA: "🥾 Hike or trail",
    optionB: "🧺 Picnic in the park",
    conditions: { minTemp: 68, maxTemp: 78, weatherConditions: ["clear"] }
  },
];

// TIME-BASED CONTEXTUAL POLLS
const TIME_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  // Saturday morning
  {
    template: "Saturday morning in {city}! You're:",
    optionA: "🛏️ Sleeping in",
    optionB: "🥬 Farmers market run",
    conditions: { dayType: ["weekend"], timeOfDay: ["morning"] }
  },
  {
    template: "Weekend morning vibes. {city}, what's calling you:",
    optionA: "🥞 Big breakfast out",
    optionB: "☕ Slow coffee at home",
    conditions: { dayType: ["weekend"], timeOfDay: ["morning"] }
  },
  // Friday night
  {
    template: "Friday night in {city}! Your plans:",
    optionA: "🍻 Going out",
    optionB: "🛋️ Staying in",
    conditions: { dayType: ["weekday"], timeOfDay: ["evening", "night"] }
  },
  {
    template: "TGIF {city}! Tonight you're:",
    optionA: "🍕 Dinner & drinks",
    optionB: "🎬 Couch & takeout",
    conditions: { dayType: ["weekday"], timeOfDay: ["evening"] }
  },
  // Sunday
  {
    template: "Lazy Sunday in {city}. You're choosing:",
    optionA: "🥂 Brunch spot",
    optionB: "🥞 Homemade pancakes",
    conditions: { dayType: ["weekend"], timeOfDay: ["morning", "afternoon"] }
  },
  {
    template: "Sunday vibes. {city}, how are you spending it:",
    optionA: "📺 Binge watching",
    optionB: "🛠️ Getting stuff done",
    conditions: { dayType: ["weekend"], timeOfDay: ["afternoon"] }
  },
  // Weekday morning
  {
    template: "Monday morning in {city}. Your fuel:",
    optionA: "☕ Coffee, obviously",
    optionB: "🏃 Morning workout",
    conditions: { dayType: ["weekday"], timeOfDay: ["morning"] }
  },
  // Weekday evening
  {
    template: "After work in {city}. You're:",
    optionA: "🏋️ Hitting the gym",
    optionB: "🏠 Straight home",
    conditions: { dayType: ["weekday"], timeOfDay: ["evening"] }
  },
  {
    template: "Hump day evening. {city}, what's the vibe:",
    optionA: "🍻 Midweek drinks",
    optionB: "📺 Early night",
    conditions: { dayType: ["weekday"], timeOfDay: ["evening"] }
  },
];

// EVENT-BASED CONTEXTUAL POLLS (when events are happening)
const EVENT_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  {
    template: "🎉 {eventName} tonight in {city}! You're:",
    optionA: "🎟️ Going!",
    optionB: "😴 Skipping this one",
    conditions: { requiresEvents: true }
  },
  {
    template: "🎸 {eventName} at {venue}! How are you watching:",
    optionA: "🏟️ Live at the venue",
    optionB: "📺 From home",
    conditions: { requiresEvents: true }
  },
  {
    template: "🏒 Game day! {eventName}. Your move:",
    optionA: "👥 Bringing the crew",
    optionB: "🍺 Solo at a bar",
    conditions: { requiresEvents: true }
  },
];

// TRAFFIC-BASED CONTEXTUAL POLLS
const TRAFFIC_CONTEXTUAL_POLLS: ContextualPollTemplate[] = [
  {
    template: "🚗 Traffic on {road} is rough. You're:",
    optionA: "😤 Sitting through it",
    optionB: "🗺️ Taking the long way",
    conditions: { requiresTraffic: true }
  },
  {
    template: "⏰ Rush hour in {city}. Your strategy:",
    optionA: "🏃 Leave early",
    optionB: "⏳ Wait it out",
    conditions: { requiresTraffic: true, timeOfDay: ["afternoon", "evening"] }
  },
  {
    template: "🛣️ {road} backed up again. Worth it to:",
    optionA: "🚗 Toll road it",
    optionB: "🛤️ Frontage road",
    conditions: { requiresTraffic: true }
  },
];

// Fallback base choices - only used when no contextual poll matches
const BASE_CHOICES: PollChoice[] = [
  // These are kept minimal as fallbacks only
  { a: "☕ Coffee", b: "🍵 Tea", category: "beverage" },
  { a: "🌅 Early bird", b: "🌙 Night owl", category: "lifestyle" },
  { a: "📚 Book", b: "📺 Stream", category: "lifestyle" },
  { a: "🏠 Homebody", b: "🎉 Social butterfly", category: "lifestyle" },
  { a: "🐕 Dogs", b: "🐈 Cats", category: "lifestyle" },
];

// Seasonal choices
const SEASONAL_CHOICES: PollChoice[] = [
  // Summer (hot weather)
  { a: "🏊 Pool day", b: "🎬 Movie theater AC", category: "summer", seasons: ["summer"], weather: ["hot"] },
  { a: "💨 AC on blast", b: "🪟 Windows down", category: "summer", seasons: ["summer"], weather: ["hot"] },
  { a: "🧊 Iced coffee", b: "☕ Hot coffee anyway", category: "summer", seasons: ["summer"], weather: ["hot"] },
  { a: "🌅 Early morning workout", b: "🌙 Night owl gym", category: "summer", seasons: ["summer"], weather: ["hot"] },
  { a: "🏖️ Lake day", b: "🛒 Mall walking", category: "summer", seasons: ["summer"], weather: ["hot"] },
  { a: "🍹 Frozen marg", b: "🍺 Cold beer", category: "summer", seasons: ["summer"], weather: ["hot"] },

  // Fall
  { a: "🎃 Pumpkin spice everything", b: "🍎 Apple cider vibes", category: "fall", seasons: ["fall"] },
  { a: "🏈 Watch the game", b: "🍂 Fall festival", category: "fall", seasons: ["fall"] },
  { a: "🌾 Corn maze", b: "🎃 Pumpkin patch", category: "fall", seasons: ["fall"], dayType: ["weekend"] },
  { a: "🧥 Hoodie weather", b: "👕 Still shorts season", category: "fall", seasons: ["fall"] },

  // Winter
  { a: "☕ Hot cocoa", b: "🍵 Hot cider", category: "winter", seasons: ["winter"], weather: ["cold"] },
  { a: "🔥 Firepit hangout", b: "🛋️ Cozy couch", category: "winter", seasons: ["winter"], weather: ["cold"] },
  { a: "🎄 Lights display", b: "🎬 Holiday movie marathon", category: "winter", seasons: ["winter"] },
  { a: "🧣 Bundle up outside", b: "🏠 Hibernate inside", category: "winter", seasons: ["winter"], weather: ["cold"] },

  // Spring
  { a: "🌸 Bluebonnet photos", b: "🌷 Garden visit", category: "spring", seasons: ["spring"] },
  { a: "🚴 Bike the trails", b: "🚶 Walk the park", category: "spring", seasons: ["spring"], weather: ["nice"] },
  { a: "🧹 Spring cleaning", b: "🌳 Yard work", category: "spring", seasons: ["spring"], dayType: ["weekend"] },
];

// Weather-reactive choices
const WEATHER_CHOICES: PollChoice[] = [
  // Rainy day
  { a: "☔ Cozy inside", b: "🌧️ Rain walk anyway", category: "rainy", weather: ["rain"] },
  { a: "📚 Reading day", b: "🎮 Gaming session", category: "rainy", weather: ["rain"] },
  { a: "🍲 Soup weather", b: "🧀 Grilled cheese vibes", category: "rainy", weather: ["rain"] },
  { a: "😴 Nap time", b: "☕ Coffee and chill", category: "rainy", weather: ["rain"] },

  // Perfect weather
  { a: "🌳 Hike it out", b: "☕ Patio brunch", category: "nice_weather", weather: ["nice"] },
  { a: "🚴 Bike ride", b: "🏃 Trail run", category: "nice_weather", weather: ["nice"] },
  { a: "🧺 Picnic", b: "🍽️ Outdoor dining", category: "nice_weather", weather: ["nice"] },
  { a: "🌅 Sunrise hike", b: "🌇 Sunset patio", category: "nice_weather", weather: ["nice"] },
];

// Time-of-day choices
const TIME_CHOICES: PollChoice[] = [
  // Morning
  { a: "🥱 Snooze button", b: "🏃 Early bird workout", category: "morning", timeOfDay: ["morning"] },
  { a: "🍳 Big breakfast", b: "☕ Just coffee", category: "morning", timeOfDay: ["morning"] },

  // Evening/Night
  { a: "🍷 Wine down", b: "🍺 Beer o'clock", category: "evening", timeOfDay: ["evening"] },
  { a: "🎸 Live music night", b: "🎬 Movie night", category: "evening", timeOfDay: ["evening", "night"] },
  { a: "🍽️ Dinner out", b: "🏠 Cook at home", category: "evening", timeOfDay: ["evening"] },

  // Weekend specific
  { a: "😴 Sleep in", b: "🌅 Early start", category: "weekend", dayType: ["weekend"] },
  { a: "🥂 Brunch crew", b: "🏋️ Gym first", category: "weekend", dayType: ["weekend"], timeOfDay: ["morning"] },
  { a: "📺 Binge watch", b: "🎯 Productive day", category: "weekend", dayType: ["weekend"] },
  { a: "🚗 Day trip", b: "🏡 Staycation", category: "weekend", dayType: ["weekend"] },

  // Friday specific
  { a: "🍻 Happy hour", b: "🏠 Straight home", category: "friday", dayType: ["weekday"], timeOfDay: ["afternoon", "evening"] },
];

// Lifestyle choices (always available)
const LIFESTYLE_CHOICES: PollChoice[] = [
  { a: "🏠 Homebody", b: "🎉 Social butterfly", category: "lifestyle" },
  { a: "☀️ Morning person", b: "🌙 Night owl", category: "lifestyle" },
  { a: "🏃 Gym rat", b: "🌳 Outdoor workout", category: "lifestyle" },
  { a: "📚 Book", b: "📺 Netflix", category: "lifestyle" },
  { a: "🎸 Live music", b: "🎬 Movies", category: "lifestyle" },
  { a: "🐕 Dog person", b: "🐈 Cat person", category: "lifestyle" },
  { a: "🏖️ Beach trip", b: "⛰️ Mountain trip", category: "lifestyle" },
  { a: "📱 Android", b: "🍎 iPhone", category: "lifestyle" },
  { a: "🎧 Podcasts", b: "🎵 Music only", category: "lifestyle" },
];

// Event-driven choices (when events are happening nearby)
type EventPollChoice = PollChoice & {
  eventCategories?: string[]; // Matches EventData.category
};

const EVENT_CHOICES: EventPollChoice[] = [
  // Concert/Music events
  { a: "🎤 Front row", b: "🍺 Back with drinks", category: "concert", eventCategories: ["music", "concert", "concerts"] },
  { a: "🎸 Opening act", b: "⭐ Headliner only", category: "concert", eventCategories: ["music", "concert", "concerts"] },
  { a: "🎵 Standing", b: "💺 Seated", category: "concert", eventCategories: ["music", "concert", "concerts"] },
  { a: "👕 Merch booth", b: "💰 Save the cash", category: "concert", eventCategories: ["music", "concert", "concerts"] },

  // Sports events
  { a: "🏟️ Live at the stadium", b: "📺 Watch at home", category: "sports", eventCategories: ["sports", "football", "basketball", "baseball", "soccer", "hockey"] },
  { a: "🌭 Stadium food", b: "🍽️ Eat before", category: "sports", eventCategories: ["sports", "football", "basketball", "baseball", "soccer", "hockey"] },
  { a: "🎉 Tailgate", b: "🏃 Straight to seats", category: "sports", eventCategories: ["sports", "football"] },
  { a: "🧢 Jersey on", b: "👔 Casual fit", category: "sports", eventCategories: ["sports", "football", "basketball", "baseball", "soccer", "hockey"] },

  // Festival/Fair events
  { a: "🎡 Rides first", b: "🍗 Food first", category: "festival", eventCategories: ["festival", "fair", "carnival"] },
  { a: "🌅 Day vibes", b: "🌙 Night scene", category: "festival", eventCategories: ["festival", "fair", "carnival", "music"] },
  { a: "🎨 Art exhibits", b: "🎭 Live performances", category: "festival", eventCategories: ["festival", "arts", "cultural"] },

  // Comedy/Theater
  { a: "😂 Stand-up comedy", b: "🎭 Theater show", category: "entertainment", eventCategories: ["comedy", "theatre", "theater", "performing arts"] },
  { a: "🍿 Snacks during", b: "🍽️ Dinner after", category: "entertainment", eventCategories: ["comedy", "theatre", "theater", "performing arts", "film"] },

  // General event vibes
  { a: "📅 Plan every detail", b: "🎲 Go with the flow", category: "event_general" },
  { a: "📸 Pics or it didn't happen", b: "📵 In the moment", category: "event_general" },
  { a: "🚗 Drive there", b: "🚕 Rideshare back", category: "event_general" },
];

/**
 * Get current season based on month
 */
function getCurrentSeason(): "spring" | "summer" | "fall" | "winter" {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

/**
 * Get weather category from temperature and conditions
 */
function getWeatherCategory(temp: number, condition: string): "hot" | "cold" | "rain" | "nice" {
  if (condition === "rain" || condition === "storm") return "rain";
  if (temp > 85) return "hot";
  if (temp < 50) return "cold";
  return "nice";
}

/**
 * Get time of day category
 */
function getTimeOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/**
 * Build contextual poll choices based on current conditions
 */
function getContextualChoices(ctx: SituationContext): PollChoice[] {
  const { weather, time, events } = ctx;
  const season = getCurrentSeason();
  const weatherCat = getWeatherCategory(weather.temperature, weather.condition);
  const timeOfDay = getTimeOfDay(time.hour);
  const dayType = time.isWeekend ? "weekend" : "weekday";

  // Start with base choices
  let choices: PollChoice[] = [...BASE_CHOICES, ...LIFESTYLE_CHOICES];

  // Add seasonal choices that match current season
  const seasonalMatches = SEASONAL_CHOICES.filter(c =>
    !c.seasons || c.seasons.includes(season)
  ).filter(c =>
    !c.weather || c.weather.includes(weatherCat)
  ).filter(c =>
    !c.dayType || c.dayType.includes(dayType)
  );
  choices = [...choices, ...seasonalMatches];

  // Add weather-specific choices
  const weatherMatches = WEATHER_CHOICES.filter(c =>
    !c.weather || c.weather.includes(weatherCat)
  );
  choices = [...choices, ...weatherMatches];

  // Add time-appropriate choices
  const timeMatches = TIME_CHOICES.filter(c =>
    !c.timeOfDay || c.timeOfDay.includes(timeOfDay)
  ).filter(c =>
    !c.dayType || c.dayType.includes(dayType)
  );
  choices = [...choices, ...timeMatches];

  // Add event-driven choices if events are happening
  if (events && events.length > 0) {
    // Get all unique event categories (normalized to lowercase)
    const eventCategories = new Set(
      events.map(e => e.category?.toLowerCase()).filter(Boolean)
    );

    // Find event choices that match any of the current event categories
    const eventMatches = EVENT_CHOICES.filter(c => {
      // Always include general event choices
      if (c.category === "event_general") return true;
      // Include if any event category matches
      if (c.eventCategories) {
        return c.eventCategories.some(cat =>
          eventCategories.has(cat.toLowerCase())
        );
      }
      return false;
    });

    // Boost event choices by adding them to the pool (higher chance of selection)
    choices = [...choices, ...eventMatches, ...eventMatches]; // Double weight
  }

  // Dedupe by creating unique key
  const seen = new Set<string>();
  return choices.filter(c => {
    const key = `${c.a}|${c.b}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const THIS_OR_THAT_TEMPLATES = [
  "⚔️ {a} vs {b} — Choose your fighter!",
  "🤔 Settle this: {a} or {b}?",
  "⬅️ {a}  OR  {b} ➡️",
  "🔥 Hot take time: {a} vs {b}",
  "📊 {city} poll: {a} or {b}?",
  "👆 This or that: {a} vs {b}",
  "🎯 Pick one: {a} or {b}",
  "💭 Be honest: {a} or {b}?",
];

// ============================================================================
// FOMO ALERTS - Time-sensitive urgency posts
// ============================================================================

const FOMO_TEMPLATES = {
  happyHour: [
    "🍻 Happy hour at {restaurant} starts in {minutes} min! Who's in?",
    "⏰ ALERT: {restaurant} happy hour kicks off in {minutes} min. Don't miss it!",
    "🍺 {minutes} min until happy hour at {restaurant}. Just saying...",
    "🎉 {restaurant} happy hour countdown: {minutes} minutes. See you there?",
    "💸 Cheap drinks incoming! {restaurant} happy hour in {minutes} min.",
  ],
  eventStarting: [
    "🎸 {event} at {venue} starts in {minutes} min! Still time to make it!",
    "⏰ {minutes} min until {event} kicks off at {venue}. You coming?",
    "🎭 Don't miss it! {event} at {venue} in {minutes} min.",
    "🚨 Last call! {event} starts in {minutes} min at {venue}.",
    "🏃 {event} at {venue} - {minutes} min away. Move it!",
  ],
  lunchRush: [
    "🍽️ Beat the lunch rush! {restaurant} is probably empty for the next {minutes} min.",
    "⏰ Pro tip: Hit {restaurant} now. Lunch crowd incoming in {minutes} min.",
    "🎯 {minutes} min window before {restaurant} gets slammed. Go now!",
  ],
  weatherWindow: [
    "☀️ Perfect weather window! Next {minutes} min are gorgeous for {activity}.",
    "🌤️ Quick! {minutes} min of perfect weather before it changes. Get outside!",
    "⛅ Weather alert: Great conditions for {activity} for the next {minutes} min.",
  ],
  sunsetAlert: [
    "🌅 Sunset in ~{minutes} min! Best spots: {venue} or any west-facing patio.",
    "📸 Golden hour alert! Sunset in {minutes} min. Grab your camera!",
    "✨ {minutes} min to sunset. Perfect time for a {venue} patio moment.",
  ],
};

// ============================================================================
// WEEKLY ROUNDUP - Summary posts
// ============================================================================

const WEEKLY_ROUNDUP_TEMPLATES = [
  `📊 This Week in {city}

🔥 Trending topic: {trending}
🌡️ Weather recap: {weatherSummary}
🚗 Traffic MVP: {trafficTip}
🎉 Coming up: {upcomingEvents}

What was YOUR highlight this week?`,

  `✨ {city} Weekly Pulse

📈 Hot conversations: {trending}
☀️ Weather vibes: {weatherSummary}
🚦 Road report: {trafficTip}
📅 Don't miss: {upcomingEvents}

Drop your weekly wins below! 👇`,

  `🗓️ Week in Review: {city}

💬 Y'all talked about: {trending}
🌤️ Weather check: {weatherSummary}
🛣️ Traffic intel: {trafficTip}
🎭 On deck: {upcomingEvents}

How was your week, neighbors?`,
];

// ============================================================================
// HOT TAKES - Controversial local opinions that demand responses
// ============================================================================

const HOT_TAKE_TEMPLATES = {
  food: [
    "🔥 Hot take: {restaurant} is overrated and I'm tired of pretending it's not. Fight me in the comments.",
    "🌶️ Unpopular opinion: The best {food} in {city} isn't where you think it is. Drop your real answer.",
    "💀 I said what I said: {restaurant}'s wait time is NOT worth it. Who agrees?",
    "🤷 Sorry not sorry: {city} has better {food} than Austin. @ me.",
    "⚔️ Controversial take: We need to stop recommending {restaurant} to newcomers. There, I said it.",
    "🎤 Someone had to say it: The {food} scene in {city} peaked in 2019. Change my mind.",
  ],
  traffic: [
    "🔥 Hot take: {road} isn't that bad. Y'all just can't drive.",
    "🌶️ Unpopular opinion: Taking {altRoute} is actually SLOWER most of the time. Prove me wrong.",
    "💀 I said what I said: If you're complaining about {city} traffic, you've never lived anywhere else.",
    "🚗 Controversial: {road} drivers are the worst in the entire Austin metro. Fight me.",
    "⚔️ Hot take: The problem with {road} isn't the road. It's the people who don't use turn signals.",
  ],
  local: [
    "🔥 Unpopular opinion: {city} is getting too big too fast and nobody wants to admit it.",
    "🌶️ Hot take: Half the people complaining about {city} growth moved here in the last 3 years.",
    "💀 I said what I said: {landmark} is mid at best. We need new spots.",
    "🤷 Controversial: {city} has better vibes than Cedar Park. Sorry Cedar Park.",
    "⚔️ Hot take: The 'old {city}' everyone misses wasn't actually that great. We romanticize it.",
    "🎤 Someone had to say it: We don't need another {businessType} in {city}. We need {need}.",
  ],
  services: [
    "🔥 Hot take: {city} desperately needs a {need} and it's embarrassing we don't have one.",
    "🌶️ Unpopular opinion: Every {business} recommendation thread suggests the same 3 places. Let's get creative.",
    "💀 I said what I said: The service at most {city} restaurants has gone downhill. True or false?",
  ],
};

// Business types and needs for hot takes
const HOT_TAKE_VARIABLES = {
  businessType: ["coffee shop", "Mexican restaurant", "storage facility", "car wash", "urgent care"],
  need: ["a good deli", "more parks", "better public transit", "a real downtown", "late-night food options"],
  food: ["tacos", "BBQ", "pizza", "burgers", "coffee", "brunch"],
};

// ============================================================================
// INSIDER TIPS - "Only locals know" content that rewards engagement
// ============================================================================

const INSIDER_TIP_TEMPLATES = [
  "🤫 Insider tip for {city} newbies: The secret to {road} traffic is leaving at {time}. You're welcome.",
  "💡 Local hack: {restaurant}'s secret menu item is {secretItem}. Don't tell everyone.",
  "🎯 Pro tip only {city} OGs know: {landmark} is 10x better on {day} mornings. Trust me.",
  "🔓 Unlocking {city} knowledge: Skip the main entrance at {venue}. Go around back.",
  "📍 {city} insider move: When {restaurant} is packed, {alternative} has the same vibe with no wait.",
  "🗝️ Real ones know: The best parking for {landmark} is actually at {parkingSpot}. Free and close.",
  "⭐ {city} life hack: {restaurant} does half-price {item} on {day}s. You didn't hear it from me.",
  "🤐 Shhh... The locals' secret: {venue} has the best {feature} in town. Don't blow up my spot.",
  "🎪 Newbie alert: When someone says 'meet at {landmark},' they mean the {specificSpot}. Now you know.",
  "💎 Hidden gem status: {hiddenSpot} is {city}'s best kept secret. Reply if you've been there.",
];

const INSIDER_VARIABLES = {
  secretItem: ["the off-menu breakfast taco", "their 'loaded' version", "asking for extra crispy", "the secret sauce"],
  time: ["exactly 7:47am", "before 7:15am", "right at noon when everyone else is eating", "after 6:30pm"],
  day: ["Tuesday", "Wednesday", "Thursday", "Sunday"],
  specificSpot: ["the side with the benches", "near the big tree", "by the fountain", "the back corner"],
  feature: ["sunset views", "people watching", "quiet corners", "dog-friendly patio"],
  item: ["apps", "drinks", "tacos", "wings"],
};

// ============================================================================
// NOSTALGIA TRIGGERS - "Remember when..." emotional engagement
// ============================================================================

const NOSTALGIA_TEMPLATES = [
  "🕰️ Remember when {road} was just a two-lane road? {city} OGs, where you at?",
  "📸 Throwback to when {landmark} was the ONLY thing to do in {city}. What year did you move here?",
  "👴 Only real {city} natives remember when {memory}. If you know, you know.",
  "🌅 Miss the days when you could get to {destination} in {oldTime} minutes. Now it's {newTime}. Pain.",
  "🏡 Who else remembers when {area} was all just {oldFeature}? The growth is wild.",
  "🎭 Pouring one out for {closedBusiness}. If you never got to go there, I'm sorry for your loss.",
  "📍 Back in the day, {landmark} was THE spot. What's the new THE spot now?",
  "🚗 Remember when there was no {road}? How did we even survive?",
  "✨ {city} before {change} hits different. Miss those vibes sometimes.",
  "🗓️ It's been {years} years since {event} and I still think about it. Anyone else?",
];

const NOSTALGIA_VARIABLES = {
  memory: [
    "there was no HEB Plus",
    "we didn't have an In-N-Out",
    "183A was free",
    "you could get a house here for under $200k",
    "this was considered 'way out there' from Austin",
  ],
  oldTime: ["15", "10", "8", "5"],
  newTime: ["35", "25", "20", "45"],
  oldFeature: ["farmland", "empty fields", "one traffic light", "dirt roads"],
  closedBusiness: ["that taco place on Main", "the old movie theater", "the original farmers market spot"],
  change: ["the population boom", "all the construction", "everyone discovered us", "the toll roads"],
  years: ["5", "10", "3", "7"],
};

// ============================================================================
// NEIGHBOR CHALLENGES - Call-to-action engagement
// ============================================================================

const CHALLENGE_TEMPLATES = [
  "📣 {city} CHALLENGE: Drop your go-to order at {restaurant} without naming the restaurant. Let's see who guesses.",
  "🎯 Challenge accepted? Name ONE thing {city} does better than Austin. Just one. Go.",
  "🏆 {city} challenge: What's the most {superlative} thing you've seen happen here? Winner gets bragging rights.",
  "⚡ Quick challenge: Describe {city} in exactly 3 words. No more, no less.",
  "🎪 Community challenge: Reply with the {city} business you want EVERYONE to support right now.",
  "🗣️ CHALLENGE: Tag a {city} neighbor in the comments who needs to see this. Let's connect!",
  "🔥 {city} food challenge: What's one dish from a local spot that changed your life? Be specific.",
  "📍 Neighborhood challenge: What street/area do you live near? Let's see how spread out we are.",
  "🎤 Open mic challenge: What's your {city} hot take that you've been holding back? Safe space, let it out.",
  "🤝 Kindness challenge: Share something nice that happened to you in {city} this week.",
];

const CHALLENGE_VARIABLES = {
  superlative: ["chaotic", "wholesome", "Texas", "unexpected", "hilarious"],
};

// ============================================================================
// COMMUNITY CALLOUTS - Celebrate or call out local behavior
// ============================================================================

const CALLOUT_TEMPLATES = {
  positive: [
    "🙌 Shoutout to whoever {positiveAction}. You made someone's day and probably don't even know it.",
    "💜 {city} showing up today. Saw someone {positiveAction} and it restored my faith in humanity.",
    "⭐ Big shoutout to {business} for {positiveAction}. This is why we support local.",
    "🎉 Just witnessed peak {city} energy: {positiveAction}. This is why I live here.",
    "👏 Can we give it up for {city} neighbors who {positiveAction}? Y'all are the real ones.",
  ],
  callout: [
    "👀 To the person who {negativeAction} at {location} today... we all saw that. Do better.",
    "🙄 PSA: If you're the type to {negativeAction}, just know... everyone judges you.",
    "😤 {city} pet peeve alert: People who {negativeAction}. Can we collectively stop?",
    "🚨 Friendly reminder that {negativeAction} is NOT a {city} vibe. Let's be better.",
    "⚠️ Attention {city}: If you {negativeAction}, we need to have a conversation.",
  ],
};

const CALLOUT_VARIABLES = {
  positiveAction: [
    "let someone merge on {road}",
    "returned a lost wallet at {landmark}",
    "paid for the car behind them at {restaurant}",
    "helped a stranger with their groceries at HEB",
    "cleaned up trash at {park} this morning",
  ],
  negativeAction: [
    "parks in the fire lane at HEB",
    "doesn't return shopping carts",
    "speeds through school zones",
    "leaves their dog's mess at the park",
    "takes up two parking spots",
  ],
};

// ============================================================================
// WOULD YOU RATHER - Local hypothetical scenarios
// ============================================================================

const WOULD_YOU_RATHER_TEMPLATES = [
  "🤔 {city} edition: Would you rather have {optionA} OR {optionB}? No cop-outs, you have to pick.",
  "⚖️ Hard choice time: {optionA} vs {optionB}. Where does {city} stand?",
  "🎲 {city} hypothetical: If you HAD to choose - {optionA} or {optionB}?",
  "💭 Real talk: Would you rather {optionA} OR {optionB}? Explain your reasoning.",
  "🤷 Impossible choice: {optionA}... or {optionB}? {city}, I need answers.",
];

const WOULD_YOU_RATHER_OPTIONS = [
  { a: "free breakfast tacos for life at ONE place", b: "50% off everywhere forever" },
  { a: "zero traffic forever but no new restaurants", b: "keep the traffic but get a Trader Joe's" },
  { a: "perfect 75° weather every day", b: "keep our seasons but get a beach nearby" },
  { a: "live next to HEB but hear the carts 24/7", b: "live 15 min away in perfect quiet" },
  { a: "have {road} permanently fixed", b: "get a new highway that bypasses it entirely" },
  { a: "keep {city} small but lose some amenities", b: "grow bigger but get everything Austin has" },
  { a: "always find parking but walk 10 minutes", b: "circle for parking but always find a close spot eventually" },
  { a: "your favorite restaurant is always empty", b: "it's always packed but the food is somehow better" },
  { a: "never hit another red light on {road}", b: "every restaurant delivery is always free" },
  { a: "get a direct train to downtown Austin", b: "keep cars but all highways are always clear" },
];

// ============================================================================
// CONFESSION BOOTH - Anonymous-style local confessions
// ============================================================================

const CONFESSION_TEMPLATES = [
  "🙈 {city} confession booth is OPEN: What's your guilty pleasure spot that you're embarrassed to admit you love?",
  "🤫 Confess your sins, {city}: What local norm do you secretly hate but pretend to be okay with?",
  "😬 Safe space confession: What popular {city} opinion do you secretly disagree with?",
  "🙊 Confession time: What's something about living in {city} that you'd never say out loud?",
  "💀 Dead honest: What {city} restaurant do people LOVE that you just don't get?",
  "🎭 Anonymous confessions: Reply with your {city} unpopular opinion. No judgment zone.",
  "🤐 Secret confession: What's your {city} guilty pleasure that you hope your neighbors don't judge?",
  "😅 Confession booth: What {city} thing have you been pretending to understand but actually don't?",
];

// ============================================================================
// PREDICTIONS - XP-Staked Community Predictions
// ============================================================================
//
// PHILOSOPHY: Polls are passive. Predictions create stakes.
// When users put their XP on the line, they become emotionally invested.
// Correct predictors earn bonus XP, creating a "local oracle" status.
//
// Predictions are contextual: weather predictions when storms are coming,
// traffic predictions before big events, civic predictions before votes.
// ============================================================================

/**
 * Prediction template structure
 * Each prediction has a question, two options, and resolution metadata
 */
interface PredictionTemplate {
  question: string;           // Template with {variables}
  optionA: string;            // YES/positive option
  optionB: string;            // NO/negative option
  category: PredictionCategory;
  dataSource: PredictionDataSource;
  /** Hours until resolution (from now) */
  resolvesInHours: number;
  /** XP reward for correct prediction */
  xpReward: number;
  /** Conditions when this prediction should be generated */
  conditions?: {
    minTemp?: number;
    maxTemp?: number;
    weatherConditions?: string[];
    timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
    dayType?: ("weekday" | "weekend")[];
    requiresEvents?: boolean;
    requiresTraffic?: boolean;
  };
}

// WEATHER PREDICTIONS - Auto-resolvable via OpenWeather API
const WEATHER_PREDICTIONS: PredictionTemplate[] = [
  // Rain predictions
  {
    question: "🔮 Prediction Time: Will it rain in {city} this weekend?",
    optionA: "🌧️ YES - Get the umbrella ready",
    optionB: "☀️ NO - We're staying dry",
    category: "weather",
    dataSource: "openweather",
    resolvesInHours: 72,
    xpReward: 25,
    conditions: { dayType: ["weekday"] }
  },
  {
    question: "🔮 Weather Oracle: Will {city} hit {temp}°F again tomorrow?",
    optionA: "🌡️ YES - Same heat tomorrow",
    optionB: "❄️ NO - Cooling down",
    category: "weather",
    dataSource: "openweather",
    resolvesInHours: 24,
    xpReward: 20,
    conditions: { minTemp: 85 }
  },
  {
    question: "🔮 Prediction: Will we see freezing temps in {city} this week?",
    optionA: "🥶 YES - Break out the jackets",
    optionB: "🌤️ NO - Texas winter is a myth",
    category: "weather",
    dataSource: "openweather",
    resolvesInHours: 168,
    xpReward: 30,
    conditions: { maxTemp: 50 }
  },
  {
    question: "🔮 Storm Watch: Will {city} get thunderstorms tonight?",
    optionA: "⛈️ YES - Storms are coming",
    optionB: "🌙 NO - Peaceful night ahead",
    category: "weather",
    dataSource: "openweather",
    resolvesInHours: 12,
    xpReward: 25,
    conditions: { weatherConditions: ["cloudy", "rain"] }
  },
];

// TRAFFIC PREDICTIONS - Require manual resolution or traffic API
const TRAFFIC_PREDICTIONS: PredictionTemplate[] = [
  {
    question: "🔮 Traffic Oracle: Will {road} be backed up during tomorrow's rush hour?",
    optionA: "🚗 YES - It's gonna be rough",
    optionB: "🏎️ NO - Smooth sailing",
    category: "traffic",
    dataSource: "traffic_api",
    resolvesInHours: 24,
    xpReward: 20,
    conditions: { dayType: ["weekday"] }
  },
  {
    question: "🔮 Friday Prediction: Will {road} be a parking lot at 5 PM?",
    optionA: "😤 YES - Total gridlock",
    optionB: "🙌 NO - Everyone left early",
    category: "traffic",
    dataSource: "traffic_api",
    resolvesInHours: 8,
    xpReward: 25,
    conditions: { dayType: ["weekday"], timeOfDay: ["morning", "afternoon"] }
  },
];

// EVENT PREDICTIONS - Manual resolution
const EVENT_PREDICTIONS: PredictionTemplate[] = [
  {
    question: "🔮 Event Prediction: Will {eventName} sell out?",
    optionA: "🎟️ YES - It's gonna be packed",
    optionB: "🪑 NO - Plenty of space",
    category: "events",
    dataSource: "manual",
    resolvesInHours: 48,
    xpReward: 25,
    conditions: { requiresEvents: true }
  },
  {
    question: "🔮 Traffic Prediction: Will {eventName} cause major traffic in {city}?",
    optionA: "🚗 YES - Avoid the area",
    optionB: "🛣️ NO - It'll be fine",
    category: "events",
    dataSource: "manual",
    resolvesInHours: 24,
    xpReward: 20,
    conditions: { requiresEvents: true }
  },
];

// LOCAL PREDICTIONS - Community-resolved (voters decide what happened)
// These are subjective predictions where the community votes on the outcome
// after the deadline passes. This creates engagement AND resolves the prediction.
const LOCAL_PREDICTIONS: PredictionTemplate[] = [
  {
    question: "🔮 Weekend Prediction: Will {park} be crowded this Saturday?",
    optionA: "👨‍👩‍👧‍👦 YES - Pack early",
    optionB: "🧘 NO - Plenty of space",
    category: "local",
    dataSource: "community",  // Community votes on outcome after deadline
    resolvesInHours: 72,
    xpReward: 20,
    conditions: { dayType: ["weekday"] }
  },
  {
    question: "🔮 Restaurant Bet: Will {restaurant} have a wait on Friday night?",
    optionA: "⏰ YES - Expect a line",
    optionB: "🪑 NO - Walk right in",
    category: "local",
    dataSource: "community",  // Community votes on outcome after deadline
    resolvesInHours: 48,
    xpReward: 15,
    conditions: { dayType: ["weekday"], timeOfDay: ["morning", "afternoon"] }
  },
  {
    question: "🔮 Weekend Vibe: Will downtown {city} be busy this Saturday night?",
    optionA: "🎉 YES - Party mode",
    optionB: "😴 NO - Ghost town",
    category: "local",
    dataSource: "community",
    resolvesInHours: 72,
    xpReward: 20,
    conditions: { dayType: ["weekday"] }
  },
];

// CIVIC PREDICTIONS (Phase 3 prep) - For school board, city council decisions
// TODO: Integrate with civic-templates.ts for full civic prediction support
const _CIVIC_PREDICTIONS: PredictionTemplate[] = [
  {
    question: "🔮 Civic Prediction: Will the {city} bond proposal pass?",
    optionA: "✅ YES - Community says yes",
    optionB: "❌ NO - Voters reject it",
    category: "civic",
    dataSource: "civic_api",
    resolvesInHours: 168,
    xpReward: 50,
  },
  {
    question: "🔮 School Board: Will LISD approve the new policy?",
    optionA: "✅ YES - It passes",
    optionB: "❌ NO - Back to the drawing board",
    category: "civic",
    dataSource: "civic_api",
    resolvesInHours: 48,
    xpReward: 35,
  },
];

// ============================================================================
// FARMERS MARKET - Hyperlocal market engagement with ACTIONABLE content
// ============================================================================

/**
 * ACTIONABLE FARMERS MARKET TEMPLATES
 *
 * These templates produce RICH, ACTIONABLE content that tells users:
 * - WHERE: Full address with distance
 * - WHEN: Opening hours and current status
 * - HOW: Clear CTA for directions
 *
 * The templates use {markers} for dynamic content:
 * - {marketName}: Market name
 * - {address}: Full street address
 * - {schedule}: Operating hours (e.g., "Sa-Su 10am-6pm")
 * - {distance}: Distance in miles (e.g., "1.8 mi")
 * - {products}: Top products (e.g., "fresh produce, local honey")
 * - {openStatus}: "OPEN NOW" or "Opens Saturday" etc.
 * - {city}: City name
 */
const FARMERS_MARKET_TEMPLATES = {
  // When market is OPEN TODAY - FOMO/urgency with full actionable details
  openToday: [
    `🥬 {marketName} is OPEN NOW!
📍 {address} ({landmarkAnchor})
🕐 {schedule}
Fresh produce, local vendors & more!
→ Tap for directions`,

    `🍅 MARKET DAY! {marketName} is open right now
📍 {address} ({landmarkAnchor})
🕐 {schedule}
Get there before the good stuff sells out!
→ See on Markets tab`,

    `🌽 {marketName} is OPEN for business!
📍 {address}{distanceText}
🕐 {schedule}
{products} and more fresh from the farm
→ Get directions`,

    `🥕 Fresh produce alert! {marketName}
📍 {address}{distanceText}
🕐 Open now - {schedule}
Who's making a market run today?
→ Tap for directions`,

    `🍯 Local market is LIVE! {marketName}
📍 {address}{distanceText}
🕐 {schedule}
Support local farmers & grab something fresh!
→ View on Markets tab`,
  ],

  // When market is COMING UP this week - build anticipation with details
  upcoming: [
    `📅 This weekend: {marketName}
📍 {address}{distanceText}
🕐 {schedule}
{products} - who's planning to go?
→ Check the Markets tab for more`,

    `🥬 Mark your calendar: {marketName}
📍 {address}{distanceText}
🕐 {schedule}
Fresh local produce awaits!
→ Get directions for the weekend`,

    `🍅 Weekend plans? {marketName} has you covered
📍 {address}{distanceText}
🕐 {schedule}
What's your go-to find there?
→ See on Markets tab`,

    `🌽 Coming up: {marketName}
📍 {address}{distanceText}
🕐 {schedule}
Pro tip: Get there early for the best selection!
→ Tap for directions`,
  ],

  // Discovery/engagement posts - still include key details
  discovery: [
    `Looking for fresh local produce? 🍅
{marketName} in {city} has you covered:
📍 {address}{distanceText}
🕐 {schedule}
→ Get directions`,

    `🥬 Local gem: {marketName}
📍 {address}{distanceText}
🕐 {schedule}
Anyone been? What's the best booth?
→ See on Markets tab`,

    `🧑‍🌾 Know your local markets?
{marketName} - {schedule}
📍 {address}{distanceText}
What other markets should I check out?
→ View all in Markets tab`,

    `Fresh finds at {marketName} 🥕
📍 {address}{distanceText}
🕐 {schedule}
{products} and more!
→ Tap for directions`,
  ],

  // Tips with actionable details
  tips: [
    `🤫 Insider tip: {marketName}
📍 {address}{distanceText}
🕐 {schedule}
Arrive early for the best {products}!
→ Get directions`,

    `🥬 Pro tip for {marketName}:
📍 {address}{distanceText}
🕐 {schedule}
Bring cash & reusable bags. Trust me.
→ See on Markets tab`,

    `💡 {marketName} hack:
📍 {address}{distanceText}
🕐 {schedule}
The vendors near the entrance have the freshest {products}
→ Tap for directions`,
  ],
};

// ============================================================================
// LANDMARK-ANCHORED FOOD/COFFEE POSTS
// ============================================================================
//
// PHILOSOPHY: Generic "best tacos in town?" posts get ignored. Hyperlocal posts
// that reference SPECIFIC landmarks people drive by every day create instant
// recognition and engagement. "Coffee spot near HEB" hits different because
// everyone knows exactly where HEB is.
//
// LANDMARK TIERS:
// - Tier 1: HEB, HEB Plus (universal - everyone shops there)
// - Tier 2: Lowe's, Target, Walmart, Costco, Home Depot (major retail anchors)
// - Tier 3: Parks, Cap Metro Rail Station (community gathering spots)
//
// TIME WINDOWS:
// - Morning (6-11am): Coffee, breakfast spots
// - Lunch (11am-2pm): Quick lunch, takeout
// - Afternoon (2-5pm): Coffee/snack runs, afternoon pick-me-up
// - Evening (5-9pm): Dinner spots, restaurants
// - Late night (9pm+): Late-night food options
// ============================================================================

/**
 * Landmark tiers - organized by recognition level
 * These should come from city config but have fallbacks
 */
const LANDMARK_TIERS = {
  tier1: ["HEB Plus", "HEB"],
  tier2: ["Lowe's", "Target", "Walmart", "Costco", "Home Depot"],
  tier3: ["Robin Bledsoe Park", "Devine Lake Park", "Cap Metro Rail Station"],
};

/**
 * Time-aware templates for landmark-anchored food posts
 *
 * PHILOSOPHY: Mix of questions (30%) and value-giving tips (70%)
 * Generic "where's good?" posts get ignored. Pro tips and recommendations
 * that share actual local knowledge create engagement.
 */
const LANDMARK_FOOD_TEMPLATES = {
  // MORNING (6-11am) - Coffee and breakfast focus
  // Mix: 3 questions, 7 value-giving
  morning: [
    // VALUE-GIVING (share actual knowledge)
    "☕ Pro tip: Dutch Bros drive-thru near {landmark} is way faster than Starbucks when the HEB lot is packed.",
    "🌅 If you're grabbing coffee by {landmark}, the one inside usually has shorter lines before 8am.",
    "🥞 PSA: The breakfast tacos at Torchy's near {landmark} go fast on weekends. Get there early!",
    "☕ Local hack: Park at {landmark} and walk to the coffee spot next door - saves 10 min in the drive-thru.",
    "🍳 Tried the breakfast spot by {landmark} yesterday. Their migas are legit. 🔥",
    "☕ FYI: The coffee place near {landmark} now has a mobile order pickup. Game changer for morning rush.",
    "🌮 Morning taco run near {landmark}? Dahlia Cafe downtown has the best chorizo and egg. Worth the drive.",
    // QUESTIONS (still engaging, but fewer)
    "☕ Coffee run near {landmark} - found any hidden gems lately?",
    "🥐 What's your move for breakfast near {landmark}? Trying to switch it up.",
    "☕ {landmark} morning crew - anyone tried the new coffee spot that opened?",
  ],

  // LUNCH (11am-2pm) - Quick lunch, takeout focus
  lunch: [
    // VALUE-GIVING
    "🍔 Lunch hack: Order online at Torchy's near {landmark}. Walk-in line is crazy at noon.",
    "🌮 Heads up: The taco truck by {landmark} has lunch specials Mon-Thu. Better prices than weekends.",
    "🥗 PSA: Chipotle near {landmark} is less packed around 1:30pm. The noon rush is brutal.",
    "🍕 Pro tip: MOD Pizza near {landmark} does a quick lunch slice deal. In and out in 15 min.",
    "🥡 If you're doing takeout near {landmark}, call ahead. Saves at least 10 min during lunch.",
    "🍔 Just discovered: Whataburger near {landmark} has a shaded drive-thru. Your car will thank you.",
    "🌯 The Tex-Mex spot by {landmark} has a lunch combo that's actually filling. Under $12.",
    // QUESTIONS
    "🍔 Best lunch spot near {landmark}? Tired of my usual rotation.",
    "🥪 Anyone know a quick lunch near {landmark} that's not fast food?",
    "🍜 {landmark} lunch break - what's your go-to when you only have 30 min?",
  ],

  // AFTERNOON (2-5pm) - Coffee/snack runs
  afternoon: [
    // VALUE-GIVING
    "☕ Afternoon tip: The coffee near {landmark} does happy hour 2-4pm. Cheaper than usual!",
    "🍩 Snack run success: Found that the bakery by {landmark} has fresh stuff around 3pm.",
    "☕ FYI: That coffee place near {landmark} has outdoor seating now. Perfect for this weather.",
    "🧁 Sweet tooth hack: Crumbl near {landmark} posts their weekly flavors on Monday. Plan accordingly.",
    "☕ Pro tip: The Starbucks inside {landmark} is usually less crowded than the drive-thru one.",
    "🍪 Just learned: The donut shop near {landmark} has afternoon discounts on day-olds. Still good!",
    "🥤 Smoothie rec: The spot by {landmark} makes them fresh. Way better than chain ones.",
    // QUESTIONS
    "☕ Best afternoon coffee near {landmark}? Need something strong to survive 3pm.",
    "🍨 Ice cream near {landmark}? It's definitely that kind of day.",
    "☕ {landmark} area afternoon crew - where's your pick-me-up spot?",
  ],

  // EVENING (5-9pm) - Dinner spots, restaurants
  evening: [
    // VALUE-GIVING
    "🍽️ Dinner hack: Call ahead to that restaurant near {landmark}. Walk-ins wait 45+ min on weekends.",
    "🍕 Pro tip: The pizza place by {landmark} does takeout faster than delivery. Worth the drive.",
    "🌮 Evening rec: Torchy's patio near {landmark} is nice when it cools down. Get there by 6pm.",
    "🍔 Just learned: In-N-Out by {landmark} has shorter lines on Tuesday nights. 🤷",
    "🍝 Date night tip: Black Walnut near {landmark} takes reservations now. Way less stressful.",
    "🥡 Takeout move: Order from the Thai place near {landmark} by 5:30pm. Kitchen gets slammed later.",
    "🍗 Wings rec: Pluckers near {landmark} has half-price wings on certain nights. Check their app.",
    // QUESTIONS
    "🍽️ Dinner near {landmark}? Looking for something family-friendly.",
    "🌯 Tex-Mex near {landmark}? Need my fix but tired of the usual spots.",
    "🍔 {landmark} dinner crew - what's the move tonight?",
  ],

  // LATE NIGHT (9pm+) - Late-night food options
  lateNight: [
    // VALUE-GIVING
    "🌙 Late-night PSA: Whataburger near {landmark} is 24/7. Drive-thru line dies down around 11pm.",
    "🍕 Pro tip: The pizza place near {landmark} is open until 11pm weekdays. Just called to confirm.",
    "🌮 Late-night hack: Torchy's near {landmark} closes at 10pm but lobby clears out around 9:30.",
    "🍔 FYI: The 24-hour spots near {landmark} get a second rush around midnight. Go at 10:30pm.",
    "🌙 Night owl tip: Fast food drive-thrus near {landmark} are way faster after 10pm.",
    // QUESTIONS
    "🌙 What's open late near {landmark}? Need options beyond Whataburger.",
    "🍕 Late-night eats near {landmark}? The usual spots are closed.",
    "🌙 {landmark} area night owls - where do you eat after 10pm?",
  ],

  // DISCOVERY - Hidden gems and new spots
  discovery: [
    // VALUE-GIVING
    "🆕 Update: That new spot by {landmark} just opened last week. Tried it - actually pretty solid.",
    "👀 Heads up: The restaurant near {landmark} changed ownership. New menu worth checking out.",
    "🔍 Hidden gem alert: There's a food trailer behind {landmark} most people miss. Legit BBQ.",
    "📍 Local tip: Skip the chains near {landmark}. The family-owned spot on the corner is 10x better.",
    "✨ Discovery: The coffee inside {landmark} started serving pastries from that local bakery. 👌",
    // QUESTIONS
    "🤔 Keep seeing that new spot by {landmark}. Anyone tried it yet?",
    "🗣️ What opened near {landmark} recently? Feel like I'm always last to know.",
    "💭 Best kept secret near {landmark}? Looking to try something new.",
  ],
};

// ============================================================================
// AI-DRIVEN GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate an AI-powered poll question
 * Uses OpenAI to create contextual, non-repetitive poll questions
 */
export async function generatePollPost(
  ctx: SituationContext,
  options: { useAI?: boolean } = {}
): Promise<EngagementPost | null> {
  const { city, weather, time } = ctx;

  // Pick a random context based on time/weather
  let contextPool: typeof POLL_CONTEXTS.food;

  if (time.hour >= 7 && time.hour <= 10) {
    // Morning - breakfast/coffee focused
    contextPool = POLL_CONTEXTS.food.filter(c =>
      ["coffee", "tacos", "brunch"].includes(c.topic)
    );
  } else if (time.hour >= 11 && time.hour <= 14) {
    // Lunch time
    contextPool = POLL_CONTEXTS.food.filter(c =>
      ["tacos", "bbq", "pizza", "burgers"].includes(c.topic)
    );
  } else if (time.hour >= 17 && time.hour <= 21) {
    // Evening/dinner
    contextPool = POLL_CONTEXTS.food.filter(c =>
      ["date night", "happy hour", "pizza", "bbq"].includes(c.topic)
    );
  } else if (time.isWeekend) {
    // Weekend - brunch and activities
    contextPool = [...POLL_CONTEXTS.food, ...POLL_CONTEXTS.activities];
  } else {
    // Default mix
    contextPool = POLL_CONTEXTS.food;
  }

  // Weather-based adjustments
  if (weather.condition === "rain" || weather.condition === "storm") {
    contextPool = POLL_CONTEXTS.food; // Indoor activities
  } else if (weather.temperature > 75 && weather.temperature < 90) {
    // Nice weather - add outdoor activities
    contextPool = [...contextPool, ...POLL_CONTEXTS.activities];
  }

  const context = contextPool[Math.floor(Math.random() * contextPool.length)];
  const variant = context.variants[Math.floor(Math.random() * context.variants.length)];

  // Generate the poll question
  const pollFormats = [
    `${context.emoji} Best ${variant} in ${city.name}? Drop your picks below!`,
    `${context.emoji} ${city.name} poll: Your favorite spot for ${variant}?`,
    `${context.emoji} Hot debate time: Where's the best ${variant} around here?`,
    `${context.emoji} Asking the real questions: Top ${variant} in ${city.name}?`,
    `${context.emoji} Let's settle this - best ${variant} near ${city.name}?`,
    `${context.emoji} ${city.name} locals: Where do you go for ${variant}?`,
  ];

  const message = pollFormats[Math.floor(Math.random() * pollFormats.length)];

  return {
    message,
    tag: "General",
    mood: context.emoji,
    author: `${city.name} poll_master_bot 📊`,
    is_bot: true,
    hidden: false,
    engagementType: "poll",
  };
}

/**
 * Generate a recommendation ask post
 */
export async function generateRecommendationPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time, weather } = ctx;

  // Build contextual queries
  const queries: string[] = [];

  if (time.hour >= 7 && time.hour <= 10) {
    queries.push("breakfast tacos that hit different", "good coffee that's not Starbucks", "quick breakfast spot");
  } else if (time.hour >= 11 && time.hour <= 14) {
    queries.push("solid lunch spot under $15", "quick healthy lunch", "hidden gem for lunch");
  } else if (time.hour >= 17 && time.hour <= 21) {
    queries.push("dinner that won't break the bank", "date night spot", "family-friendly dinner place");
  }

  if (time.isWeekend) {
    queries.push("brunch with good mimosas", "something fun to do today", "good patio weather activities");
  }

  if (weather.temperature > 90) {
    queries.push("best AC'd spots to escape the heat", "cold drinks after being outside");
  }

  // Services are always relevant
  const allContexts = [...POLL_CONTEXTS.services];
  const randomService = allContexts[Math.floor(Math.random() * allContexts.length)];
  queries.push(`a trustworthy ${randomService.variants[0]}`);

  const query = queries[Math.floor(Math.random() * queries.length)];
  const template = RECOMMENDATION_TEMPLATES[Math.floor(Math.random() * RECOMMENDATION_TEMPLATES.length)];
  const message = template.replace("{query}", query);

  return {
    message,
    tag: "General",
    mood: "🤔",
    author: `${city.name} curious_neighbor_bot 🤔`,
    is_bot: true,
    hidden: false,
    engagementType: "recommendation",
  };
}

/**
 * Generate a venue check-in post
 * "What's happening at [venue] tonight?" with witty one-liner
 */
export async function generateVenueCheckinPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time, events } = ctx;

  // Only generate during evening/night hours or if there's an event
  if (time.hour < 16 && events.length === 0) {
    return null;
  }

  // Pick a venue - prefer event venues if available
  let venue: string;
  if (events.length > 0) {
    venue = events[0].venue;
  } else {
    // Pick from city's popular venues/restaurants
    const venues = [
      ...city.landmarks.venues,
      ...city.landmarks.restaurants,
    ];
    const selectedEntry = venues[Math.floor(Math.random() * venues.length)];
    venue = getLandmarkDisplay(selectedEntry);
  }

  const template = VENUE_CHECKIN_TEMPLATES[Math.floor(Math.random() * VENUE_CHECKIN_TEMPLATES.length)];
  const message = template.replace("{venue}", venue);

  return {
    message,
    tag: "General",
    mood: "👀",
    author: `${city.name} venue_vibes_bot 📍`,
    is_bot: true,
    hidden: false,
    engagementType: "venue_checkin",
  };
}

/**
 * Generate a school pickup traffic alert
 * Only triggers ~15 minutes before school dismissal on weekdays
 */
export async function generateSchoolAlertPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time } = ctx;

  // Only on weekdays, 15-30 min before dismissal
  if (!time.isWeekday) return null;

  const dismissalHour = city.rushHours.schoolDismissal;
  const minutesToDismissal = (dismissalHour * 60) - (time.hour * 60 + new Date().getMinutes());

  // Only alert if 10-30 minutes before dismissal
  if (minutesToDismissal < 10 || minutesToDismissal > 30) {
    return null;
  }

  // Pick a school and nearby road
  const allSchools = [
    ...city.schools.high,
    ...city.schools.middle,
    ...city.schools.elementary,
  ];
  const school = allSchools[Math.floor(Math.random() * allSchools.length)];
  const road = city.roads.schoolZones[Math.floor(Math.random() * city.roads.schoolZones.length)];

  const template = SCHOOL_ALERT_TEMPLATES[Math.floor(Math.random() * SCHOOL_ALERT_TEMPLATES.length)];
  const message = template
    .replace("{school}", school)
    .replace(/{road}/g, road);

  return {
    message,
    tag: "Traffic",
    mood: "🏫",
    author: `${city.name} school_zone_alert_bot 🏫`,
    is_bot: true,
    hidden: false,
    engagementType: "school_alert",
  };
}

/**
 * Generate a local spotlight/foodie post
 * Uses the munching_bot to highlight local food scene
 */
export async function generateLocalSpotlightPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time, weather } = ctx;

  const spotlightTemplates = [
    "🍔 {restaurant} appreciation post. If you haven't tried it, you're missing out.",
    "😋 Hot take: {restaurant} might be the most underrated spot in {city}. Fight me.",
    "🌮 PSA: {restaurant} exists and some of y'all still don't know about it.",
    "🔥 {restaurant} check. What's your go-to order there?",
    "💯 {restaurant} is that spot. What makes it YOUR spot?",
    "🤤 Randomly thinking about {restaurant}... now I'm hungry.",
    "⭐ {restaurant} stan account activated. What's your favorite thing there?",
    "🎯 Unpopular opinion time: {restaurant} > everywhere else. Agree?",
  ];

  const restaurantEntry = city.landmarks.restaurants[
    Math.floor(Math.random() * city.landmarks.restaurants.length)
  ];
  const restaurant = getLandmarkDisplay(restaurantEntry);

  const template = spotlightTemplates[Math.floor(Math.random() * spotlightTemplates.length)];
  const message = template
    .replace(/{restaurant}/g, restaurant)
    .replace("{city}", city.name);

  return {
    message,
    tag: "General",
    mood: "🍔",
    author: `${city.name} munching_bot 🍔`,
    is_bot: true,
    hidden: false,
    engagementType: "local_spotlight",
  };
}

// ============================================================================
// NEW ENGAGEMENT TYPES
// ============================================================================

/**
 * Generate a CONTEXTUAL "This or That" binary choice poll
 *
 * PHILOSOPHY: Generic food polls are BORING and get ignored.
 * Users engage with polls that reflect their CURRENT REALITY:
 * - The weather outside right now
 * - Events happening today
 * - The time of day and day of week
 * - Traffic conditions
 *
 * This function prioritizes contextual templates over generic ones.
 */
export async function generateThisOrThatPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, weather, time, events, traffic } = ctx;
  const timeOfDay = getTimeOfDay(time.hour);
  const dayType = time.isWeekend ? "weekend" : "weekday";

  // Build variables for template filling
  const vars: Record<string, string> = {
    city: city.name,
    temp: String(Math.round(weather.temperature)),
    road: city.roads.major[Math.floor(Math.random() * city.roads.major.length)],
  };

  // Add event variables if events exist
  if (events && events.length > 0) {
    vars.eventName = events[0].name;
    vars.venue = events[0].venue;
  }

  // Collect all matching contextual templates
  const matchingTemplates: ContextualPollTemplate[] = [];

  // Check WEATHER templates (highest priority - most immediately relevant)
  for (const poll of WEATHER_CONTEXTUAL_POLLS) {
    if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) {
      matchingTemplates.push(poll);
    }
  }

  // Check TIME templates
  for (const poll of TIME_CONTEXTUAL_POLLS) {
    if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) {
      matchingTemplates.push(poll);
    }
  }

  // Check EVENT templates (only if events exist)
  if (events && events.length > 0) {
    for (const poll of EVENT_CONTEXTUAL_POLLS) {
      if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) {
        matchingTemplates.push(poll);
      }
    }
  }

  // Check TRAFFIC templates (only if traffic is notable)
  if (traffic && traffic.congestionLevel > 0.3) {
    for (const poll of TRAFFIC_CONTEXTUAL_POLLS) {
      if (matchesConditions(poll.conditions, ctx, timeOfDay, dayType)) {
        matchingTemplates.push(poll);
      }
    }
  }

  // If we have contextual matches, use one of them
  if (matchingTemplates.length > 0) {
    const selected = matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)];

    // Fill in the template
    let message = selected.template;
    for (const [key, value] of Object.entries(vars)) {
      message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    return {
      message,
      tag: "General",
      mood: "📊",
      author: `${city.name} poll_master_bot 📊`,
      is_bot: true,
      hidden: false,
      engagementType: "this_or_that",
      options: [selected.optionA, selected.optionB],
    };
  }

  // FALLBACK: Use the old system with base choices (should rarely happen)
  const choices = getContextualChoices(ctx);
  if (choices.length === 0) {
    const fallback = [...BASE_CHOICES, ...LIFESTYLE_CHOICES];
    const choice = fallback[Math.floor(Math.random() * fallback.length)];
    const template = THIS_OR_THAT_TEMPLATES[Math.floor(Math.random() * THIS_OR_THAT_TEMPLATES.length)];
    const message = template
      .replace("{a}", choice.a)
      .replace("{b}", choice.b)
      .replace("{city}", city.name);

    return {
      message,
      tag: "General",
      mood: "⚔️",
      author: `${city.name} poll_master_bot 📊`,
      is_bot: true,
      hidden: false,
      engagementType: "this_or_that",
      options: [choice.a, choice.b],
    };
  }

  const choice = choices[Math.floor(Math.random() * choices.length)];
  const template = THIS_OR_THAT_TEMPLATES[Math.floor(Math.random() * THIS_OR_THAT_TEMPLATES.length)];

  const message = template
    .replace("{a}", choice.a)
    .replace("{b}", choice.b)
    .replace("{city}", city.name);

  return {
    message,
    tag: "General",
    mood: "⚔️",
    author: `${city.name} poll_master_bot 📊`,
    is_bot: true,
    hidden: false,
    engagementType: "this_or_that",
    options: [choice.a, choice.b],
  };
}

/**
 * Check if a contextual poll template's conditions match the current context
 */
function matchesConditions(
  conditions: ContextualPollTemplate["conditions"],
  ctx: SituationContext,
  timeOfDay: "morning" | "afternoon" | "evening" | "night",
  dayType: "weekday" | "weekend"
): boolean {
  const { weather, events, traffic } = ctx;

  // Check temperature conditions
  if (conditions.minTemp !== undefined && weather.temperature < conditions.minTemp) {
    return false;
  }
  if (conditions.maxTemp !== undefined && weather.temperature > conditions.maxTemp) {
    return false;
  }

  // Check weather conditions
  if (conditions.weatherConditions && conditions.weatherConditions.length > 0) {
    if (!conditions.weatherConditions.includes(weather.condition)) {
      return false;
    }
  }

  // Check time of day
  if (conditions.timeOfDay && conditions.timeOfDay.length > 0) {
    if (!conditions.timeOfDay.includes(timeOfDay)) {
      return false;
    }
  }

  // Check day type
  if (conditions.dayType && conditions.dayType.length > 0) {
    if (!conditions.dayType.includes(dayType)) {
      return false;
    }
  }

  // Check if events are required
  if (conditions.requiresEvents && (!events || events.length === 0)) {
    return false;
  }

  // Check if traffic is required
  if (conditions.requiresTraffic && (!traffic || traffic.congestionLevel <= 0.3)) {
    return false;
  }

  return true;
}

/**
 * Generate a FOMO (time-sensitive) alert post
 * Creates urgency around events, happy hours, weather windows, etc.
 */
export async function generateFomoAlertPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time, events, weather } = ctx;
  const hour = time.hour;

  // Determine what type of FOMO alert to generate
  let fomoType: keyof typeof FOMO_TEMPLATES | undefined = undefined;
  let templates: string[] | undefined = undefined;
  let variables: Record<string, string> = {};

  // Event starting soon (if we have events)
  if (events.length > 0) {
    const event = events[0];
    const eventTime = new Date(event.startTime);
    const now = new Date();
    const minutesUntil = Math.floor((eventTime.getTime() - now.getTime()) / 60000);

    if (minutesUntil > 15 && minutesUntil < 90) {
      fomoType = "eventStarting";
      templates = FOMO_TEMPLATES.eventStarting;
      variables = {
        event: event.name,
        venue: event.venue,
        minutes: String(minutesUntil),
      };
    }
  }

  // Happy hour alert (3:30-5:30 PM on weekdays)
  if (!fomoType && time.isWeekday && hour >= 15 && hour <= 17) {
    const minutesUntil = hour < 16 ? (16 - hour) * 60 - new Date().getMinutes() : 30;
    if (minutesUntil > 0 && minutesUntil <= 45) {
      fomoType = "happyHour";
      templates = FOMO_TEMPLATES.happyHour;
      const restaurantEntry = city.landmarks.restaurants[Math.floor(Math.random() * city.landmarks.restaurants.length)];
      variables = {
        restaurant: getLandmarkDisplay(restaurantEntry),
        minutes: String(minutesUntil),
      };
    }
  }

  // Lunch rush warning (11:00-11:30 AM)
  if (!fomoType && hour === 11 && new Date().getMinutes() < 30) {
    fomoType = "lunchRush";
    templates = FOMO_TEMPLATES.lunchRush;
    const restaurantEntry = city.landmarks.restaurants[Math.floor(Math.random() * city.landmarks.restaurants.length)];
    variables = {
      restaurant: getLandmarkDisplay(restaurantEntry),
      minutes: String(30 - new Date().getMinutes()),
    };
  }

  // Sunset alert (calculate approximate sunset time)
  if (!fomoType && hour >= 17 && hour <= 19) {
    // Approximate sunset check (varies by season, simplified)
    const sunsetHour = 19; // Approximate for Texas
    const minutesUntilSunset = (sunsetHour * 60 + 30) - (hour * 60 + new Date().getMinutes());
    if (minutesUntilSunset > 15 && minutesUntilSunset < 60) {
      fomoType = "sunsetAlert";
      templates = FOMO_TEMPLATES.sunsetAlert;
      const venueEntry = city.landmarks.venues[Math.floor(Math.random() * city.landmarks.venues.length)];
      variables = {
        venue: getLandmarkDisplay(venueEntry),
        minutes: String(minutesUntilSunset),
      };
    }
  }

  // Perfect weather window
  if (!fomoType && weather.condition === "clear" && weather.temperature >= 65 && weather.temperature <= 85) {
    fomoType = "weatherWindow";
    templates = FOMO_TEMPLATES.weatherWindow;
    const activities = ["a walk", "outdoor dining", "the park", "a patio hang"];
    variables = {
      activity: activities[Math.floor(Math.random() * activities.length)],
      minutes: String(60 + Math.floor(Math.random() * 60)), // 60-120 min window
    };
  }

  // If no FOMO opportunity, return null
  if (!fomoType || !templates) {
    return null;
  }

  const template = templates[Math.floor(Math.random() * templates.length)];
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return {
    message,
    tag: "General",
    mood: "⏰",
    author: `${city.name} fomo_alert_bot ⚡`,
    is_bot: true,
    hidden: false,
    engagementType: "fomo_alert",
  };
}

/**
 * Generate a Weekly Roundup post
 * Summarizes the week's highlights and asks for community input
 */
export async function generateWeeklyRoundupPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time, weather, events } = ctx;

  // Only generate on Sundays or Saturdays
  if (time.dayOfWeek !== 0 && time.dayOfWeek !== 6) {
    return null;
  }

  // Build summary content (would ideally pull from actual data)
  const trendingTopics = [
    "traffic on 183A",
    "new restaurant openings",
    "school events",
    "weekend brunch spots",
    "local business shoutouts",
    "weather updates",
    "community events",
  ];

  const weatherSummaries = [
    `Averaged ${weather.temperature}°F this week`,
    `Mostly ${weather.condition} skies`,
    `${weather.temperature > 80 ? "Hot" : weather.temperature < 60 ? "Cool" : "Perfect"} temps all week`,
  ];

  const trafficTips = [
    "183A was clutch during rush hour",
    "School zones cleared up by 4pm",
    "Morning commute was smoother than usual",
    "Ronald Reagan Blvd held up well",
    "Crystal Falls was the move this week",
  ];

  const upcomingEventsText = events.length > 0
    ? events.slice(0, 2).map(e => e.name).join(", ")
    : "Check the Events tab for what's coming!";

  const template = WEEKLY_ROUNDUP_TEMPLATES[Math.floor(Math.random() * WEEKLY_ROUNDUP_TEMPLATES.length)];
  const message = template
    .replace("{city}", city.name)
    .replace("{trending}", trendingTopics[Math.floor(Math.random() * trendingTopics.length)])
    .replace("{weatherSummary}", weatherSummaries[Math.floor(Math.random() * weatherSummaries.length)])
    .replace("{trafficTip}", trafficTips[Math.floor(Math.random() * trafficTips.length)])
    .replace("{upcomingEvents}", upcomingEventsText);

  return {
    message,
    tag: "General",
    mood: "📊",
    author: `${city.name} weekly_pulse_bot 📰`,
    is_bot: true,
    hidden: false,
    engagementType: "weekly_roundup",
  };
}

// ============================================================================
// NEW HIGH-ENGAGEMENT POST GENERATORS
// ============================================================================

/**
 * Helper to get random city-specific variables for templates
 * Now uses getLandmarkDisplay for full location specificity (e.g., "HEB Plus on Hero Way")
 */
function getCityVariables(city: CityConfig): Record<string, string> {
  const roads = city.roads.major;
  const restaurants = city.landmarks.restaurants;
  const venues = city.landmarks.venues;
  const landmarks = city.landmarks.shopping;

  // Helper to get random entry with full display
  const randomDisplay = (arr: LandmarkEntry[]): string => {
    return getLandmarkDisplay(arr[Math.floor(Math.random() * arr.length)]);
  };

  // Find a park from venues
  const parkEntry = venues.find(v => getLandmarkName(v).toLowerCase().includes('park'));
  const parkDisplay = parkEntry ? getLandmarkDisplay(parkEntry) : randomDisplay(venues);

  return {
    city: city.name,
    road: roads[Math.floor(Math.random() * roads.length)],
    altRoute: city.roads.highways[Math.floor(Math.random() * city.roads.highways.length)],
    restaurant: randomDisplay(restaurants),
    venue: randomDisplay(venues),
    landmark: randomDisplay(landmarks),
    park: parkDisplay,
    alternative: randomDisplay(restaurants),
    business: randomDisplay(restaurants),
    location: randomDisplay(landmarks),
    hiddenSpot: randomDisplay(venues),
    parkingSpot: `the lot behind ${getLandmarkDisplay(landmarks[0])}`,
    area: `the ${roads[0]} corridor`,
    destination: "downtown Austin",
  };
}

/**
 * Helper to pick random item from array
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Fill template with variables, handling nested variable references
 */
function fillEngagementTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  // Do multiple passes to handle nested variables like {road} inside {positiveAction}
  for (let i = 0; i < 3; i++) {
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }
  return result;
}

/**
 * Generate a Hot Take post
 * Controversial local opinions that demand responses
 */
export async function generateHotTakePost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time, traffic } = ctx;
  const vars = getCityVariables(city);

  // Pick category based on context
  let category: keyof typeof HOT_TAKE_TEMPLATES;
  if (traffic.congestionLevel > 0.2 || time.isRushHour) {
    category = Math.random() < 0.6 ? "traffic" : "food";
  } else if (time.hour >= 11 && time.hour <= 14) {
    category = "food";
  } else if (time.hour >= 17 && time.hour <= 21) {
    category = Math.random() < 0.5 ? "food" : "local";
  } else {
    category = pickRandom(["food", "traffic", "local", "services"] as const);
  }

  const templates = HOT_TAKE_TEMPLATES[category];
  const template = pickRandom(templates);

  // Add category-specific variables
  const extendedVars = {
    ...vars,
    food: pickRandom(HOT_TAKE_VARIABLES.food),
    businessType: pickRandom(HOT_TAKE_VARIABLES.businessType),
    need: pickRandom(HOT_TAKE_VARIABLES.need),
  };

  const message = fillEngagementTemplate(template, extendedVars);

  return {
    message,
    tag: "General",
    mood: "🔥",
    author: `${city.name} hot_take_bot 🌶️`,
    is_bot: true,
    hidden: false,
    engagementType: "hot_take",
  };
}

/**
 * Generate an Insider Tip post
 * "Only locals know" content that creates insider status
 */
export async function generateInsiderTipPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);

  const template = pickRandom(INSIDER_TIP_TEMPLATES);

  const extendedVars = {
    ...vars,
    secretItem: pickRandom(INSIDER_VARIABLES.secretItem),
    time: pickRandom(INSIDER_VARIABLES.time),
    day: pickRandom(INSIDER_VARIABLES.day),
    specificSpot: pickRandom(INSIDER_VARIABLES.specificSpot),
    feature: pickRandom(INSIDER_VARIABLES.feature),
    item: pickRandom(INSIDER_VARIABLES.item),
  };

  const message = fillEngagementTemplate(template, extendedVars);

  return {
    message,
    tag: "General",
    mood: "🤫",
    author: `${city.name} local_insider_bot 💡`,
    is_bot: true,
    hidden: false,
    engagementType: "insider_tip",
  };
}

/**
 * Generate a Nostalgia Trigger post
 * "Remember when..." emotional engagement
 */
export async function generateNostalgiaTriggerPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);

  const template = pickRandom(NOSTALGIA_TEMPLATES);

  const extendedVars = {
    ...vars,
    memory: pickRandom(NOSTALGIA_VARIABLES.memory),
    oldTime: pickRandom(NOSTALGIA_VARIABLES.oldTime),
    newTime: pickRandom(NOSTALGIA_VARIABLES.newTime),
    oldFeature: pickRandom(NOSTALGIA_VARIABLES.oldFeature),
    closedBusiness: pickRandom(NOSTALGIA_VARIABLES.closedBusiness),
    change: pickRandom(NOSTALGIA_VARIABLES.change),
    years: pickRandom(NOSTALGIA_VARIABLES.years),
    event: "the city's big annual festival",
  };

  const message = fillEngagementTemplate(template, extendedVars);

  return {
    message,
    tag: "General",
    mood: "🕰️",
    author: `${city.name} memory_lane_bot 📸`,
    is_bot: true,
    hidden: false,
    engagementType: "nostalgia_trigger",
  };
}

/**
 * Generate a Neighbor Challenge post
 * Call-to-action engagement
 */
export async function generateNeighborChallengePost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);

  const template = pickRandom(CHALLENGE_TEMPLATES);

  const extendedVars = {
    ...vars,
    superlative: pickRandom(CHALLENGE_VARIABLES.superlative),
  };

  const message = fillEngagementTemplate(template, extendedVars);

  return {
    message,
    tag: "General",
    mood: "📣",
    author: `${city.name} challenge_bot 🎯`,
    is_bot: true,
    hidden: false,
    engagementType: "neighbor_challenge",
  };
}

/**
 * Generate a Community Callout post
 * Celebrate or (gently) call out local behavior
 */
export async function generateCommunityCalloutPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);

  // 70% positive, 30% callout (keep it mostly positive)
  const isPositive = Math.random() < 0.7;
  const templates = isPositive ? CALLOUT_TEMPLATES.positive : CALLOUT_TEMPLATES.callout;
  const template = pickRandom(templates);

  const extendedVars = {
    ...vars,
    positiveAction: fillEngagementTemplate(pickRandom(CALLOUT_VARIABLES.positiveAction), vars),
    negativeAction: pickRandom(CALLOUT_VARIABLES.negativeAction),
  };

  const message = fillEngagementTemplate(template, extendedVars);

  return {
    message,
    tag: "General",
    mood: isPositive ? "🙌" : "👀",
    author: `${city.name} community_vibes_bot ${isPositive ? "💜" : "🧐"}`,
    is_bot: true,
    hidden: false,
    engagementType: "community_callout",
  };
}

/**
 * Generate a Would You Rather post
 * Local hypothetical scenarios
 */
export async function generateWouldYouRatherPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);

  const template = pickRandom(WOULD_YOU_RATHER_TEMPLATES);
  const choice = pickRandom(WOULD_YOU_RATHER_OPTIONS);

  // Fill in city-specific variables in the options
  const optionA = fillEngagementTemplate(choice.a, vars);
  const optionB = fillEngagementTemplate(choice.b, vars);

  const extendedVars = {
    ...vars,
    optionA,
    optionB,
  };

  const message = fillEngagementTemplate(template, extendedVars);

  return {
    message,
    tag: "General",
    mood: "🤔",
    author: `${city.name} hypothetical_bot ⚖️`,
    is_bot: true,
    hidden: false,
    engagementType: "would_you_rather",
    options: [optionA, optionB],
  };
}

/**
 * Generate a Confession Booth post
 * Anonymous-style local confessions prompt
 */
export async function generateConfessionBoothPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city } = ctx;
  const vars = getCityVariables(city);

  const template = pickRandom(CONFESSION_TEMPLATES);
  const message = fillEngagementTemplate(template, vars);

  return {
    message,
    tag: "General",
    mood: "🙈",
    author: `${city.name} confession_booth_bot 🤫`,
    is_bot: true,
    hidden: false,
    engagementType: "confession_booth",
  };
}

/**
 * Generate a Prediction post
 * XP-staked predictions about local outcomes
 *
 * PHILOSOPHY: Predictions transform passive poll voters into active predictors.
 * By staking XP, users become emotionally invested in outcomes.
 * Correct predictors earn bonus XP and build "local oracle" reputation.
 *
 * Prediction types:
 * - WEATHER: Auto-resolvable via OpenWeather API (highest frequency)
 * - TRAFFIC: Manual or traffic API resolution
 * - EVENTS: Manual resolution based on event outcomes
 * - LOCAL: Community-verified predictions
 * - CIVIC: Phase 3 - school board, city council decisions
 */
export async function generatePredictionPost(
  ctx: SituationContext,
  options: { skipEventPredictions?: boolean } = {}
): Promise<EngagementPost | null> {
  const { city, weather, time, events, traffic } = ctx;
  const { skipEventPredictions = false } = options;
  const timeOfDay = getTimeOfDay(time.hour);
  const dayType = time.isWeekday ? "weekday" : "weekend";

  // Build variables for template filling
  const vars = getCityVariables(city);
  const extendedVars: Record<string, string> = {
    ...vars,
    temp: String(Math.round(weather.temperature)),
    businessType: pickRandom(HOT_TAKE_VARIABLES.businessType),
  };

  // Add event variables if events exist
  if (events && events.length > 0) {
    extendedVars.eventName = events[0].name;
    extendedVars.venue = events[0].venue;
  }

  // Collect matching prediction templates
  const matchingTemplates: PredictionTemplate[] = [];

  // CRITICAL: Check forecast for snow FIRST before static templates
  // This prevents asking "will it rain?" when snow is actually forecast
  const hasSnowInForecast = weather.forecast?.some(day => day.snowfallCm > 0) ?? false;

  // Helper to check if prediction conditions match
  const matchesPredictionConditions = (template: PredictionTemplate): boolean => {
    const cond = template.conditions;
    if (!cond) return true;  // No conditions = always matches

    // Temperature checks
    if (cond.minTemp !== undefined && weather.temperature < cond.minTemp) return false;
    if (cond.maxTemp !== undefined && weather.temperature > cond.maxTemp) return false;

    // Weather condition checks
    if (cond.weatherConditions && cond.weatherConditions.length > 0) {
      if (!cond.weatherConditions.includes(weather.condition)) return false;
    }

    // Time of day checks
    if (cond.timeOfDay && cond.timeOfDay.length > 0) {
      if (!cond.timeOfDay.includes(timeOfDay)) return false;
    }

    // Day type checks
    if (cond.dayType && cond.dayType.length > 0) {
      if (!cond.dayType.includes(dayType)) return false;
    }

    // Events required
    if (cond.requiresEvents && (!events || events.length === 0)) return false;

    // Traffic required
    if (cond.requiresTraffic && (!traffic || traffic.congestionLevel <= 0.3)) return false;

    return true;
  };

  // Check WEATHER predictions (most common, auto-resolvable)
  // SKIP static rain templates when snow is in the forecast!
  // Snow is rare and exciting - we should ask about snow, not rain
  if (hasSnowInForecast) {
    // Snow is forecast - add snow-specific prediction immediately!
    // This takes priority over generic "will it rain?" questions
    matchingTemplates.push({
      question: `🔮 Prediction Time: How much snow will ${city.name} actually get?`,
      optionA: "❄️ More than forecast - Winter wonderland!",
      optionB: "🥱 Less than expected - Texas tease",
      category: "weather",
      dataSource: "openweather",
      resolvesInHours: 72,
      xpReward: 25,
    });
  } else {
    for (const template of WEATHER_PREDICTIONS) {
      if (matchesPredictionConditions(template)) {
        matchingTemplates.push(template);
      }
    }
  }

  // Check TRAFFIC predictions
  for (const template of TRAFFIC_PREDICTIONS) {
    if (matchesPredictionConditions(template)) {
      matchingTemplates.push(template);
    }
  }

  // Check EVENT predictions (only if events exist AND not skipping due to seed dedup)
  // Skip in seed mode because regular seed posts already create Events posts
  // This prevents duplicate "Texas Stars vs Ontario Reign" type posts
  if (!skipEventPredictions && events && events.length > 0) {
    for (const template of EVENT_PREDICTIONS) {
      if (matchesPredictionConditions(template)) {
        matchingTemplates.push(template);
      }
    }
  }

  // Check LOCAL predictions
  for (const template of LOCAL_PREDICTIONS) {
    if (matchesPredictionConditions(template)) {
      matchingTemplates.push(template);
    }
  }

  // If no contextual matches, add weather-condition-aware default predictions
  // Use FORECAST data for future predictions, not current conditions!
  // This fixes the bug where we ask "will it rain?" when snow is actually forecast
  if (matchingTemplates.length === 0) {
    // Get weekend forecast days (Saturday = 6, Sunday = 0)
    const getWeekendForecast = (forecast: ForecastDay[] | undefined): ForecastDay | null => {
      if (!forecast || forecast.length === 0) return null;
      // Find first Saturday or Sunday in forecast
      for (const day of forecast) {
        const dayOfWeek = new Date(day.date).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return day;
        }
      }
      // If no weekend in 3-day forecast, use the last available day
      return forecast[forecast.length - 1];
    };

    const weekendForecast = getWeekendForecast(weather.forecast);

    // Use forecast data if available, otherwise fall back to current conditions
    if (weekendForecast) {
      // FORECAST-BASED predictions - much more accurate!
      if (weekendForecast.snowfallCm > 0) {
        // Snow forecast - ask about snow, NOT rain!
        matchingTemplates.push({
          question: `🔮 Prediction Time: How much snow will ${city.name} actually get this weekend?`,
          optionA: "❄️ More than forecast - Winter wonderland!",
          optionB: "🥱 Less than expected - Texas tease",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else if (weekendForecast.precipitationMm > 1 || weekendForecast.condition === 'rain' || weekendForecast.condition === 'storm') {
        // Rain forecast - ask about rain
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will the rain in ${city.name} this weekend ruin outdoor plans?`,
          optionA: "🌧️ YES - Stay inside this weekend",
          optionB: "☀️ NO - Still plenty of dry time",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else if (weekendForecast.tempLow < 40) {
        // Cold weekend forecast
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name} actually dip below freezing this weekend?`,
          optionA: "🥶 YES - Protect the pipes!",
          optionB: "🌡️ NO - Cold but not that cold",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else if (weekendForecast.tempHigh > 85) {
        // Hot weekend forecast
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name} hit ${Math.round(weekendForecast.tempHigh)}°F this weekend?`,
          optionA: "🔥 YES - Pool weather confirmed",
          optionB: "🌤️ NO - Slightly cooler than forecast",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else if (weekendForecast.condition === 'clear' && weekendForecast.tempHigh >= 60 && weekendForecast.tempHigh <= 80) {
        // Perfect weather forecast
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name}'s perfect weekend weather (${weekendForecast.tempLow}-${weekendForecast.tempHigh}°F) actually hold?`,
          optionA: "☀️ YES - Lock in those outdoor plans!",
          optionB: "😬 NO - Something will change",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else {
        // Generic weekend prediction with forecast temps
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name} stay around ${weekendForecast.tempHigh}°F this weekend?`,
          optionA: "☀️ YES - Right on target",
          optionB: "🎲 NO - Weather will surprise us",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      }
    } else {
      // FALLBACK: No forecast data available, use current conditions
      const currentTemp = weather.temperature;
      const currentCondition = weather.condition;

      if (currentCondition === 'rain' || currentCondition === 'storm') {
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will the rain clear up in ${city.name} by tomorrow?`,
          optionA: "☀️ YES - Sun's coming back",
          optionB: "🌧️ NO - More rain on the way",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 24,
          xpReward: 25,
        });
      } else if (currentCondition === 'snow') {
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name} see more snow this week?`,
          optionA: "❄️ YES - More flurries coming",
          optionB: "☀️ NO - That was it",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else if (currentTemp < 55) {
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name} warm up above 60°F this week?`,
          optionA: "☀️ YES - Warmer days coming",
          optionB: "🥶 NO - Bundle up all week",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else if (currentTemp > 85) {
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name} get any relief from this heat this week?`,
          optionA: "🌡️ YES - Cooler temps coming",
          optionB: "🔥 NO - Stay hot all week",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      } else {
        matchingTemplates.push({
          question: `🔮 Prediction Time: Will ${city.name} have perfect patio weather (65-80°F) this weekend?`,
          optionA: "☀️ YES - Beautiful days ahead",
          optionB: "😬 NO - Mother nature has other plans",
          category: "weather",
          dataSource: "openweather",
          resolvesInHours: 72,
          xpReward: 25,
        });
      }
    }
  }

  // Select a random matching template
  const selected = pickRandom(matchingTemplates);

  // Fill in the template variables
  let message = fillEngagementTemplate(selected.question, extendedVars);

  // Calculate resolution time
  const resolvesAt = new Date(Date.now() + selected.resolvesInHours * 60 * 60 * 1000);

  // Build the XP reward announcement into the message
  const votingDeadline = new Date(resolvesAt.getTime() - 2 * 60 * 60 * 1000); // 2 hours before resolution
  const deadlineStr = votingDeadline.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  message += `\n\n💎 Correct guessers get ${selected.xpReward} XP! Voting closes ${deadlineStr}.`;

  // Create prediction metadata
  const predictionMeta: PredictionMetadata = {
    resolvesAt,
    xpReward: selected.xpReward,
    category: selected.category,
    dataSource: selected.dataSource,
  };

  // Determine the most appropriate tag for this prediction
  let tag: PostType = "General";
  if (selected.category === "weather") tag = "Weather";
  else if (selected.category === "traffic") tag = "Traffic";
  else if (selected.category === "events") tag = "Events";

  return {
    message,
    tag,
    mood: "🔮",
    author: `${city.name} oracle_bot 🎱`,
    is_bot: true,
    hidden: false,
    engagementType: "prediction",
    options: [selected.optionA, selected.optionB],
    prediction: predictionMeta,
  };
}

// ============================================================================
// CIVIC ALERT POSTS - Morning Brew Style
// ============================================================================

/**
 * Civic Alert Templates - for when we don't have real civic meeting data
 *
 * These are "civic awareness" posts that encourage engagement with local government.
 * When actual civic meetings are available (via /api/civic/meetings), the system
 * should use the dedicated civic-templates.ts generators instead.
 */
const CIVIC_AWARENESS_TEMPLATES = [
  {
    message: `🏛️ {city} Civic Question:\n\nDo you know when your local school board meets?\n\n📊 Quick poll:`,
    optionA: "Yes, I follow it",
    optionB: "No idea, honestly",
    category: "awareness" as const,
  },
  {
    message: `🏫 {city} Community Check:\n\nSchool board decisions affect property values, curriculum, and taxes.\n\nAre you paying attention?`,
    optionA: "I try to follow along",
    optionB: "I should probably start",
    category: "awareness" as const,
  },
  {
    message: `🏛️ Civic Truth Time:\n\nCity council meetings in {city} shape everything from zoning to taxes.\n\nHave you ever watched one?`,
    optionA: "Yes, been there",
    optionB: "Never, but curious",
    category: "awareness" as const,
  },
  {
    message: `🔮 Civic Prediction: Budget Season\n\n{city} budget discussions are coming up. What's your prediction?\n\nWill property taxes...`,
    optionA: "Stay flat",
    optionB: "Go up (again)",
    category: "prediction" as const,
  },
  {
    message: `🏫 School District Prediction:\n\nWith all the growth in {city}, will we see a new school announced this year?`,
    optionA: "Yes, it's overdue",
    optionB: "No, budget is tight",
    category: "prediction" as const,
  },
  {
    message: `🏛️ {city} Development Watch:\n\nThat big empty lot everyone keeps asking about... prediction time:\n\nWhat gets built next?`,
    optionA: "More housing",
    optionB: "Commercial/retail",
    category: "prediction" as const,
  },
];

/**
 * Generate a Civic Alert Post
 *
 * Uses "Morning Brew" style civic content to make local government accessible.
 * When real civic meeting data is available, this should defer to the
 * dedicated civic-templates.ts generators for pre-meeting alerts and predictions.
 *
 * Civic predictions earn 50 XP (higher than standard 25 XP) to encourage
 * civic engagement.
 */
export async function generateCivicAlertPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time } = ctx;

  // Select a random civic template
  const template = pickRandom(CIVIC_AWARENESS_TEMPLATES);

  // Fill in city name
  const message = template.message.replace(/{city}/g, city.name);

  // If it's a prediction type, add prediction metadata
  if (template.category === "prediction") {
    // Civic predictions resolve in ~48 hours and give 50 XP
    const resolvesAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const deadlineStr = resolvesAt.toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
    });

    const fullMessage = `${message}\n\n💎 Correct guessers earn 50 XP! Resolution by ${deadlineStr}.`;

    const predictionMeta: PredictionMetadata = {
      resolvesAt,
      xpReward: 50, // Higher XP for civic predictions
      category: "civic",
      dataSource: "manual", // Civic predictions are manually resolved
    };

    return {
      message: fullMessage,
      tag: "General" as PostType,
      mood: "🏛️",
      author: `${city.name} civic_oracle_bot 🔮`,
      is_bot: true,
      hidden: false,
      engagementType: "civic_alert",
      options: [template.optionA, template.optionB],
      prediction: predictionMeta,
    };
  }

  // Regular awareness poll (no XP stakes)
  return {
    message,
    tag: "General" as PostType,
    mood: "🏛️",
    author: `${city.name} civic_pulse_bot 🏛️`,
    is_bot: true,
    hidden: false,
    engagementType: "civic_alert",
    options: [template.optionA, template.optionB],
  };
}

/**
 * Generate a Weather ALERT post
 * Uses FORECAST data to proactively warn users about upcoming weather events
 *
 * This is DIFFERENT from regular weather posts:
 * - Regular posts: "It's 61°F and sunny" (current conditions)
 * - Alert posts: "❄️ Snow expected this weekend!" (forecast warnings)
 *
 * Triggers for:
 * - Snow in forecast (rare in Texas - high priority!)
 * - Storms/heavy precipitation
 * - Freezing temperatures
 * - Extreme heat (100°F+)
 */
export async function generateWeatherAlertPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, weather } = ctx;

  if (!weather.forecast || weather.forecast.length === 0) {
    console.log("[WeatherAlert] No forecast data available");
    return null;
  }

  // Find the most significant weather event in the forecast
  let alertType: "snow" | "storm" | "freeze" | "heat" | null = null;
  let alertDay: typeof weather.forecast[0] | null = null;

  for (const day of weather.forecast) {
    // Snow takes highest priority (rare in Texas!)
    if (day.snowfallCm > 0) {
      alertType = "snow";
      alertDay = day;
      break;
    }
    // Storm is second priority
    if (day.condition === "storm" || day.precipitationMm > 25) {
      if (!alertType || alertType === "freeze" || alertType === "heat") {
        alertType = "storm";
        alertDay = day;
      }
    }
    // Freeze is third priority
    if (day.tempLow < 32) {
      if (!alertType || alertType === "heat") {
        alertType = "freeze";
        alertDay = day;
      }
    }
    // Extreme heat is fourth priority
    if (day.tempHigh > 100) {
      if (!alertType) {
        alertType = "heat";
        alertDay = day;
      }
    }
  }

  if (!alertType || !alertDay) {
    return null;
  }

  // Format the date for the alert
  const alertDate = new Date(alertDay.date);
  const dayName = alertDate.toLocaleDateString("en-US", { weekday: "long" });
  const isToday = alertDate.toDateString() === new Date().toDateString();
  const isTomorrow = alertDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
  const timeframe = isToday ? "TODAY" : isTomorrow ? "tomorrow" : dayName;

  // Generate alert message based on type
  let message: string;
  let mood: string;

  switch (alertType) {
    case "snow":
      const snowAmount = alertDay.snowfallCm;
      message = `❄️ SNOW ALERT: ${city.name} may see snow ${timeframe}!` +
        (snowAmount > 1 ? ` Expecting ~${Math.round(snowAmount / 2.54)} inches.` : "") +
        `\n\n🚗 Roads could get icy - plan ahead!\n📍 Stock up on essentials if you haven't already.`;
      mood = "❄️";
      break;

    case "storm":
      message = `⛈️ STORM ALERT: Heavy weather heading to ${city.name} ${timeframe}!` +
        `\n\n🌧️ Expected: ${Math.round(alertDay.precipitationMm / 25.4)}"+ of rain` +
        `\n⚡ Possible thunderstorms - stay weather aware!`;
      mood = "⛈️";
      break;

    case "freeze":
      message = `🥶 FREEZE WARNING: ${city.name} dropping to ${alertDay.tempLow}°F ${timeframe}!` +
        `\n\n💧 Protect pipes - let faucets drip!\n🌱 Bring plants inside\n🚗 Watch for icy bridges`;
      mood = "🥶";
      break;

    case "heat":
      message = `🔥 EXTREME HEAT: ${city.name} hitting ${alertDay.tempHigh}°F ${timeframe}!` +
        `\n\n💧 Stay hydrated - drink water constantly\n🐕 Keep pets inside during peak heat\n👴 Check on elderly neighbors`;
      mood = "🔥";
      break;
  }

  return {
    message,
    tag: "Weather",
    mood,
    author: `${city.name} weather_alert_bot ⚠️`,
    is_bot: true,
    hidden: false,
    engagementType: "weather_alert",
  };
}

/**
 * Generate a Farmers Market post
 * Uses REAL farmers market data from the user's area (hyperlocal - 10mi radius)
 *
 * NOW PRODUCES ACTIONABLE CONTENT:
 * - Full address with distance
 * - Opening hours
 * - Clear CTA for directions
 * - Action metadata for PulseCard interactivity
 *
 * Post types:
 * - openToday: Market is open NOW - create urgency/FOMO
 * - upcoming: Market is coming up this week - build anticipation
 * - discovery: Ask for recommendations - engagement driver
 * - tips: Share insider knowledge - builds community trust
 */
export async function generateFarmersMarketPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, farmersMarkets, time } = ctx;

  console.log(`[FarmersMarketPost] Generating for ${city.name}, markets available: ${farmersMarkets?.length ?? 0}`);

  // Need at least one farmers market to generate a post
  if (!farmersMarkets || farmersMarkets.length === 0) {
    console.log("[FarmersMarketPost] No markets data, returning null");
    return null;
  }

  // Pick a random market from the top 3 closest to prevent repetition
  // Default to first if only one available
  const marketPool = farmersMarkets.slice(0, 3);
  const market = marketPool[Math.floor(Math.random() * marketPool.length)];

  // Determine which template category to use based on context
  let templateCategory: keyof typeof FARMERS_MARKET_TEMPLATES;

  if (market.isOpenToday) {
    // Market is open today - use FOMO/urgency templates
    templateCategory = "openToday";
  } else if (time.isWeekend) {
    // Weekend but market not open today - discovery or tips
    templateCategory = Math.random() < 0.5 ? "discovery" : "tips";
  } else {
    // Weekday - upcoming or discovery
    templateCategory = Math.random() < 0.6 ? "upcoming" : "discovery";
  }

  const templates = FARMERS_MARKET_TEMPLATES[templateCategory];
  const template = pickRandom(templates);

  // Build RICH market-specific variables for actionable content
  const productsStr = market.products.length > 0
    ? market.products.slice(0, 3).join(", ").toLowerCase()
    : "fresh produce";

  // Format distance text (e.g., " (1.8 mi)" or empty if no distance)
  const distanceText = market.distance
    ? ` (${market.distance.toFixed(1)} mi)`
    : "";

  // SPATIAL ANCHORING: Find a nearby landmark to build trust
  const nearest = getNearestLandmark(city, { lat: market.lat || city.coords.lat, lon: market.lon || city.coords.lon });
  const landmarkAnchor = nearest ? `near ${nearest.landmark}` : `in ${city.name}`;

  // Clean up address - provide a better fallback if specific address is missing
  const address = market.address && market.address !== "Address not available"
    ? market.address
    : `near ${city.name}`;

  const extendedVars: Record<string, string> = {
    marketName: market.name,
    address: address,
    landmarkAnchor: landmarkAnchor,
    distanceText: distanceText,
    schedule: market.schedule || "Hours vary",
    products: productsStr,
    city: city.name,
  };

  const message = fillEngagementTemplate(template, extendedVars);

  // Build Google Maps directions URL
  const directionsUrl = market.lat && market.lon
    ? `https://www.google.com/maps/dir/?api=1&destination=${market.lat},${market.lon}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(market.name + " " + market.address)}`;

  // Action metadata for PulseCard to make this post interactive
  const action: PostActionData = {
    type: "directions",
    target: directionsUrl,
    label: "Get Directions",
    venue: {
      name: market.name,
      address: market.address,
      lat: market.lat,
      lon: market.lon,
      website: market.website ?? undefined,
    },
  };

  return {
    message,
    tag: "Events",
    mood: "🥬",
    author: `${city.name} market_scout_bot 🥕`,
    is_bot: true,
    hidden: false,
    engagementType: "farmers_market",
    action,
  };
}

/**
 * Generate a Landmark-Anchored Food/Coffee Post
 *
 * PHILOSOPHY: Generic food polls get ignored. Posts that reference specific
 * landmarks everyone knows create instant recognition and engagement.
 * "Coffee near HEB" resonates because everyone drives by HEB.
 *
 * TIME-AWARE:
 * - Morning (6-11am): Coffee and breakfast spots
 * - Lunch (11am-2pm): Quick lunch options
 * - Afternoon (2-5pm): Coffee/snack runs
 * - Evening (5-9pm): Dinner spots
 * - Late night (9pm+): Late-night food options
 *
 * LANDMARK PRIORITY:
 * 1. Tier 1: HEB/HEB Plus (highest recognition)
 * 2. Tier 2: Major retail (Target, Lowe's, etc.)
 * 3. Tier 3: Parks, transit stations
 */
export async function generateLandmarkFoodPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, time } = ctx;
  const hour = time.hour;

  // Determine time category for template selection
  type TimeCategory = keyof typeof LANDMARK_FOOD_TEMPLATES;
  let timeCategory: TimeCategory;

  if (hour >= 6 && hour < 11) {
    timeCategory = "morning";
  } else if (hour >= 11 && hour < 14) {
    timeCategory = "lunch";
  } else if (hour >= 14 && hour < 17) {
    timeCategory = "afternoon";
  } else if (hour >= 17 && hour < 21) {
    timeCategory = "evening";
  } else if (hour >= 21 || hour < 6) {
    timeCategory = "lateNight";
  } else {
    timeCategory = "discovery"; // Fallback
  }

  // 15% chance to use discovery templates instead (keeps it varied)
  if (Math.random() < 0.15) {
    timeCategory = "discovery";
  }

  // Get landmarks from city config, with fallbacks
  // Now supports LandmarkEntry (string | { name, area, address })
  const cityLandmarks: LandmarkEntry[] = city.landmarks.shopping || [];
  const cityVenues: LandmarkEntry[] = city.landmarks.venues || [];

  // Build landmark pool with tier weighting
  // Tier 1 landmarks (HEB) should appear more often
  const landmarkPool: LandmarkEntry[] = [];

  // Helper to check if landmark name matches a tier
  const matchesTier = (entry: LandmarkEntry, tierNames: string[]): boolean => {
    const name = getLandmarkName(entry).toLowerCase();
    return tierNames.some(t => name.includes(t.toLowerCase()));
  };

  // Add Tier 1 (highest weight - add 3x)
  const tier1Matches = cityLandmarks.filter(l => matchesTier(l, LANDMARK_TIERS.tier1));
  if (tier1Matches.length > 0) {
    landmarkPool.push(...tier1Matches, ...tier1Matches, ...tier1Matches);
  }

  // Add Tier 2 (medium weight - add 2x)
  const tier2Matches = cityLandmarks.filter(l => matchesTier(l, LANDMARK_TIERS.tier2));
  if (tier2Matches.length > 0) {
    landmarkPool.push(...tier2Matches, ...tier2Matches);
  }

  // Add Tier 3 from venues (parks, transit - add 1x)
  const tier3Matches = cityVenues.filter(l => {
    const name = getLandmarkName(l).toLowerCase();
    return matchesTier(l, LANDMARK_TIERS.tier3) ||
      name.includes("park") ||
      name.includes("station");
  });
  if (tier3Matches.length > 0) {
    landmarkPool.push(...tier3Matches);
  }

  // If no matches, use all shopping landmarks as fallback
  if (landmarkPool.length === 0) {
    landmarkPool.push(...cityLandmarks);
  }

  // Still empty? Use hardcoded fallback (strings are valid LandmarkEntry)
  if (landmarkPool.length === 0) {
    landmarkPool.push("HEB", "Target", "the shopping center");
  }

  // Pick a random landmark and get its FULL display name (with area)
  // e.g., "HEB Plus on Hero Way" instead of just "HEB Plus"
  const landmarkEntry = landmarkPool[Math.floor(Math.random() * landmarkPool.length)];
  const landmark = getLandmarkDisplay(landmarkEntry);

  // Pick a template from the time category
  const templates = LANDMARK_FOOD_TEMPLATES[timeCategory];
  const template = templates[Math.floor(Math.random() * templates.length)];

  // Fill in the template
  const message = template.replace(/{landmark}/g, landmark);

  // Determine mood emoji based on time category
  const moodEmojis: Record<TimeCategory, string> = {
    morning: "☕",
    lunch: "🍔",
    afternoon: "☕",
    evening: "🍽️",
    lateNight: "🌙",
    discovery: "🔍",
  };

  return {
    message,
    tag: "General",
    mood: moodEmojis[timeCategory],
    author: `${city.name} local_foodie_bot 🍴`,
    is_bot: true,
    hidden: false,
    engagementType: "landmark_food",
  };
}

// ============================================================================
// ROUTE PULSE - Intent-Based Traffic + Retail
// ============================================================================

const ROUTE_PULSE_TEMPLATES = [
  "Planning a run to {landmark}? Traffic on {road} is {status} right now. Perfect time to beat the rush! 🚗",
  "Heading toward {landmark}? {road} is {status}. Might be a good window to grab that {item} you've been wanting. 🛒",
  "Retail check: Thinking about {landmark}? {road} is flows {status}. Should be an easy trip! ✨",
  "Quick update for {landmark} regulars: {road} is currently {status}. {tip}! 🎯",
];

const ROUTE_STATUS_MAP = {
  clear: "flowing smoothly",
  moderate: "seeing some moderate activity",
  heavy: "currently heavy",
  jam: "jammed - maybe wait 30 mins?",
};

const RETAIL_ITEMS = ["grocery run", "coffee fix", "supply run", "quick errand", "treat"];

/**
 * Generate a Route Pulse Post
 * 
 * FACTUAL + INTENT: Combines a specific retail destination with real traffic data.
 * This builds massive trust because it's both actionable and spatially familiar.
 */
export async function generateRoutePulsePost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city, traffic } = ctx;

  // Need traffic data to make this factual
  if (!traffic) return null;

  const congestion = traffic.congestionLevel * 100;
  const status = congestion >= 80 ? "jam" :
    congestion >= 50 ? "heavy" :
      congestion >= 20 ? "moderate" : "clear";

  const landmark = getRandomLandmark(city, "shopping");
  const template = pickRandom(ROUTE_PULSE_TEMPLATES);

  // Pick a road that's likely affected
  const road = getRandomRoad(city);
  const item = pickRandom(RETAIL_ITEMS);
  const tip = status === "clear" ? "Now's the time" : "Patience recommended";

  const message = template
    .replace(/{landmark}/g, landmark)
    .replace(/{road}/g, road)
    .replace(/{status}/g, ROUTE_STATUS_MAP[status])
    .replace(/{item}/g, item)
    .replace(/{tip}/g, tip);

  return {
    message,
    tag: "Traffic",
    mood: status === "clear" ? "✅" : "🚥",
    author: `${city.name} commute_buddy_bot 🛰️`,
    is_bot: true,
    hidden: false,
    engagementType: "route_pulse",
    action: {
      type: "traffic_check",
      target: "traffic",
      label: "Check Traffic Map"
    }
  };
}

// ============================================================================
// HIGH-LEVEL ENGAGEMENT GENERATOR
// ============================================================================

export interface EngagementDecision {
  shouldPost: boolean;
  engagementType: EngagementType | null;
  reason: string;
}

/**
 * Analyze situation and decide what type of engagement post to generate
 *
 * ENGAGEMENT PHILOSOPHY:
 * The new high-engagement types (hot_take, insider_tip, nostalgia_trigger, etc.)
 * are designed to create emotional responses and identity-based engagement.
 * They should appear frequently to transform passive scrolling into active participation.
 *
 * Priority tiers:
 * 1. TIME-SENSITIVE: school_alert, fomo_alert (must post when relevant)
 * 2. HIGH-ENGAGEMENT: hot_take, confession_booth, neighbor_challenge (viral potential)
 * 3. IDENTITY-BUILDERS: insider_tip, nostalgia_trigger, community_callout (community bonding)
 * 4. INTERACTIVE: would_you_rather, this_or_that (easy engagement)
 * 5. INFORMATIONAL: poll, recommendation, venue_checkin, local_spotlight (traditional)
 */
export function analyzeForEngagement(ctx: SituationContext): EngagementDecision {
  const { time, events } = ctx;
  const hour = time.hour;

  // ========== TIER 0: HYPERLOCAL REAL DATA (Highest priority) ==========
  // When we have REAL local data (farmers markets open TODAY), this beats everything
  // This is time-sensitive hyperlocal content that MUST be shown when relevant

  if (ctx.farmersMarkets && ctx.farmersMarkets.length > 0) {
    const hasOpenMarket = ctx.farmersMarkets.some(m => m.isOpenToday);
    const hasMarketTomorrow = ctx.farmersMarkets.some(m => m.isOpenTomorrow);

    // GUARANTEED post if market is open today (Saturday morning especially)
    if (hasOpenMarket && time.isWeekend && hour >= 7 && hour <= 14) {
      console.log("[AnalyzeEngagement] FARMERS MARKET: Open today, weekend morning - guaranteed post");
      return {
        shouldPost: true,
        engagementType: "farmers_market",
        reason: "Farmers market open TODAY - prime hyperlocal content",
      };
    }

    // Very high priority if market is open today, any time (90% chance)
    if (hasOpenMarket && Math.random() < 0.9) {
      console.log("[AnalyzeEngagement] FARMERS MARKET: Open today - high priority");
      return {
        shouldPost: true,
        engagementType: "farmers_market",
        reason: "Farmers market open today - hyperlocal engagement",
      };
    }

    // Friday evening heads-up for Saturday market (80% chance)
    if (hasMarketTomorrow && time.dayOfWeek === 5 && hour >= 17) {
      if (Math.random() < 0.8) {
        console.log("[AnalyzeEngagement] FARMERS MARKET: Tomorrow heads-up");
        return {
          shouldPost: true,
          engagementType: "farmers_market",
          reason: "Heads-up: farmers market tomorrow",
        };
      }
    }
  }

  // ========== TIER 0.2: ROUTE PULSE (Actionable Traffic/Retail) ==========
  // If we have notable traffic and it's a shopping window (midday/afternoon)
  if (ctx.traffic && (hour >= 10 && hour <= 18)) {
    if (Math.random() < 0.4) {
      console.log("[AnalyzeEngagement] ROUTE PULSE: Notable traffic + shopping window");
      return {
        shouldPost: true,
        engagementType: "route_pulse",
        reason: "Active shopping window + traffic data available",
      };
    }
  }

  // ========== TIER 0.5: WEATHER ALERTS (Forecast outliers) ==========
  // Proactively alert users about upcoming weather events BEFORE they happen
  // This uses FORECAST data, not just current conditions
  if (ctx.weather.forecast && ctx.weather.forecast.length > 0) {
    // Check for snow in forecast - RARE and important in Texas!
    const snowInForecast = ctx.weather.forecast.some(day => day.snowfallCm > 0);
    if (snowInForecast) {
      console.log("[AnalyzeEngagement] WEATHER ALERT: Snow in forecast!");
      return {
        shouldPost: true,
        engagementType: "weather_alert",
        reason: "Snow in forecast - rare weather alert",
      };
    }

    // Check for storms in forecast
    const stormInForecast = ctx.weather.forecast.some(day =>
      day.condition === 'storm' || day.precipitationMm > 25
    );
    if (stormInForecast) {
      console.log("[AnalyzeEngagement] WEATHER ALERT: Storm in forecast!");
      return {
        shouldPost: true,
        engagementType: "weather_alert",
        reason: "Storm in forecast - severe weather alert",
      };
    }

    // Check for freezing temps in forecast
    const freezeInForecast = ctx.weather.forecast.some(day => day.tempLow < 32);
    if (freezeInForecast) {
      console.log("[AnalyzeEngagement] WEATHER ALERT: Freezing temps in forecast!");
      return {
        shouldPost: true,
        engagementType: "weather_alert",
        reason: "Freezing temps in forecast - cold weather alert",
      };
    }

    // Check for extreme heat in forecast
    const extremeHeatInForecast = ctx.weather.forecast.some(day => day.tempHigh > 100);
    if (extremeHeatInForecast) {
      console.log("[AnalyzeEngagement] WEATHER ALERT: Extreme heat in forecast!");
      return {
        shouldPost: true,
        engagementType: "weather_alert",
        reason: "Extreme heat in forecast - heat advisory",
      };
    }
  }

  // ========== TIER 1: TIME-SENSITIVE (Always check first) ==========

  // School alert takes priority during school dismissal window
  if (time.isWeekday) {
    const dismissalHour = ctx.city.rushHours.schoolDismissal;
    const minutesToDismissal = (dismissalHour * 60) - (hour * 60 + new Date().getMinutes());
    if (minutesToDismissal >= 10 && minutesToDismissal <= 30) {
      return {
        shouldPost: true,
        engagementType: "school_alert",
        reason: "School dismissal approaching - traffic alert time",
      };
    }
  }

  // FOMO alerts - time-sensitive opportunities
  if (hour >= 15 && hour <= 19) {
    if (Math.random() < 0.3) {
      return {
        shouldPost: true,
        engagementType: "fomo_alert",
        reason: "Prime FOMO window - create urgency",
      };
    }
  }

  // Weekly roundup on weekends (specific window)
  if ((time.dayOfWeek === 0 || time.dayOfWeek === 6) && hour >= 10 && hour <= 14) {
    if (Math.random() < 0.35) {
      return {
        shouldPost: true,
        engagementType: "weekly_roundup",
        reason: "Weekend - time for weekly roundup",
      };
    }
  }

  // ========== CIVIC ALERTS (High priority on meeting days) ==========
  // Civic meetings are time-sensitive - alert users about meetings happening today
  // This uses external civic data, so it's triggered when civic meetings exist
  // Note: Actual civic data comes from the /api/civic/meetings endpoint
  // The bot scheduler should fetch civic meetings and include them in context
  // For now, we check time windows when civic meetings typically occur (evenings on weekdays)
  if (time.isWeekday && hour >= 16 && hour <= 19) {
    // Civic meetings often happen Tuesday-Thursday evenings
    if (time.dayOfWeek >= 2 && time.dayOfWeek <= 4) {
      if (Math.random() < 0.25) {
        return {
          shouldPost: true,
          engagementType: "civic_alert",
          reason: "Weekday evening - prime civic meeting window (50 XP predictions)",
        };
      }
    }
  }

  // ========== TIER 2: HIGH-ENGAGEMENT (Viral potential) ==========

  // PREDICTIONS - XP-staked predictions create investment and repeat engagement
  // Higher chance during morning (predictions about the day) and evening (predictions about tomorrow)
  if ((hour >= 7 && hour <= 10) || (hour >= 18 && hour <= 21)) {
    if (Math.random() < 0.3) {
      return {
        shouldPost: true,
        engagementType: "prediction",
        reason: "Prime prediction window - stake XP on local outcomes",
      };
    }
  } else if (Math.random() < 0.15) {
    return {
      shouldPost: true,
      engagementType: "prediction",
      reason: "Prediction post - create engagement through stakes",
    };
  }

  // Hot takes are gold - they demand responses
  // Higher chance during "controversy hours" (evening when people are relaxed)
  if (hour >= 18 && hour <= 22) {
    if (Math.random() < 0.35) {
      return {
        shouldPost: true,
        engagementType: "hot_take",
        reason: "Evening hours - prime hot take time",
      };
    }
  } else if (Math.random() < 0.2) {
    return {
      shouldPost: true,
      engagementType: "hot_take",
      reason: "Hot take for engagement spark",
    };
  }

  // Confession booth - high engagement, people love sharing opinions anonymously
  if (Math.random() < 0.18) {
    return {
      shouldPost: true,
      engagementType: "confession_booth",
      reason: "Confession booth - people love to vent",
    };
  }

  // Neighbor challenges - direct call to action
  if (Math.random() < 0.2) {
    return {
      shouldPost: true,
      engagementType: "neighbor_challenge",
      reason: "Challenge time - direct engagement CTA",
    };
  }

  // ========== HYPERLOCAL DATA (Real market/venue data) ==========
  // NOTE: Farmers market is now handled in TIER 0 at the top for priority
  // This section handles landmark food posts only

  // Landmark-anchored food posts - time-aware and hyperlocal
  // Higher chance during meal times when food is on people's minds
  const isMealTime = (hour >= 7 && hour <= 10) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
  if (isMealTime && Math.random() < 0.25) {
    return {
      shouldPost: true,
      engagementType: "landmark_food",
      reason: "Meal time - landmark-anchored food recommendation",
    };
  }

  // Coffee/snack time windows
  if ((hour >= 14 && hour <= 16) && Math.random() < 0.2) {
    return {
      shouldPost: true,
      engagementType: "landmark_food",
      reason: "Afternoon slump - coffee/snack near landmark",
    };
  }

  // Late night food options
  if ((hour >= 21 || hour < 2) && Math.random() < 0.15) {
    return {
      shouldPost: true,
      engagementType: "landmark_food",
      reason: "Late night - food options near landmarks",
    };
  }

  // ========== TIER 3: IDENTITY BUILDERS (Community bonding) ==========

  // Insider tips - makes people feel like locals
  if (Math.random() < 0.2) {
    return {
      shouldPost: true,
      engagementType: "insider_tip",
      reason: "Insider knowledge sharing - builds community identity",
    };
  }

  // Nostalgia triggers - emotional engagement, especially good on weekends
  if (time.isWeekend && Math.random() < 0.25) {
    return {
      shouldPost: true,
      engagementType: "nostalgia_trigger",
      reason: "Weekend nostalgia - emotional engagement",
    };
  } else if (Math.random() < 0.12) {
    return {
      shouldPost: true,
      engagementType: "nostalgia_trigger",
      reason: "Nostalgia trigger - remember when...",
    };
  }

  // Community callouts - celebrate/call out behavior (mostly positive)
  if (Math.random() < 0.15) {
    return {
      shouldPost: true,
      engagementType: "community_callout",
      reason: "Community callout - behavioral engagement",
    };
  }

  // ========== TIER 4: INTERACTIVE (Easy engagement) ==========

  // Would you rather - fun hypotheticals
  if (Math.random() < 0.2) {
    return {
      shouldPost: true,
      engagementType: "would_you_rather",
      reason: "Would you rather - easy interactive engagement",
    };
  }

  // This or That - super quick engagement
  if (Math.random() < 0.25) {
    return {
      shouldPost: true,
      engagementType: "this_or_that",
      reason: "Quick engagement - This or That poll",
    };
  }

  // ========== TIER 5: INFORMATIONAL (Traditional) ==========

  // Venue check-in during evening hours or when events happening
  if ((hour >= 17 && hour <= 22) || events.length > 0) {
    if (Math.random() < 0.2) {
      return {
        shouldPost: true,
        engagementType: "venue_checkin",
        reason: "Evening time - venue vibe check",
      };
    }
  }

  // Polls during meal times
  if ((hour >= 7 && hour <= 10) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 20)) {
    if (Math.random() < 0.18) {
      return {
        shouldPost: true,
        engagementType: "poll",
        reason: "Meal time - food poll",
      };
    }
  }

  // Local spotlight
  if (Math.random() < 0.1) {
    return {
      shouldPost: true,
      engagementType: "local_spotlight",
      reason: "Local business spotlight",
    };
  }

  // Recommendation asks
  if (Math.random() < 0.12) {
    return {
      shouldPost: true,
      engagementType: "recommendation",
      reason: "Community recommendation ask",
    };
  }

  return {
    shouldPost: false,
    engagementType: null,
    reason: "No engagement post needed right now",
  };
}

/**
 * Generate an engagement post based on the decision
 */
export async function generateEngagementPost(
  ctx: SituationContext,
  engagementType?: EngagementType,
  options: { isSeedMode?: boolean } = {}
): Promise<EngagementPost | null> {
  // If no type specified, analyze and decide
  const type = engagementType || analyzeForEngagement(ctx).engagementType;
  const { isSeedMode = false } = options;

  if (!type) return null;

  switch (type) {
    // Traditional engagement types
    case "poll":
      return generatePollPost(ctx);
    case "recommendation":
      return generateRecommendationPost(ctx);
    case "venue_checkin":
      return generateVenueCheckinPost(ctx);
    case "school_alert":
      return generateSchoolAlertPost(ctx);
    case "local_spotlight":
      return generateLocalSpotlightPost(ctx);
    case "this_or_that":
      return generateThisOrThatPost(ctx);
    case "fomo_alert":
      return generateFomoAlertPost(ctx);
    case "weekly_roundup":
      return generateWeeklyRoundupPost(ctx);

    // NEW HIGH-ENGAGEMENT types
    case "hot_take":
      return generateHotTakePost(ctx);
    case "insider_tip":
      return generateInsiderTipPost(ctx);
    case "nostalgia_trigger":
      return generateNostalgiaTriggerPost(ctx);
    case "neighbor_challenge":
      return generateNeighborChallengePost(ctx);
    case "community_callout":
      return generateCommunityCalloutPost(ctx);
    case "would_you_rather":
      return generateWouldYouRatherPost(ctx);
    case "confession_booth":
      return generateConfessionBoothPost(ctx);

    // HYPERLOCAL CONTENT types
    case "farmers_market":
      return generateFarmersMarketPost(ctx);
    case "landmark_food":
      return generateLandmarkFoodPost(ctx);

    // XP-STAKED PREDICTIONS
    // In seed mode, skip event predictions to avoid duplicating regular Event posts
    case "prediction":
      return generatePredictionPost(ctx, { skipEventPredictions: isSeedMode });

    // CIVIC ALERTS (50 XP predictions)
    case "civic_alert":
      return generateCivicAlertPost(ctx);

    // WEATHER ALERTS (proactive forecast-based alerts)
    case "weather_alert":
      return generateWeatherAlertPost(ctx);

    case "route_pulse":
      return generateRoutePulsePost(ctx);
    default:
      return null;
  }
}

/**
 * Generate multiple varied engagement posts for seeding
 *
 * SEED PHILOSOPHY:
 * When seeding a cold feed, we want to create immediate engagement hooks.
 * The new high-engagement types should be prioritized to make the feed
 * feel alive and worth participating in.
 */
export async function generateEngagementSeedPosts(
  ctx: SituationContext,
  count: number = 2
): Promise<EngagementPost[]> {
  const posts: EngagementPost[] = [];
  const usedTypes = new Set<EngagementType>();

  // Build priority list - HIGH-ENGAGEMENT TYPES FIRST
  const priorities: EngagementType[] = [];

  // ========== INTERACTIVE POLLS (Highest priority - easy one-tap engagement) ==========
  // These generate voteable polls that users can interact with immediately
  // Moved to top priority to ensure every city gets at least one poll

  // PREDICTIONS - XP-staked predictions create investment and repeat engagement
  // Always include a prediction to hook users with stakes
  priorities.push("prediction");

  // This or That - super quick one-tap engagement with poll options
  priorities.push("this_or_that");

  // Would you rather - fun hypotheticals with poll options
  priorities.push("would_you_rather");

  // ========== TIME-SENSITIVE (if applicable) ==========

  // Weekly roundup on weekends
  if (ctx.time.dayOfWeek === 0 || ctx.time.dayOfWeek === 6) {
    priorities.push("weekly_roundup");
  }

  // School alert if applicable
  if (ctx.time.isWeekday) {
    const dismissalHour = ctx.city.rushHours.schoolDismissal;
    const minutesToDismissal = (dismissalHour * 60) - (ctx.time.hour * 60 + new Date().getMinutes());
    if (minutesToDismissal >= 10 && minutesToDismissal <= 30) {
      priorities.push("school_alert");
    }
  }

  // FOMO alerts during afternoon/evening
  if (ctx.time.hour >= 15 && ctx.time.hour <= 19) {
    priorities.push("fomo_alert");
  }

  // ========== HYPERLOCAL CONTENT (Real data, high relevance) ==========
  // FORCE-INCLUDED: Both landmark_food and farmers_market are ALWAYS in top positions
  // This ensures every cold-start gets hyperlocal content attempts
  // (generators will return null if no data, which is handled by the loop)

  // Landmark-anchored food/coffee posts - FORCE INCLUDE IN TOP 3
  // These use local landmarks (HEB, Target, parks) that everyone recognizes
  // ALWAYS inserted at position 1 (after first prediction) to guarantee inclusion
  priorities.splice(1, 0, "landmark_food");

  // Farmers market posts - DISABLED
  // These were causing persistent duplicate issues because:
  // 1. The same venue gets posted with different templates
  // 2. Deduplication is hard when venue names appear in varied formats
  // 3. The Local Markets tab already shows this data properly
  // 4. Users can post organically about markets if they want
  // 
  // The farmersMarkets data is still fetched and used in the Local tab UI.
  // We're just not auto-posting about it in the main feed anymore.
  // 
  // const hasMarketData = ctx.farmersMarkets && ctx.farmersMarkets.length > 0;
  // if (hasMarketData) {
  //   priorities.splice(1, 0, "farmers_market");
  //   console.log(`[SeedPosts] Including farmers_market - found ${ctx.farmersMarkets.length} markets`);
  // }

  // ========== HIGH-ENGAGEMENT (Always include for viral potential) ==========

  // Hot takes are engagement gold - always include one
  priorities.push("hot_take");

  // Confession booth creates safe space for opinions
  priorities.push("confession_booth");

  // Challenges drive direct participation
  priorities.push("neighbor_challenge");

  // Civic alerts on weekday evenings (when civic meetings happen)
  // 50 XP predictions about school board/city council decisions
  if (ctx.time.isWeekday && ctx.time.hour >= 16 && ctx.time.hour <= 20) {
    priorities.push("civic_alert");
  }

  // ========== IDENTITY BUILDERS (Community bonding) ==========

  // Insider tips make people feel special
  priorities.push("insider_tip");

  // Nostalgia - especially good on weekends or evenings
  if (ctx.time.isWeekend || ctx.time.hour >= 18) {
    priorities.push("nostalgia_trigger");
  }

  // Community callouts celebrate local behavior
  priorities.push("community_callout");

  // ========== TRADITIONAL (Fill remaining slots) ==========

  // Evening venue check
  if (ctx.time.hour >= 17 && ctx.time.hour <= 22) {
    priorities.push("venue_checkin");
  }

  // Traditional poll and other types as fallbacks
  priorities.push("poll", "local_spotlight", "recommendation");

  // Generate posts from priority list
  // Pass isSeedMode: true to prevent duplicate event posts
  // (regular seed posts already create Events posts from template-engine)
  for (const type of priorities) {
    if (posts.length >= count) break;
    if (usedTypes.has(type)) continue;

    const post = await generateEngagementPost(ctx, type, { isSeedMode: true });
    if (post) {
      posts.push(post);
      usedTypes.add(type);
    }
  }

  return posts;
}
