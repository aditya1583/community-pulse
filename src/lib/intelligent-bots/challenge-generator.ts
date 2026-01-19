/**
 * Challenge Generator
 *
 * Creates GPS-verified check-in challenges tied to local landmarks.
 * Uses the witty "Morning Brew" voice that makes civic engagement fun.
 *
 * Philosophy: Exploration creates connection. These challenges transform
 * passive app users into active community explorers who discover their
 * neighborhood's hidden gems.
 */

import type { CityConfig, CityLandmarks, LandmarkEntry } from "./types";
import { getLandmarkName } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export type ChallengeType = "checkin" | "photo" | "trail";

export interface GeneratedChallenge {
  title: string;
  description: string;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
  locationName: string;
  locationAddress?: string;
  xpReward: number;
  maxClaims?: number; // null = unlimited
  expiresAt: Date;
  challengeType: ChallengeType;
  trailId?: string;
  trailOrder?: number;
  city: string;
  announcementPulse?: {
    message: string;
    tag: "Events" | "General";
    mood: string;
    author: string;
  };
}

export interface TrailDefinition {
  id: string;
  title: string;
  description: string;
  completionBonusXp: number;
  requiredStops: number;
  city: string;
  stops: TrailStop[];
}

export interface TrailStop {
  locationName: string;
  locationAddress?: string;
  targetLat: number;
  targetLng: number;
  description: string;
  xpReward: number;
}

// ============================================================================
// CHALLENGE TEMPLATES - The "Morning Brew" Voice
// ============================================================================

/**
 * Templates use a witty, conversational tone that makes challenges feel fun.
 * Each template has multiple variations to keep content fresh.
 */

const CHECKIN_TEMPLATES = {
  // Limited spots - creates urgency
  limited: [
    {
      title: "First {count} at {location}",
      description: "Be one of the first {count} to check in at {location} and snag {xp} XP. No pressure, but also... maybe some pressure.",
    },
    {
      title: "Race to {location}",
      description: "Only {count} spots available! Check in at {location} before everyone else. May the fastest thumbs win.",
    },
    {
      title: "VIP Access: {location}",
      description: "First {count} explorers to hit {location} get {xp} XP. Consider this your golden ticket.",
    },
  ],

  // Weekend activities
  weekend: [
    {
      title: "Weekend Wander: {location}",
      description: "It's the weekend and {location} is calling. Check in for {xp} XP and some well-deserved fresh air.",
    },
    {
      title: "Saturday at {location}",
      description: "Your weekend mission: visit {location}. Reward: {xp} XP and the satisfaction of touching grass.",
    },
    {
      title: "Sunday Stroll to {location}",
      description: "Sunday funday at {location}. Check in, grab your XP, maybe grab a coffee nearby. Living the dream.",
    },
  ],

  // Park/outdoor challenges
  outdoors: [
    {
      title: "Get Outside: {location}",
      description: "Fresh air? Never heard of her. Just kidding. Check in at {location} for {xp} XP.",
    },
    {
      title: "Park It at {location}",
      description: "Trade screen time for green time at {location}. {xp} XP says it's worth the trip.",
    },
    {
      title: "Nature Calls: {location}",
      description: "Not that kind of nature call. Check in at {location} for {xp} XP and remember what trees look like.",
    },
  ],

  // Shopping/restaurant challenges
  local: [
    {
      title: "Support Local: {location}",
      description: "Show some love to {location}. Check in for {xp} XP (and maybe support the local economy while you're there).",
    },
    {
      title: "Neighborhood Explorer: {location}",
      description: "Have you actually been to {location}? Now's your chance. {xp} XP awaits.",
    },
    {
      title: "Local Legend: {location}",
      description: "Every local legend knows {location}. Join the club for {xp} XP.",
    },
  ],

  // Generic/fallback
  generic: [
    {
      title: "Check In: {location}",
      description: "Pop by {location} for a quick check-in. {xp} XP in your pocket, no purchase necessary.",
    },
    {
      title: "Discover: {location}",
      description: "Adventure awaits at {location}. Check in to claim {xp} XP.",
    },
    {
      title: "On the Map: {location}",
      description: "Put yourself on the map at {location}. {xp} XP for your exploration efforts.",
    },
  ],
};

const PHOTO_TEMPLATES = [
  {
    title: "Snap It: {location}",
    description: "Visit {location}, take a photo, and share it with the community. {xp} XP for your artistic contribution.",
  },
  {
    title: "Photo Op: {location}",
    description: "We want to see {location} through your eyes. Post a photo from there for {xp} XP.",
  },
  {
    title: "Pic or It Didn't Happen: {location}",
    description: "Prove you made it to {location} with a photo. {xp} XP and bragging rights included.",
  },
];

