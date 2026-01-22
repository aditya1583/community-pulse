import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasIntelligentBotConfig, generateColdStartPosts, getCityConfig } from "@/lib/intelligent-bots";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import { formatDistance } from "@/lib/geo/distance";

// City coordinates for distance-based filtering
// Used when bot posts are created to enable distance sorting
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "leander": { lat: 30.5788, lon: -97.8531 },
  "cedar park": { lat: 30.5052, lon: -97.8203 },
  "austin": { lat: 30.2672, lon: -97.7431 },
  "round rock": { lat: 30.5083, lon: -97.6789 },
  "georgetown": { lat: 30.6333, lon: -97.6780 },
  "pflugerville": { lat: 30.4394, lon: -97.6200 },
  "kyle": { lat: 29.9894, lon: -97.8772 },
  "san marcos": { lat: 29.8833, lon: -97.9414 },
  "buda": { lat: 30.0852, lon: -97.8403 },
  "hutto": { lat: 30.5427, lon: -97.5467 },
  "taylor": { lat: 30.5708, lon: -97.4097 },
  "lakeway": { lat: 30.3641, lon: -97.9797 },
  "dripping springs": { lat: 30.1902, lon: -98.0867 },
  "bee cave": { lat: 30.3085, lon: -97.9469 },
  "manor": { lat: 30.3416, lon: -97.5567 },
};

function getCityCoordinates(cityName: string): { lat: number; lon: number } | null {
  // First try the intelligent bot config
  const cityConfig = getCityConfig(cityName);
  if (cityConfig?.coords) {
    return { lat: cityConfig.coords.lat, lon: cityConfig.coords.lon };
  }

  // Fallback to static coordinates lookup
  const normalized = cityName.toLowerCase().split(",")[0].trim();
  return CITY_COORDINATES[normalized] ?? null;
}

/**
 * Auto-Seed API - Generates contextual bot posts for empty cities
 *
 * When a user visits a city with 0 pulses, this endpoint creates
 * 3-5 relevant posts based on REAL data (events, weather, farmers markets).
 *
 * For cities with intelligent bot configuration (Leander, Cedar Park, Austin),
 * this uses the hyperlocal intelligent-seed system with real road names.
 *
 * Posts are marked as bot posts and feel natural, not templated.
 */

// Bot pulses use null user_id to avoid foreign key constraint issues
// They are identified by is_bot = true instead

/**
 * BOT PERSONALITIES - Three distinct personas that feel human
 *
 * 1. The Complainer - Vents about traffic, potholes, delays (relatable frustration)
 * 2. The Promoter - Hypes up events, excited about local happenings
 * 3. The Helper - Warns about weather, shares safety tips, gives advice
 */
type BotPersonality = "complainer" | "promoter" | "helper";

const BOT_PERSONAS: Record<BotPersonality, {
  names: string[];
  tags: string[];
  mood: string;
}> = {
  complainer: {
    names: ["TrafficGrump", "RoadRanter", "CommuteComplainer", "StuckInTraffic"],
    tags: ["Traffic"],
    mood: "😤",
  },
  promoter: {
    names: ["EventHyper", "NightOwl", "LocalBuzz", "WeekendWarrior"],
    tags: ["Events"],
    mood: "🤩",
  },
  helper: {
    names: ["WeatherWatch", "SafetyFirst", "LocalHelper", "NeighborTips"],
    tags: ["Weather", "General"],
    mood: "😊",
  },
};

function getBotPersona(tag: string): BotPersonality {
  if (tag === "Traffic") return "complainer";
  if (tag === "Events") return "promoter";
  return "helper";
}

function getBotName(tag: string, city: string): string {
  const personality = getBotPersona(tag);
  const persona = BOT_PERSONAS[personality];
  const baseName = persona.names[Math.floor(Math.random() * persona.names.length)];
  const citySlug = city.split(",")[0].trim().replace(/\s+/g, "");
  return `${baseName}_${citySlug}`;
}

