import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Auto-Seed API - Generates contextual bot posts for empty cities
 *
 * When a user visits a city with 0 pulses, this endpoint creates
 * 3-5 relevant posts based on REAL data (events, weather, farmers markets).
 *
 * Posts are marked as bot posts and feel natural, not templated.
 */

// This UUID must exist in auth.users table - run the SQL migration to create it
const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";

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
const EVENT_TEMPLATES = [
  { mood: "🤩", template: (name: string, venue: string) => `OMG ${name} at ${venue}!! Who else is going?! This is gonna be GOOD 🔥` },
  { mood: "🎉", template: (name: string, venue: string) => `${name} tonight at ${venue}! Finally something fun happening around here! Anyone need a plus one?` },
  { mood: "🤩", template: (name: string, venue: string) => `Just found out about ${name} at ${venue} - why didn't anyone tell me sooner?! Who's in?` },
  { mood: "🎉", template: (name: string, venue: string) => `${name} at ${venue}!! Been waiting for this all week. See y'all there! 🙌` },
];

// Farmers market templates - ask for recommendations
const MARKET_TEMPLATES = [
  { mood: "🤩", template: (name: string, day: string) => `${name} on ${day} - what vendors should I check out first?` },
  { mood: "😊", template: (name: string, day: string) => `Anyone know the best time to hit ${name}? Want to beat the crowds!` },
  { mood: "☀️", template: (name: string, day: string) => `${name} every ${day} - favorite thing to buy there? I'm new to the area.` },
];

