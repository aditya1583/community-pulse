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

export type EngagementType = "poll" | "recommendation" | "venue_checkin" | "school_alert" | "local_spotlight";

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
    const types: EngagementType[] = ["poll", "local_spotlight", "recommendation"];
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

  // School alert if applicable
  if (ctx.time.isWeekday) {
    const dismissalHour = ctx.city.rushHours.schoolDismissal;
    const minutesToDismissal = (dismissalHour * 60) - (ctx.time.hour * 60 + new Date().getMinutes());
    if (minutesToDismissal >= 10 && minutesToDismissal <= 30) {
      priorities.push("school_alert");
    }
  }

  // Evening venue check
  if (ctx.time.hour >= 17 && ctx.time.hour <= 22) {
    priorities.push("venue_checkin");
  }

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