// Event-based post templates - THE PROMOTER personality (excited, hype!)
// In-radius events (within 10 miles) - LOCAL EVENTS with date
const EVENT_TEMPLATES = [
  { mood: "🤩", template: (name: string, venue: string, date: string) => `🎟️ ${name} on ${date} @ ${venue}! Who else is going?! This is gonna be GOOD 🔥` },
  { mood: "🎉", template: (name: string, venue: string, date: string) => `📅 ${date}: ${name} at ${venue}! Finally something fun happening locally! Anyone need a plus one?` },
  { mood: "🤩", template: (name: string, venue: string, date: string) => `Just found out about ${name} at ${venue} on ${date} - why didn't anyone tell me sooner?! Who's in?` },
  { mood: "🎉", template: (name: string, venue: string, date: string) => `🎫 ${name} @ ${venue} - ${date}! Been waiting for this. See y'all there! 🙌` },
];

// Out-of-radius events (10-50 miles) - include date AND distance callout
const DISTANT_EVENT_TEMPLATES = [
  { mood: "🤩", template: (name: string, venue: string, date: string, distance: string) => `🎟️ ${name} on ${date} @ ${venue} (${distance} away) - might be worth the drive! Anyone going? 🚗` },
  { mood: "🎉", template: (name: string, venue: string, date: string, distance: string) => `📅 ${date}: ${name} at ${venue} (${distance} away). Road trip anyone?` },
  { mood: "🤩", template: (name: string, venue: string, date: string, distance: string) => `${name} at ${venue} on ${date} is ${distance} away but looks amazing! Who's down to make the trip?` },
  { mood: "🎉", template: (name: string, venue: string, date: string, distance: string) => `🎫 ${date}: ${name} @ ${venue} - ${distance} drive but could be worth it! 🎶` },
];

// Farmers market templates - ask for recommendations
const MARKET_TEMPLATES = [
  { mood: "🤩", template: (name: string, day: string) => `${name} on ${day} - what vendors should I check out first?` },
  { mood: "😊", template: (name: string, day: string) => `Anyone know the best time to hit ${name}? Want to beat the crowds!` },
  { mood: "☀️", template: (name: string, day: string) => `${name} every ${day} - favorite thing to buy there? I'm new to the area.` },
];

// Weather-based templates - THE HELPER personality (warnings, tips, helpful advice)
// IMPORTANT: Templates MUST reflect actual weather conditions. "Perfect" is for clear/sunny ONLY.
const WEATHER_TEMPLATES: Record<string, { mood: string; templates: string[] }> = {
  clear: {
    mood: "☀️",
    templates: [
      "PSA: Beautiful weather today! Great day to get outside. Don't forget sunscreen if you're out long! ☀️",
      "Heads up: Clear skies and nice conditions today. If you've been putting off outdoor errands, today's the day!",
      "Tip: Clear skies all day. Great time to check those outdoor tasks off your list!",
    ],
  },
  clouds: {
    mood: "☁️",
    templates: [
      "FYI: Overcast today - good for outdoor activities without the harsh sun. Layer up!",
      "Weather update: Cloudy skies but no rain expected. Good day for errands.",
      "Tip: Gray skies today but staying dry. Not bad for getting things done! ☁️",
    ],
  },
  clouds_cold: {
    mood: "🥶",
    templates: [
      "☁️ Overcast and chilly today - grab a jacket if you're heading out!",
      "Weather check: Cloudy and cold. Hot coffee sounds perfect right now. ☕",
      "FYI: Gray skies and cool temps today. Stay warm out there! 🧥",
    ],
  },
  rain: {
    mood: "🌧️",
    templates: [
      "🌧️ Rain alert! If you're driving, remember to slow down. Some streets flood around here!",
      "Heads up: Getting wet out there! Don't forget your umbrella if you're heading out. ☔",
      "FYI: Rainy day - perfect excuse to support a local coffee shop. Stay dry everyone! 🌧️",
    ],
  },
  cold: {
    mood: "🥶",
    templates: [
      "Brrr! ❄️ Bundle up if you're heading out! Don't forget to check on elderly neighbors too.",
      "Cold weather alert: Make sure pets aren't left outside too long! Stay warm everyone.",
      "FYI: Chilly one today. Hot drinks at local cafes are calling! Any favorites to recommend? ☕",
    ],
  },
  hot: {
    mood: "🥵",
    templates: [
      "🔥 Heat advisory vibes! Stay hydrated and check on neighbors who might not have AC.",
      "Hot weather tip: Avoid being outside 12-3pm if possible. Take care of yourselves!",
      "PSA: It's a scorcher! Make sure to drink water and give pets shade. Stay cool! 💧",
    ],
  },
};

