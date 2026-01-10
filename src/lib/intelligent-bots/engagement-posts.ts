/**
 * Engagement Posts - AI-Driven Community Engagement
 *
 * Generates dynamic, contextual posts designed to spark conversations:
 * - Polls ("Best tacos in Leander?")
 * - Recommendation asks ("Looking for a good coffee spot near...")
 * - Venue check-ins ("What's happening at [venue] tonight?")
 * - School pickup alerts
 *
 * All content is AI-generated to avoid repetitive/static questions.
 */

import type { CityConfig, SituationContext, PostType, GeneratedPost } from "./types";
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
  | "this_or_that"      // NEW: Binary choice polls
  | "fomo_alert"        // NEW: Time-sensitive urgency posts
  | "weekly_roundup";   // NEW: Weekly summary posts

export interface EngagementPost extends Omit<GeneratedPost, "tag"> {
  tag: PostType | "General";
  engagementType: EngagementType;
  options?: string[];  // For polls
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
// THIS OR THAT - Dynamic Context-Aware Polls
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

// Base static choices (always available)
const BASE_CHOICES: PollChoice[] = [
  // Food battles - always relevant
  { a: "🌮 Tacos", b: "🌯 Burritos", category: "food" },
  { a: "🍔 Burgers", b: "🌭 Hot Dogs", category: "food" },
  { a: "🍕 Pizza", b: "🍝 Pasta", category: "food" },
  { a: "☕ Coffee", b: "🍵 Tea", category: "food" },
  { a: "🍖 BBQ", b: "🍗 Fried Chicken", category: "food" },
  { a: "🥞 Pancakes", b: "🧇 Waffles", category: "food", timeOfDay: ["morning"] },
  { a: "🍦 Ice Cream", b: "🧁 Cupcakes", category: "food" },
  { a: "🥑 Guac", b: "🫘 Queso", category: "food" },
  { a: "🍟 Fries", b: "🧅 Onion Rings", category: "food" },
  { a: "🌶️ Spicy", b: "🧂 Mild", category: "food" },
  // Texas-specific
  { a: "🤠 Whataburger", b: "🍔 In-N-Out", category: "texas" },
  { a: "🧊 Blue Bell", b: "🍨 Amy's Ice Cream", category: "texas" },
  { a: "🚗 Toll road", b: "🛣️ Frontage road", category: "texas" },
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
    venue = venues[Math.floor(Math.random() * venues.length)];
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

  const restaurant = city.landmarks.restaurants[
    Math.floor(Math.random() * city.landmarks.restaurants.length)
  ];

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
 * Generate a "This or That" binary choice poll
 * Super easy one-tap engagement - no typing required!
 * Now uses context-aware choices based on season, weather, time, and day type.
 */
export async function generateThisOrThatPost(
  ctx: SituationContext
): Promise<EngagementPost | null> {
  const { city } = ctx;

  // Get contextually-appropriate choices based on current conditions
  const choices = getContextualChoices(ctx);

  if (choices.length === 0) {
    // Fallback to base choices if filtering removed everything
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
      const restaurant = city.landmarks.restaurants[Math.floor(Math.random() * city.landmarks.restaurants.length)];
      variables = {
        restaurant,
        minutes: String(minutesUntil),
      };
    }
  }

  // Lunch rush warning (11:00-11:30 AM)
  if (!fomoType && hour === 11 && new Date().getMinutes() < 30) {
    fomoType = "lunchRush";
    templates = FOMO_TEMPLATES.lunchRush;
    const restaurant = city.landmarks.restaurants[Math.floor(Math.random() * city.landmarks.restaurants.length)];
    variables = {
      restaurant,
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
      const venue = city.landmarks.venues[Math.floor(Math.random() * city.landmarks.venues.length)];
      variables = {
        venue,
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
// HIGH-LEVEL ENGAGEMENT GENERATOR
// ============================================================================

export interface EngagementDecision {
  shouldPost: boolean;
  engagementType: EngagementType | null;
  reason: string;
}

/**
 * Analyze situation and decide what type of engagement post to generate
 */
export function analyzeForEngagement(ctx: SituationContext): EngagementDecision {
  const { time, events, weather } = ctx;
  const hour = time.hour;

  // Weekly roundup on weekends (high priority)
  if ((time.dayOfWeek === 0 || time.dayOfWeek === 6) && hour >= 10 && hour <= 14) {
    if (Math.random() < 0.4) { // 40% chance on weekend mornings
      return {
        shouldPost: true,
        engagementType: "weekly_roundup",
        reason: "Weekend - time for weekly roundup",
      };
    }
  }

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
  if (time.isWeekday && hour >= 15 && hour <= 18) {
    if (Math.random() < 0.35) { // 35% chance during happy hour window
      return {
        shouldPost: true,
        engagementType: "fomo_alert",
        reason: "Happy hour / event window - FOMO time!",
      };
    }
  }

  // This or That - quick engagement polls (high frequency)
  if (Math.random() < 0.3) { // 30% chance anytime
    return {
      shouldPost: true,
      engagementType: "this_or_that",
      reason: "Quick engagement - This or That poll",
    };
  }

  // Venue check-in during evening hours or when events happening
  if ((hour >= 17 && hour <= 22) || events.length > 0) {
    if (Math.random() < 0.3) { // 30% chance
      return {
        shouldPost: true,
        engagementType: "venue_checkin",
        reason: "Evening time - venue vibe check appropriate",
      };
    }
  }

  // Polls during meal times
  if ((hour >= 7 && hour <= 10) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 20)) {
    if (Math.random() < 0.25) { // 25% chance
      return {
        shouldPost: true,
        engagementType: "poll",
        reason: "Meal time - food poll engagement",
      };
    }
  }

  // Weekend - higher chance for fun engagement
  if (time.isWeekend && Math.random() < 0.35) {
    const types: EngagementType[] = ["poll", "local_spotlight", "recommendation", "this_or_that"];
    return {
      shouldPost: true,
      engagementType: types[Math.floor(Math.random() * types.length)],
      reason: "Weekend vibes - engagement time",
    };
  }

  // Recommendation asks - good anytime
  if (Math.random() < 0.15) {
    return {
      shouldPost: true,
      engagementType: "recommendation",
      reason: "Community knowledge sharing moment",
    };
  }

  // Local spotlight - occasional
  if (Math.random() < 0.1) {
    return {
      shouldPost: true,
      engagementType: "local_spotlight",
      reason: "Time to highlight a local spot",
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
  engagementType?: EngagementType
): Promise<EngagementPost | null> {
  // If no type specified, analyze and decide
  const type = engagementType || analyzeForEngagement(ctx).engagementType;

  if (!type) return null;

  switch (type) {
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
    default:
      return null;
  }
}

/**
 * Generate multiple varied engagement posts for seeding
 */
export async function generateEngagementSeedPosts(
  ctx: SituationContext,
  count: number = 2
): Promise<EngagementPost[]> {
  const posts: EngagementPost[] = [];
  const usedTypes = new Set<EngagementType>();

  // Prioritize based on context
  const priorities: EngagementType[] = [];

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

  // FOMO alerts during happy hour window
  if (ctx.time.isWeekday && ctx.time.hour >= 15 && ctx.time.hour <= 18) {
    priorities.push("fomo_alert");
  }

  // Evening venue check
  if (ctx.time.hour >= 17 && ctx.time.hour <= 22) {
    priorities.push("venue_checkin");
  }

  // This or That is always good - high engagement, low friction
  priorities.push("this_or_that");

  // Always include poll and spotlight as options
  priorities.push("poll", "local_spotlight", "recommendation");

  for (const type of priorities) {
    if (posts.length >= count) break;
    if (usedTypes.has(type)) continue;

    const post = await generateEngagementPost(ctx, type);
    if (post) {
      posts.push(post);
      usedTypes.add(type);
    }
  }

  return posts;
}
