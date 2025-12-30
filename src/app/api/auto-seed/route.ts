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

// Event-based post templates - designed to invite engagement
const EVENT_TEMPLATES = [
  { mood: "🤩", template: (name: string, venue: string) => `${name} at ${venue} - anyone been before? Worth checking out?` },
  { mood: "🎉", template: (name: string, venue: string) => `Who's heading to ${name} at ${venue}? Looking for people to go with!` },
  { mood: "🤔", template: (name: string, venue: string) => `Thinking about checking out ${name} at ${venue}. Anyone know if parking is tough there?` },
  { mood: "😊", template: (name: string, venue: string) => `${name} at ${venue} tonight! What's everyone wearing to this kind of thing?` },
];

// Farmers market templates - ask for recommendations
const MARKET_TEMPLATES = [
  { mood: "🤩", template: (name: string, day: string) => `${name} on ${day} - what vendors should I check out first?` },
  { mood: "😊", template: (name: string, day: string) => `Anyone know the best time to hit ${name}? Want to beat the crowds!` },
  { mood: "☀️", template: (name: string, day: string) => `${name} every ${day} - favorite thing to buy there? I'm new to the area.` },
];

// Weather-based templates - conversation starters
const WEATHER_TEMPLATES: Record<string, { mood: string; templates: string[] }> = {
  clear: {
    mood: "☀️",
    templates: [
      "Perfect weather today! Anyone know good spots for an outdoor lunch around here?",
      "Sun's out! What's everyone's favorite outdoor spot in the neighborhood?",
      "Beautiful day - any good walking trails nearby? New to the area.",
    ],
  },
  clouds: {
    mood: "😌",
    templates: [
      "Cloudy but nice out. Good coffee shop recommendations for working remotely?",
      "Overcast vibes today. What's everyone up to this afternoon?",
      "Perfect errand-running weather. Any hidden gem shops I should check out?",
    ],
  },
  rain: {
    mood: "🏠",
    templates: [
      "Rainy day! Best cozy spots to grab a drink and read a book?",
      "Rain's coming down - what indoor activities do y'all recommend around here?",
      "Wet roads today. Anyone know which streets flood easily?",
    ],
  },
  cold: {
    mood: "🥶",
    templates: [
      "Cold out there! Where's the best hot chocolate in the neighborhood?",
      "Brrr! Any warm indoor hangout spots people like around here?",
      "Chilly day - perfect soup weather. Best pho or ramen nearby?",
    ],
  },
  hot: {
    mood: "🥵",
    templates: [
      "Hot one today! Best places to cool off around here? Need AC!",
      "Summer heat hitting hard. Anyone know good swimming spots nearby?",
      "Scorcher! What's everyone's go-to for staying cool in this neighborhood?",
    ],
  },
};

// Traffic time-based templates - ask for tips
const TRAFFIC_TEMPLATES: Record<string, { mood: string; templates: string[] }> = {
  morning_rush: {
    mood: "🏃",
    templates: [
      "Morning commute building up. Any good shortcuts people know about?",
      "Rush hour hitting. How long does it usually take to get downtown from here?",
      "Traffic picking up - anyone know if the main roads are worse than side streets?",
    ],
  },
  evening_rush: {
    mood: "😤",
    templates: [
      "Evening rush is on. Best route to avoid the worst of it? Still learning the area.",
      "5 o'clock traffic - anyone else stuck? What podcasts are y'all listening to?",
      "Traffic building up. Worth waiting it out somewhere or just power through?",
    ],
  },
  light: {
    mood: "😌",
    templates: [
      "Roads are clear! Good time to explore - what part of town should I check out?",
      "Light traffic right now. Perfect time to run errands. Any store recommendations?",
      "Smooth sailing on the roads. Where's everyone heading today?",
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