// Traffic time-based templates - THE COMPLAINER personality (venting, relatable frustration)
const TRAFFIC_TEMPLATES: Record<string, { mood: string; templates: string[] }> = {
  morning_rush: {
    mood: "😤",
    templates: [
      "Ugh, already backed up on the main road. WHY does everyone leave at the same time?! 🙄",
      "This morning commute is killing me. There's gotta be a better route... anyone?",
      "Stuck behind the slowest driver ever. Of course. How's everyone else's commute going?",
    ],
  },
  evening_rush: {
    mood: "😤",
    templates: [
      "5pm traffic is NO JOKE today. I've moved 2 blocks in 15 minutes. Send help. 😩",
      "Why is there ALWAYS an accident right at rush hour?! Anyone know what happened?",
      "Bumper to bumper on every single road. This city needs better traffic planning fr fr",
    ],
  },
  light: {
    mood: "😌",
    templates: [
      "Finally! Roads are actually clear for once. Quick, go run your errands NOW before it gets bad again!",
      "Wow traffic is weirdly light right now. Is there a holiday I don't know about? 🤔",
      "Smooth driving today! Enjoy it while it lasts, y'all know it won't stay this way 😅",
    ],
  },
};

// General local interest templates - THE HELPER personality
const LOCAL_TEMPLATES = [
  { mood: "😊", message: "Tip: Support local businesses this week! Drop your favorite small shops below 👇" },
  { mood: "😊", message: "PSA: Friendly reminder to keep an eye out for package thieves this time of year! Stay safe neighbors." },
  { mood: "☀️", message: "FYI: If anyone's new to the area, feel free to ask questions! We're a helpful bunch around here 🙂" },
];

type EventData = {
  name: string;
  venue: string;
  date?: string;
  category?: string | null;
  /** Distance from user's location in miles */
  distanceMiles?: number;
};

type MarketData = {
  name: string;
  day: string;
  address?: string;
};

type WeatherData = {
  description: string;
  temp: number;
  icon?: string;
};

type AutoSeedRequest = {
  city: string;
  events?: EventData[];
  farmersMarkets?: MarketData[];
  weather?: WeatherData | null;
  force?: boolean; // Bypass cooldown for testing
  lat?: number; // Coordinates for universal intelligent bot support
  lon?: number;
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWeatherCategory(weather: WeatherData): keyof typeof WEATHER_TEMPLATES {
  const desc = weather.description.toLowerCase();
  const temp = weather.temp;

  // PRIORITY ORDER: Precipitation > Extreme temps > Condition-based
  // This ensures we never say "perfect" when it's actually raining or freezing

  // 1. Precipitation takes highest priority - ALWAYS mention if raining
  if (desc.includes("rain") || desc.includes("drizzle") || desc.includes("shower") || desc.includes("thunder")) {
    return "rain";
  }

  // 2. Extreme temperatures
  if (temp < 40) return "cold";  // Lowered from 45 to 40 for "cold"
  if (temp > 85) return "hot";

  // 3. Cool + cloudy combo (40-55F with clouds)
  if (temp < 55 && (desc.includes("cloud") || desc.includes("overcast"))) {
    return "clouds_cold";
  }

  // 4. Clear/sunny conditions
  if (desc.includes("clear") || desc.includes("sun")) {
    return "clear";
  }

  // 5. Default to cloudy for overcast conditions
  return "clouds";
}

function getTrafficCategory(): keyof typeof TRAFFIC_TEMPLATES {
  const hour = new Date().getHours();
  if (hour >= 7 && hour <= 9) return "morning_rush";
  if (hour >= 16 && hour <= 19) return "evening_rush";
  return "light";
}

function normalizeEventName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^\w\s]/g, "");
}