const TRAIL_INTRO_TEMPLATES = [
  {
    title: "{theme} Trail: {count} Stops",
    description: "Think you know your {theme.toLowerCase()} spots? Prove it. Hit all {count} locations for a {bonus} XP bonus on top of individual rewards.",
  },
  {
    title: "The Great {city} {theme} Tour",
    description: "Your mission: conquer {count} {theme.toLowerCase()} spots across {city}. Complete the trail for a {bonus} XP bonus.",
  },
  {
    title: "{theme} Passport: {city} Edition",
    description: "Collect all {count} stamps on your {theme} passport. Finish the trail for {bonus} bonus XP. No actual passport required.",
  },
];

const TRAIL_THEMES = {
  taco: {
    name: "Taco",
    emoji: "🌮",
    venues: ["restaurants"],
    keywords: ["taco", "tacos", "mexican", "tex-mex"],
  },
  coffee: {
    name: "Coffee",
    emoji: "☕",
    venues: ["restaurants"],
    keywords: ["coffee", "cafe", "espresso", "roast"],
  },
  bbq: {
    name: "BBQ",
    emoji: "🍖",
    venues: ["restaurants"],
    keywords: ["bbq", "barbecue", "brisket", "smoked"],
  },
  parks: {
    name: "Parks",
    emoji: "🌳",
    venues: ["venues"],
    keywords: ["park", "trail", "preserve", "nature"],
  },
  pizza: {
    name: "Pizza",
    emoji: "🍕",
    venues: ["restaurants"],
    keywords: ["pizza", "pizzeria", "pie"],
  },
};

// ============================================================================
// ANNOUNCEMENT PULSE TEMPLATES
// ============================================================================