// Weather-based templates - THE HELPER personality (warnings, tips, helpful advice)
const WEATHER_TEMPLATES: Record<string, { mood: string; templates: string[] }> = {
  clear: {
    mood: "☀️",
    templates: [
      "PSA: Beautiful weather today! Great day to get outside. Don't forget sunscreen if you're out long! ☀️",
      "Heads up: Perfect conditions today. If you've been putting off outdoor errands, today's the day!",
      "Tip: Clear skies all day. Great time to check those outdoor tasks off your list!",
    ],
  },
  clouds: {
    mood: "😊",
    templates: [
      "FYI: Overcast but no rain expected. Good day for outdoor activities without the harsh sun!",
      "Weather update: Cloudy but dry. Perfect if you don't like it too sunny. Enjoy!",
      "Tip: Great weather for a walk - not too hot, not too cold. Take advantage! 🙂",
    ],
  },
  rain: {
    mood: "🏠",
    templates: [
      "⚠️ Rain alert! If you're driving, remember to slow down. Some streets flood around here!",
      "Heads up: Getting wet out there! Don't forget your umbrella if you're heading out.",
      "FYI: Rainy day - perfect excuse to support a local coffee shop. Stay dry everyone!",
    ],
  },
  cold: {
    mood: "🥶",
    templates: [
      "Brrr! ❄️ Bundle up if you're heading out! Don't forget to check on elderly neighbors too.",
      "Cold weather alert: Make sure pets aren't left outside too long! Stay warm everyone.",
      "FYI: Chilly one today. Hot drinks at local cafes are calling! Any favorites to recommend?",
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
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWeatherCategory(weather: WeatherData): keyof typeof WEATHER_TEMPLATES {
  const desc = weather.description.toLowerCase();
  const temp = weather.temp;

  if (temp < 45) return "cold";
  if (temp > 85) return "hot";
  if (desc.includes("rain") || desc.includes("drizzle") || desc.includes("shower")) return "rain";
  if (desc.includes("clear") || desc.includes("sun")) return "clear";
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

function generatePosts(data: AutoSeedRequest): Array<{ message: string; mood: string; tag: string }> {
  const posts: Array<{ message: string; mood: string; tag: string }> = [];

  // 1. Event post (if events available) - deduplicate first
  if (data.events && data.events.length > 0) {
    // Deduplicate events by normalized name
    const seenNames = new Set<string>();
    const uniqueEvents = data.events.filter(e => {
      const normalized = normalizeEventName(e.name);
      if (seenNames.has(normalized)) return false;
      seenNames.add(normalized);
      return true;
    });

    const event = uniqueEvents[0]; // Pick first/soonest unique event
    const template = getRandomItem(EVENT_TEMPLATES);
    posts.push({
      message: template.template(event.name, event.venue),
      mood: template.mood,
      tag: "Events",
    });

    // Add second event if available and different
    if (uniqueEvents.length > 1) {
      const event2 = uniqueEvents[1];
      const template2 = getRandomItem(EVENT_TEMPLATES.filter(t => t !== template));
      posts.push({
        message: template2.template(event2.name, event2.venue),
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

  // 3. Weather post
  if (data.weather) {
    const category = getWeatherCategory(data.weather);
    const weatherData = WEATHER_TEMPLATES[category];
    posts.push({
      message: getRandomItem(weatherData.templates),
      mood: weatherData.mood,
      tag: "Weather",
    });
  }

  // 4. Traffic post (time-based)
  const trafficCategory = getTrafficCategory();
  const trafficData = TRAFFIC_TEMPLATES[trafficCategory];
  posts.push({
    message: getRandomItem(trafficData.templates),
    mood: trafficData.mood,
    tag: "Traffic",
  });

  // 5. General local post (if we have fewer than 4 posts)
  if (posts.length < 4) {
    const local = getRandomItem(LOCAL_TEMPLATES);
    posts.push({
      message: local.message,
      mood: local.mood,
      tag: "General",
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

    // Check if city already has recent pulses (avoid duplicate seeding)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existingPulses } = await supabase
      .from("pulses")
      .select("id")
      .eq("city", body.city)
      .gte("created_at", oneHourAgo)
      .limit(1);

    if (existingPulses && existingPulses.length > 0) {
      return NextResponse.json({
        success: true,
        message: "City already has recent pulses, skipping seed",
        created: 0,
        pulses: [],
      });
    }

    // Check if we already seeded this city recently (24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentBotPulses } = await supabase
      .from("pulses")
      .select("id")
      .eq("city", body.city)
      .eq("is_bot", true)
      .gte("created_at", oneDayAgo)
      .limit(1);

    if (recentBotPulses && recentBotPulses.length > 0) {
      return NextResponse.json({
        success: true,
        message: "City was seeded recently, skipping",
        created: 0,
        pulses: [],
      });
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

    // Spread posts naturally over 3-6 hours to avoid "bot burst" appearance
    // Posts appear as if they were submitted over the past several hours
    const now = Date.now();
    const totalPosts = posts.length;

    // Calculate spread ONCE - random window between 3-6 hours
    const spreadWindowHours = 3 + Math.random() * 3;
    const spreadWindowMs = spreadWindowHours * 60 * 60 * 1000;

    // Generate random offsets for each post, then sort to ensure proper ordering
    const offsets = posts.map(() => Math.random() * spreadWindowMs);
    offsets.sort((a, b) => a - b); // Sort ascending so post order is consistent

    const records = posts.map((post, i) => {
      // Each post gets a unique offset from 0 to spreadWindow
      // Add minimum 30-minute gap from "now" so posts don't appear "just posted"
      const minOffsetMs = 30 * 60 * 1000; // 30 minutes minimum
      const offsetMs = minOffsetMs + offsets[i];

      const createdAt = new Date(now - offsetMs).toISOString();
      const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      return {
        city: body.city,
        message: post.message,
        tag: post.tag,
        mood: post.mood,
        author: getBotName(post.tag, body.city),
        user_id: BOT_USER_ID,
        is_bot: true,
        created_at: createdAt,
        expires_at: expiresAt,
      };
    });

    // Insert into database
    const { data, error } = await supabase
      .from("pulses")
      .insert(records)
      .select("id, city, message, tag, mood, created_at");

    if (error) {
      console.error("Error inserting auto-seed pulses:", error);
      return NextResponse.json(
        { error: "Failed to create pulses", details: error.message, code: error.code },
        { status: 500 }
      );
    }

    console.log(`Auto-seeded ${data.length} pulses for ${body.city}`);

    return NextResponse.json({
      success: true,
      created: data.length,
      pulses: data,
    });

  } catch (err) {
    console.error("Error in auto-seed:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