/**
 * Format event date for display
 * e.g., "2026-01-10" → "Jan 10"
 */
function formatEventDate(dateStr?: string): string {
  if (!dateStr) return "Soon";
  try {
    const date = new Date(dateStr + "T12:00:00"); // Avoid timezone issues
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Soon";
  }
}

function generatePosts(data: AutoSeedRequest): Array<{ message: string; mood: string; tag: string }> {
  const posts: Array<{ message: string; mood: string; tag: string }> = [];

  // 1. Event posts (if events available) - deduplicate and sort by distance
  if (data.events && data.events.length > 0) {
    // Deduplicate events by normalized name
    const seenNames = new Set<string>();
    const uniqueEvents = data.events.filter(e => {
      const normalized = normalizeEventName(e.name);
      if (seenNames.has(normalized)) return false;
      seenNames.add(normalized);
      return true;
    });

    // Sort by distance - LOCAL events first (closest to user)
    uniqueEvents.sort((a, b) => {
      const distA = a.distanceMiles ?? 999;
      const distB = b.distanceMiles ?? 999;
      return distA - distB;
    });

    // Separate local vs distant events
    const localEvents = uniqueEvents.filter(e =>
      e.distanceMiles === undefined || e.distanceMiles <= RADIUS_CONFIG.PRIMARY_RADIUS_MILES
    );
    const distantEvents = uniqueEvents.filter(e =>
      e.distanceMiles !== undefined && e.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES
    );

    console.log(`[Auto-Seed] Events: ${localEvents.length} local, ${distantEvents.length} distant`);

    // First: Post about LOCAL event (most important - hyperlocal!)
    if (localEvents.length > 0) {
      const event = localEvents[0];
      const template = getRandomItem(EVENT_TEMPLATES);
      const dateStr = formatEventDate(event.date);
      posts.push({
        message: template.template(event.name, event.venue, dateStr),
        mood: template.mood,
        tag: "Events",
      });
    }

    // Second: Post about DISTANT event (if available) - with distance callout
    if (distantEvents.length > 0) {
      const event = distantEvents[0];
      const template = getRandomItem(DISTANT_EVENT_TEMPLATES);
      const dateStr = formatEventDate(event.date);
      const distanceStr = formatDistance(event.distanceMiles!);
      posts.push({
        message: template.template(event.name, event.venue, dateStr, distanceStr),
        mood: template.mood,
        tag: "Events",
      });
    }

    // Third: If we only have local events, add a second local one
    if (distantEvents.length === 0 && localEvents.length > 1) {
      const event2 = localEvents[1];
      const template2 = getRandomItem(EVENT_TEMPLATES);
      const dateStr2 = formatEventDate(event2.date);
      posts.push({
        message: template2.template(event2.name, event2.venue, dateStr2),
        mood: template2.mood,
        tag: "Events",
      });
    }

    // Fourth: If we only have distant events, add a second distant one
    if (localEvents.length === 0 && distantEvents.length > 1) {
      const event2 = distantEvents[1];
      const template2 = getRandomItem(DISTANT_EVENT_TEMPLATES);
      const dateStr2 = formatEventDate(event2.date);
      const distanceStr2 = formatDistance(event2.distanceMiles!);
      posts.push({
        message: template2.template(event2.name, event2.venue, dateStr2, distanceStr2),
        mood: template2.mood,
        tag: "Events",
      });
    }
  }

  // 2. Farmers market post (if markets available)
  if (data.farmersMarkets && data.farmersMarkets.length > 0) {
    const market = data.farmersMarkets[0];
    const template = getRandomItem(MARKET_TEMPLATES);
    posts.push({
      message: template.template(market.name, market.day),
      mood: template.mood,
      tag: "Events",
    });
  }

  // 3. Weather post - only if we have VALID weather data
  if (data.weather && data.weather.temp !== undefined) {
    const category = getWeatherCategory(data.weather);
    console.log(`[Auto-Seed] Weather: ${data.weather.temp}°F "${data.weather.description}" → category: ${category}`);
    const weatherData = WEATHER_TEMPLATES[category];
    posts.push({
      message: getRandomItem(weatherData.templates),
      mood: weatherData.mood,
      tag: "Weather",
    });
  }

  // 4. Traffic post (time-based) - ALWAYS include regardless of other data
  const trafficCategory = getTrafficCategory();
  const trafficData = TRAFFIC_TEMPLATES[trafficCategory];
  posts.push({
    message: getRandomItem(trafficData.templates),
    mood: trafficData.mood,
    tag: "Traffic",
  });

  // 5. General local post - ALWAYS include to ensure minimum content
  const local = getRandomItem(LOCAL_TEMPLATES);
  posts.push({
    message: local.message,
    mood: local.mood,
    tag: "General",
  });

  // 6. Add a second traffic or general post if we have fewer than 3 posts
  // This ensures even cities with NO events/weather get meaningful content
  if (posts.length < 3) {
    const otherTraffic = getRandomItem(
      TRAFFIC_TEMPLATES[getTrafficCategory()].templates.filter(
        t => t !== posts.find(p => p.tag === "Traffic")?.message
      )
    );
    posts.push({
      message: otherTraffic,
      mood: trafficData.mood,
      tag: "Traffic",
    });
  }

  // Limit to 5 posts max
  return posts.slice(0, 5);
}