const CHALLENGE_ANNOUNCEMENT_TEMPLATES = {
  limited: [
    "🎯 NEW CHALLENGE: First {count} to check in at {location} snag {xp} XP. Go go go!",
    "🏃 Race is ON! {count} spots available at {location} for {xp} XP each. May the odds be in your favor.",
    "⚡ FLASH CHALLENGE: {location} - {count} spots, {xp} XP. First come, first served.",
  ],
  photo: [
    "📸 PHOTO CHALLENGE: Show us {location}! Post a pic for {xp} XP.",
    "🎨 Creative challenge: Snap your best shot at {location} for {xp} XP.",
    "📷 {location} is looking photogenic today. Prove it for {xp} XP.",
  ],
  weekend: [
    "🌞 WEEKEND CHALLENGE: Hit up {location} for {xp} XP. Your couch will still be there later.",
    "🎉 Weekend plans sorted: Check in at {location}, grab {xp} XP, look cool.",
    "☀️ Perfect weather for a {location} check-in. {xp} XP if you're about that outdoor life.",
  ],
  trail: [
    "🗺️ NEW TRAIL DROPPED: The {theme} Trail! Hit all {count} stops for a {bonus} XP bonus. Let's go!",
    "🎯 Trail challenge alert: {theme} lovers, your time has come. {count} stops, {bonus} XP bonus.",
    "🏆 The {city} {theme} Trail is live. Complete all {count} locations for bragging rights and {bonus} XP.",
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}(\\.[a-z]+)?\\}`, "gi"), String(value));
  }
  return result;
}

/**
 * Determine XP reward based on challenge type and difficulty
 * - Basic check-in: 25-35 XP
 * - Photo challenge: 30-50 XP
 * - Limited spots: 40-75 XP
 * - Trail stops: 20-30 XP each (bulk discount, bonus at end)
 */
function calculateXpReward(
  type: ChallengeType,
  isLimited: boolean = false,
  isTrailStop: boolean = false
): number {
  if (isTrailStop) {
    return 20 + Math.floor(Math.random() * 10); // 20-29 XP
  }
  if (type === "photo") {
    return 30 + Math.floor(Math.random() * 20); // 30-49 XP
  }
  if (isLimited) {
    return 40 + Math.floor(Math.random() * 35); // 40-74 XP
  }
  // Standard check-in
  return 25 + Math.floor(Math.random() * 10); // 25-34 XP
}

/**
 * Determine expiration based on challenge type
 * - Limited spots: 4-8 hours (urgency)
 * - Weekend: Sunday 11:59 PM
 * - Standard: 24-48 hours
 * - Trail: 1 week
 */
function calculateExpiration(
  type: ChallengeType,
  isLimited: boolean = false,
  isWeekend: boolean = false
): Date {
  const now = new Date();

  if (isLimited) {
    // 4-8 hours
    const hours = 4 + Math.floor(Math.random() * 4);
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  if (isWeekend) {
    // End of Sunday
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  }

  if (type === "trail") {
    // 1 week
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  // Standard: 24-48 hours
  const hours = 24 + Math.floor(Math.random() * 24);
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function getBotName(city: string): string {
  const personas = [
    { name: "challenge_master_bot", emoji: "🎯" },
    { name: "explorer_bot", emoji: "🗺️" },
    { name: "quest_giver_bot", emoji: "🏆" },
  ];
  const persona = pickRandom(personas);
  return `${city} ${persona.name} ${persona.emoji}`;
}

// ============================================================================
// MAIN GENERATOR FUNCTIONS
// ============================================================================

export interface GenerateChallengeOptions {
  type?: ChallengeType;
  category?: "limited" | "weekend" | "outdoors" | "local" | "generic";
  maxClaims?: number;
  xpOverride?: number;
  expiresAt?: Date;
  createAnnouncement?: boolean;
}

/**
 * Generate a single check-in challenge for a location
 */
export function generateCheckinChallenge(
  city: CityConfig,
  locationName: string,
  coords: { lat: number; lng: number },
  options: GenerateChallengeOptions = {}
): GeneratedChallenge {
  const {
    type = "checkin",
    category = "generic",
    maxClaims,
    xpOverride,
    expiresAt,
    createAnnouncement = true,
  } = options;

  const isLimited = maxClaims !== undefined && maxClaims > 0;
  const isWeekend = category === "weekend" || [0, 6].includes(new Date().getDay());

  // Select template category
  let templateCategory = category;
  if (isLimited) templateCategory = "limited";

  const templates = type === "photo"
    ? PHOTO_TEMPLATES
    : CHECKIN_TEMPLATES[templateCategory as keyof typeof CHECKIN_TEMPLATES] || CHECKIN_TEMPLATES.generic;

  const template = pickRandom(templates);
  const xp = xpOverride || calculateXpReward(type, isLimited, false);
  const expires = expiresAt || calculateExpiration(type, isLimited, isWeekend);

  const vars = {
    location: locationName,
    xp: xp.toString(),
    count: (maxClaims || 10).toString(),
    city: city.name,
  };

  const challenge: GeneratedChallenge = {
    title: fillTemplate(template.title, vars),
    description: fillTemplate(template.description, vars),
    targetLat: coords.lat,
    targetLng: coords.lng,
    radiusMeters: 150, // ~500 feet
    locationName,
    xpReward: xp,
    maxClaims: maxClaims,
    expiresAt: expires,
    challengeType: type,
    city: city.name,
  };

  // Create announcement pulse if requested
  if (createAnnouncement) {
    const announcementCategory = isLimited ? "limited" : type === "photo" ? "photo" : "weekend";
    const announcementTemplates = CHALLENGE_ANNOUNCEMENT_TEMPLATES[announcementCategory as keyof typeof CHALLENGE_ANNOUNCEMENT_TEMPLATES]
      || CHALLENGE_ANNOUNCEMENT_TEMPLATES.weekend;

    const announcementTemplate = pickRandom(announcementTemplates);

    challenge.announcementPulse = {
      message: fillTemplate(announcementTemplate, vars),
      tag: "Events",
      mood: "🎯",
      author: getBotName(city.name),
    };
  }

  return challenge;
}

/**
 * Generate a trail (multi-stop challenge)
 */
export function generateTrail(
  city: CityConfig,
  theme: keyof typeof TRAIL_THEMES,
  stops: TrailStop[],
  options: { createAnnouncement?: boolean } = {}
): { trail: TrailDefinition; challenges: GeneratedChallenge[] } {
  const { createAnnouncement = true } = options;
  const themeConfig = TRAIL_THEMES[theme];

  const trailId = `${city.name.toLowerCase()}-${theme}-${Date.now()}`;
  const completionBonus = 50 + stops.length * 30; // 50 base + 30 per stop

  const introTemplate = pickRandom(TRAIL_INTRO_TEMPLATES);
  const vars = {
    theme: themeConfig.name,
    count: stops.length.toString(),
    bonus: completionBonus.toString(),
    city: city.name,
  };

  const trail: TrailDefinition = {
    id: trailId,
    title: fillTemplate(introTemplate.title, vars),
    description: fillTemplate(introTemplate.description, vars),
    completionBonusXp: completionBonus,
    requiredStops: stops.length,
    city: city.name,
    stops,
  };

  const expires = calculateExpiration("trail");

  const challenges: GeneratedChallenge[] = stops.map((stop, index) => ({
    title: `${themeConfig.emoji} ${stop.locationName}`,
    description: stop.description || `Stop ${index + 1} on the ${themeConfig.name} Trail`,
    targetLat: stop.targetLat,
    targetLng: stop.targetLng,
    radiusMeters: 150,
    locationName: stop.locationName,
    locationAddress: stop.locationAddress,
    xpReward: stop.xpReward || calculateXpReward("checkin", false, true),
    expiresAt: expires,
    challengeType: "trail" as ChallengeType,
    trailId,
    trailOrder: index + 1,
    city: city.name,
  }));

  // Create announcement pulse for the trail
  if (createAnnouncement && challenges.length > 0) {
    const announcementTemplate = pickRandom(CHALLENGE_ANNOUNCEMENT_TEMPLATES.trail);
    challenges[0].announcementPulse = {
      message: fillTemplate(announcementTemplate, vars),
      tag: "Events",
      mood: themeConfig.emoji,
      author: getBotName(city.name),
    };
  }

  return { trail, challenges };
}

/**
 * Auto-generate challenges from city landmarks
 * Creates a mix of challenge types based on available landmarks
 */
export function generateDailyChallenges(
  city: CityConfig,
  count: number = 3
): GeneratedChallenge[] {
  const challenges: GeneratedChallenge[] = [];
  const usedLocations = new Set<string>();

  // Helper to get random landmark that hasn't been used
  function getUnusedLandmark(type: keyof CityLandmarks): string | null {
    const landmarks = city.landmarks[type];
    // Convert LandmarkEntry to name strings and filter out already used
    const available = landmarks
      .map((l: LandmarkEntry) => getLandmarkName(l))
      .filter((name: string) => !usedLocations.has(name));
    if (available.length === 0) return null;
    const selected = pickRandom(available);
    usedLocations.add(selected);
    return selected;
  }

  // Mix of challenge types
  const challengeTypes: Array<{ type: ChallengeType; category: string; landmarkType: keyof CityLandmarks }> = [
    { type: "checkin", category: "outdoors", landmarkType: "venues" },
    { type: "checkin", category: "local", landmarkType: "restaurants" },
    { type: "checkin", category: "local", landmarkType: "shopping" },
    { type: "photo", category: "outdoors", landmarkType: "venues" },
  ];

  // Maybe add a limited challenge (20% chance)
  if (Math.random() < 0.2) {
    challengeTypes.unshift({
      type: "checkin",
      category: "limited",
      landmarkType: "venues",
    });
  }

  // Generate requested number of challenges
  for (let i = 0; i < count && challengeTypes.length > 0; i++) {
    const config = challengeTypes[i % challengeTypes.length];
    const location = getUnusedLandmark(config.landmarkType);

    if (!location) continue;

    // Use city coords as base with small random offset
    // In production, you'd geocode the actual location
    const coords = {
      lat: city.coords.lat + (Math.random() - 0.5) * 0.02,
      lng: city.coords.lon + (Math.random() - 0.5) * 0.02,
    };

    const challenge = generateCheckinChallenge(city, location, coords, {
      type: config.type,
      category: config.category as GenerateChallengeOptions["category"],
      maxClaims: config.category === "limited" ? 10 : undefined,
      createAnnouncement: i === 0, // Only first challenge gets announcement
    });

    challenges.push(challenge);
  }

  return challenges;
}

/**
 * Generate a pre-defined trail for a city
 */
export function generateCityTrail(
  city: CityConfig,
  theme: keyof typeof TRAIL_THEMES = "taco"
): { trail: TrailDefinition; challenges: GeneratedChallenge[] } | null {
  const themeConfig = TRAIL_THEMES[theme];

  // Find matching restaurants/venues
  const matchingVenues: string[] = [];

  for (const venueType of themeConfig.venues as Array<keyof CityLandmarks>) {
    const venues = city.landmarks[venueType];
    for (const venue of venues) {
      const venueName = getLandmarkName(venue);
      const lowerVenue = venueName.toLowerCase();
      if (themeConfig.keywords.some((kw) => lowerVenue.includes(kw))) {
        matchingVenues.push(venueName);
      }
    }
  }

  // Need at least 3 stops for a trail
  if (matchingVenues.length < 3) {
    return null;
  }

  // Take up to 5 stops
  const selectedVenues = matchingVenues.slice(0, 5);

  const stops: TrailStop[] = selectedVenues.map((venue, index) => ({
    locationName: venue,
    targetLat: city.coords.lat + (Math.random() - 0.5) * 0.03,
    targetLng: city.coords.lon + (Math.random() - 0.5) * 0.03,
    description: `Stop ${index + 1}: Check in at ${venue}`,
    xpReward: calculateXpReward("checkin", false, true),
  }));

  return generateTrail(city, theme, stops);
}

export { TRAIL_THEMES };
