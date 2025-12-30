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

const BOT_AUTHOR = "Community Bot";
// This UUID must exist in auth.users table - run the SQL migration to create it
const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";

// Event-based post templates with personality
const EVENT_TEMPLATES = [
  { mood: "🤩", template: (name: string, venue: string) => `${name} is happening at ${venue}! Who's going?` },
  { mood: "🎉", template: (name: string, venue: string) => `Excited for ${name} at ${venue} - should be a great time!` },
  { mood: "🤔", template: (name: string, venue: string) => `Anyone checking out ${name} at ${venue}? Heard good things.` },
  { mood: "😊", template: (name: string, venue: string) => `${name} tonight at ${venue}. Love when there's something fun happening locally!` },
];

// Farmers market templates
const MARKET_TEMPLATES = [
  { mood: "🤩", template: (name: string, day: string) => `${name} is open ${day}! Fresh produce and local vibes.` },
  { mood: "😊", template: (name: string, day: string) => `Can't wait to hit up ${name} on ${day}. Best local finds!` },
  { mood: "☀️", template: (name: string, day: string) => `${name} every ${day} - perfect way to support local farmers.` },
];

// Weather-based templates
const WEATHER_TEMPLATES: Record<string, { mood: string; templates: string[] }> = {
  clear: {
    mood: "☀️",
    templates: [
      "Beautiful clear sky out there today. Perfect for a walk!",
      "Sun's out! Great day to be outside in the neighborhood.",
      "Gorgeous weather today - not a cloud in sight.",
    ],
  },
  clouds: {
    mood: "😌",
    templates: [
      "Bit cloudy but nice out. Good day to run errands.",
      "Overcast but comfortable temps. Not bad at all!",
      "Cloudy skies but still pleasant outside.",
    ],
  },
  rain: {
    mood: "🏠",
    templates: [
      "Rain coming down - good day to stay cozy inside.",
      "Rainy day vibes. Drive safe out there everyone!",
      "Wet roads today. Take it slow if you're heading out.",
    ],
  },
  cold: {
    mood: "🥶",
    templates: [
      "Chilly out there today! Bundle up if you're heading out.",
      "Cold snap hitting us. Perfect hot coffee weather.",
      "Brrr! Definitely a jacket day today.",
    ],
  },
  hot: {
    mood: "🥵",
    templates: [
      "Hot one today! Stay hydrated out there.",
      "Summer heat is real today. AC is your friend!",
      "Scorcher of a day - perfect for staying cool indoors.",
    ],
  },
};

// Traffic time-based templates
const TRAFFIC_TEMPLATES: Record<string, { mood: string; templates: string[] }> = {
  morning_rush: {
    mood: "🏃",
    templates: [
      "Morning commute traffic picking up. Leave a few minutes early!",
      "Rush hour traffic building. Main roads are getting busy.",
      "Typical morning congestion starting. Plan accordingly!",
    ],
  },
  evening_rush: {
    mood: "😤",
    templates: [
      "Evening rush is on. Traffic getting heavy on the main roads.",
      "5 o'clock traffic hitting. Patience required on the commute!",
      "End of day traffic building up. Side streets might be better.",
    ],
  },
  light: {
    mood: "😌",
    templates: [
      "Roads looking clear right now. Good time to run errands!",
      "Traffic is light - smooth sailing out there.",
      "No congestion to report. Easy driving today!",
    ],
  },
};

// General local interest templates
const LOCAL_TEMPLATES = [
  { mood: "😊", message: "Love how this community comes together. What's everyone up to today?" },
  { mood: "🤔", message: "Any good restaurant recommendations around here? Always looking for new spots." },
  { mood: "☀️", message: "Great day to explore the neighborhood. Anyone know of hidden gems nearby?" },
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

    // Stagger creation times slightly for natural feel (0-10 min offsets)
    const now = Date.now();
    const records = posts.map((post, i) => {
      const offsetMs = i * 2 * 60 * 1000 + Math.random() * 60 * 1000; // 2 min apart + random
      const createdAt = new Date(now - offsetMs).toISOString();
      const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      return {
        city: body.city,
        message: post.message,
        tag: post.tag,
        mood: post.mood,
        author: BOT_AUTHOR,
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