export async function POST(req: NextRequest) {
  // Get Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body: AutoSeedRequest = await req.json();

    if (!body.city) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    console.log(`[Auto-Seed] Starting for city: ${body.city}`);

    // UNIVERSAL INTELLIGENT BOTS: Try intelligent system for ALL cities when coords are provided
    // This enables contextual polls, farmers markets, and weather-based content for any location
    const cityName = body.city.split(",")[0].trim();
    const hasCoords = body.lat !== undefined && body.lon !== undefined;
    const hasPreconfiguredCity = hasIntelligentBotConfig(cityName);

    // Use intelligent bots when:
    // 1. City has pre-configured hyperlocal data (Leander, Austin, Cedar Park), OR
    // 2. We have coordinates (can generate dynamic config for any city)
    if (hasPreconfiguredCity || hasCoords) {
      const mode = hasPreconfiguredCity ? "hyperlocal" : "universal";
      console.log(`[Auto-Seed] Using intelligent bot system (${mode}) for "${cityName}"`);

      // Check for recent posts first (fetch messages for deduplication)
      // Use 24-hour window to catch duplicates from previous day
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingPulses } = await supabase
        .from("pulses")
        .select("id, message")
        .eq("city", body.city)
        .gte("created_at", twentyFourHoursAgo)
        .limit(30); // Check up to 30 recent posts for duplicates

      // Skip ONLY if we have enough pulses (>= 5) AND we're not forcing
      if (existingPulses && existingPulses.length >= 5 && !body.force) {
        return NextResponse.json({
          success: true,
          message: "City already has recent pulses, skipping seed",
          created: 0,
          existingCount: existingPulses.length,
          pulses: [],
        });
      }

      console.log(`[Auto-Seed] Intelligent Bot: Active (Existing: ${existingPulses?.length || 0})`);

      // Use intelligent bot system with coords for universal support
      // Generate 5 varied posts
      const coords = hasCoords ? { lat: body.lat!, lon: body.lon! } : undefined;
      const result = await generateColdStartPosts(cityName, {
        count: 5,
        force: true,
        coords,
      });

      if (!result.success || result.posts.length === 0) {
        console.log(`[Auto-Seed] Intelligent bots returned no posts: ${result.reason}`);
        // Fall through to generic system below
      } else {
        // FILTER DUPLICATES: Check against existing messages
        const existingMessages = new Set((existingPulses || []).map(p => p.message?.toLowerCase() || ""));

        const uniquePosts = result.posts.filter(post => {
          const postMsg = post.message.toLowerCase();

          // Check for exact match or significant overlap
          let isDuplicate = Array.from(existingMessages).some(existing =>
            existing.includes(postMsg) || postMsg.includes(existing) ||
            (existing.length > 20 && postMsg.length > 20 && (existing.includes(postMsg.slice(0, 20)) || postMsg.includes(existing.slice(0, 20))))
          );

          // VENUE-BASED DEDUPLICATION (for intelligent posts with actions)
          // Prevents "Farmers Grass" appearing 3 times with different templates
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const actionVenue = (post as any).action?.venue?.name?.toLowerCase();
          if (!isDuplicate && actionVenue) {
            isDuplicate = Array.from(existingMessages).some(existing => existing.includes(actionVenue));
            if (isDuplicate) console.log(`[Auto-Seed] Skipped duplicate venue: "${actionVenue}"`);
          }

          if (isDuplicate && !actionVenue) {
            console.log(`[Auto-Seed] Skipped duplicate post: "${post.message.slice(0, 30)}..."`);
          }
          return !isDuplicate;
        });

        if (uniquePosts.length === 0) {
          console.log(`[Auto-Seed] All generated posts were duplicates. Skipping.`);
          return NextResponse.json({
            success: true,
            message: "No new unique posts generated (all duplicates)",
            created: 0,
            pulses: [],
          });
        }

        // Insert intelligent bot posts with natural timing variation
        // Real users don't post at exact intervals - add organic randomness
        const now = Date.now();
        let cumulativeOffset = 0;

        // Use provided coords or fall back to city lookup
        const cityCoords = hasCoords
          ? { lat: body.lat!, lon: body.lon! }
          : getCityCoordinates(body.city);

        const records = uniquePosts.map((post, index) => {
          // First post is "now", subsequent posts are staggered backwards in time
          // Each post is 3-7 minutes apart (varies per post) to feel organic
          if (index > 0) {
            const minGapMs = 3 * 60 * 1000; // 3 minutes minimum
            const maxGapMs = 7 * 60 * 1000; // 7 minutes maximum
            const randomGap = minGapMs + Math.random() * (maxGapMs - minGapMs);
            cumulativeOffset += randomGap;
          }

          const createdAt = new Date(now - cumulativeOffset).toISOString();
          const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();

          return {
            city: body.city,
            message: post.message,
            tag: post.tag,
            mood: post.mood,
            author: post.author,
            user_id: null,
            is_bot: true,
            hidden: false,
            created_at: createdAt,
            expires_at: expiresAt,
            poll_options: post.options || null,
            lat: cityCoords?.lat ?? null,
            lon: cityCoords?.lon ?? null,
          };
        });

        const { data, error } = await supabase
          .from("pulses")
          .insert(records)
          .select("id, city, message, tag, mood, created_at, poll_options");

        if (error) {
          console.error("[Auto-Seed] Intelligent bot insert error:", error);
          return NextResponse.json(
            { error: "Failed to create pulses", details: error.message },
            { status: 500 }
          );
        }

        console.log(`[Auto-Seed] SUCCESS! Created ${data.length} intelligent bot pulses for ${body.city} (${mode})`);
        return NextResponse.json({
          success: true,
          created: data.length,
          pulses: data,
          mode: "intelligent",
          intelligentMode: mode,
          situationSummary: result.situationSummary,
        });
      }
    }

    // Check if city already has ANY pulses in the last 4 hours (Generic fallback)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: existingPulses, error: checkError } = await supabase
      .from("pulses")
      .select("id, is_bot, created_at, message") // Added message
      .eq("city", body.city)
      .gte("created_at", fourHoursAgo)
      .limit(10);

    if (checkError) {
      console.error("[Auto-Seed] Error checking existing pulses:", checkError);
    }

    console.log(`[Auto-Seed] Found ${existingPulses?.length || 0} existing pulses in last 4 hours`);

    if (existingPulses && existingPulses.length >= 5 && !body.force) {
      console.log(`[Auto-Seed] Skipping - city has sufficient activity (${existingPulses.length} pulses)`);
      return NextResponse.json({
        success: true,
        message: "City has sufficient recent pulses, skipping seed",
        created: 0,
        existingCount: existingPulses.length,
        pulses: [],
      });
    }

    // If we have some pulses but fewer than 5, we'll top up
    if (existingPulses && existingPulses.length > 0) {
      console.log(`[Auto-Seed] Top-up mode: City has ${existingPulses.length} pulses, adding more to reach critical mass`);
    }

    if (body.force) {
      console.log(`[Auto-Seed] Force mode - bypassing cooldown`);
    }

    // Generate contextual posts
    const posts = generatePosts(body);

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No posts to generate",
        created: 0,
        pulses: [],
      });
    }

    // Create posts with natural timing variation
    // Posts should feel like they were written by different people at different times
    const now = Date.now();
    let cumulativeOffset = 0;

    // Get city coordinates for distance-based filtering
    const cityCoords = getCityCoordinates(body.city);

    const records = posts.map((post, index) => {
      // Stagger posts backwards in time with natural variation
      // Each post is 4-12 minutes apart (wider variance for non-intelligent seeds)
      if (index > 0) {
        const minGapMs = 4 * 60 * 1000;  // 4 minutes minimum
        const maxGapMs = 12 * 60 * 1000; // 12 minutes maximum
        const randomGap = minGapMs + Math.random() * (maxGapMs - minGapMs);
        cumulativeOffset += randomGap;
      }

      const createdAt = new Date(now - cumulativeOffset).toISOString();
      const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

      return {
        city: body.city,
        message: post.message,
        tag: post.tag,
        mood: post.mood,
        author: getBotName(post.tag, body.city),
        user_id: null, // Bot pulses don't have a user - identified by is_bot flag
        is_bot: true,
        hidden: false, // Explicitly set to ensure RLS allows reading
        created_at: createdAt,
        expires_at: expiresAt,
        lat: cityCoords?.lat ?? null,
        lon: cityCoords?.lon ?? null,
      };
    });

    console.log(`[Auto-Seed] Creating ${records.length} posts for ${body.city}`);

    // Insert into database
    const { data, error } = await supabase
      .from("pulses")
      .insert(records)
      .select("id, city, message, tag, mood, created_at");

    if (error) {
      console.error("[Auto-Seed] Database insert error:", error);
      console.error("[Auto-Seed] Error details - code:", error.code, "message:", error.message);
      return NextResponse.json(
        {
          error: "Failed to create pulses",
          details: error.message,
          code: error.code,
          hint: error.code === "23503" ? "Foreign key constraint - check if user_id is valid" : undefined
        },
        { status: 500 }
      );
    }

    console.log(`[Auto-Seed] SUCCESS! Created ${data.length} pulses for ${body.city}`);

    return NextResponse.json({
      success: true,
      created: data.length,
      pulses: data,
    });

  } catch (err) {
    console.error("[Auto-Seed] Unexpected error:", err);
    return NextResponse.json(
      { error: "Invalid request", details: String(err) },
      { status: 400 }
    );
  }
}

// GET endpoint for debugging - manually trigger seed for a city
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const force = searchParams.get("force") === "true";

  if (!city) {
    return NextResponse.json({
      error: "City parameter required. Usage: /api/auto-seed?city=Leander, TX&force=true"
    }, { status: 400 });
  }

  console.log(`[Auto-Seed GET] Manual trigger for: ${city}, force: ${force}`);

  // First, geocode the city to get lat/lng for accurate API calls
  let lat: number | null = null;
  let lon: number | null = null;

  try {
    const geocodeRes = await fetch(
      `${req.nextUrl.origin}/api/geocode?city=${encodeURIComponent(city)}`
    );
    if (geocodeRes.ok) {
      const geoData = await geocodeRes.json();
      if (geoData.lat && geoData.lon) {
        lat = geoData.lat;
        lon = geoData.lon;
        console.log(`[Auto-Seed GET] Geocoded ${city} → ${lat}, ${lon}`);
      }
    }
  } catch (err) {
    console.log(`[Auto-Seed GET] Geocoding failed: ${err}`);
  }

  // Fetch events using lat/lng (most accurate method)
  // Request 50mi radius to get both local AND distant events for variety
  let events: EventData[] = [];
  if (lat && lon) {
    try {
      const eventsRes = await fetch(
        `${req.nextUrl.origin}/api/events/ticketmaster?lat=${lat}&lng=${lon}&radius=50`
      );
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        events = (eventsData.events || []).slice(0, 10).map((e: any) => ({
          name: e.name,
          venue: e.venue || "Local Venue",
          date: e.date,
          category: e.category,
          distanceMiles: e.distanceMiles, // Include distance for sorting/display
        }));

        // Log local vs distant events for debugging
        const localCount = events.filter(e => !e.distanceMiles || e.distanceMiles <= 10).length;
        const distantCount = events.filter(e => e.distanceMiles && e.distanceMiles > 10).length;
        console.log(`[Auto-Seed GET] Found ${events.length} events for ${city}: ${localCount} local, ${distantCount} distant`);
      }
    } catch (err) {
      console.log(`[Auto-Seed GET] Events fetch failed: ${err}`);
    }
  }

  console.log(`[Auto-Seed GET] Total events collected: ${events.length}`);

  // Also fetch current weather for accurate posts (use lat/lng if available)
  let weather: WeatherData | null = null;
  try {
    const weatherUrl = lat && lon
      ? `${req.nextUrl.origin}/api/weather?lat=${lat}&lon=${lon}`
      : `${req.nextUrl.origin}/api/weather?city=${encodeURIComponent(city)}`;

    const weatherRes = await fetch(weatherUrl);
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      console.log(`[Auto-Seed GET] Weather API response:`, JSON.stringify(weatherData).slice(0, 200));

      if (weatherData.temp !== undefined) {
        weather = {
          description: weatherData.description || weatherData.weather || "clear",
          temp: weatherData.temp,
          icon: weatherData.icon,
        };
        console.log(`[Auto-Seed GET] Weather for ${city}: ${weather.temp}°F, ${weather.description}`);
      }
    } else {
      console.log(`[Auto-Seed GET] Weather API returned ${weatherRes.status}`);
    }
  } catch (err) {
    console.log(`[Auto-Seed GET] Could not fetch weather: ${err}`);
  }

  // Forward to POST handler with events, weather, AND coordinates
  // Including lat/lon enables universal intelligent bot support for any city
  const response = await POST(
    new NextRequest(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city,
        events,
        weather,
        force,
        lat: lat ?? undefined,
        lon: lon ?? undefined,
      }),
    })
  );

  return response;
}
