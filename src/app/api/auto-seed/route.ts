import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasIntelligentBotConfig, generateColdStartPosts } from "@/lib/intelligent-bots";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import { formatDistance } from "@/lib/geo/distance";

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
// In-radius events (within 10 miles)
const EVENT_TEMPLATES = [
  { mood: "🤩", template: (name: string, venue: string) => `OMG ${name} at ${venue}!! Who else is going?! This is gonna be GOOD 🔥` },
  { mood: "🎉", template: (name: string, venue: string) => `${name} tonight at ${venue}! Finally something fun happening around here! Anyone need a plus one?` },
  { mood: "🤩", template: (name: string, venue: string) => `Just found out about ${name} at ${venue} - why didn't anyone tell me sooner?! Who's in?` },
  { mood: "🎉", template: (name: string, venue: string) => `${name} at ${venue}!! Been waiting for this all week. See y'all there! 🙌` },
];

// Out-of-radius events (10-50 miles) - include distance callout
const DISTANT_EVENT_TEMPLATES = [
  { mood: "🤩", template: (name: string, venue: string, distance: string) => `${name} at ${venue} (${distance} away) - might be worth the drive! Anyone going? 🚗` },
  { mood: "🎉", template: (name: string, venue: string, distance: string) => `Heads up: ${name} happening at ${venue}, about ${distance} from here. Road trip anyone?` },
  { mood: "🤩", template: (name: string, venue: string, distance: string) => `${name} at ${venue} is ${distance} away but looks amazing! Who's down to make the trip?` },
  { mood: "🎉", template: (name: string, venue: string, distance: string) => `If you don't mind the ${distance} drive, ${name} at ${venue} could be worth it! 🎶` },
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
    const isDistant = event.distanceMiles !== undefined &&
      event.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES;

    if (isDistant) {
      // Use distance-aware template for out-of-radius events
      const template = getRandomItem(DISTANT_EVENT_TEMPLATES);
      const distanceStr = formatDistance(event.distanceMiles!);
      posts.push({
        message: template.template(event.name, event.venue, distanceStr),
        mood: template.mood,
        tag: "Events",
      });
    } else {
      // Use regular template for in-radius events
      const template = getRandomItem(EVENT_TEMPLATES);
      posts.push({
        message: template.template(event.name, event.venue),
        mood: template.mood,
        tag: "Events",
      });
    }

    // Add second event if available and different
    if (uniqueEvents.length > 1) {
      const event2 = uniqueEvents[1];
      const isDistant2 = event2.distanceMiles !== undefined &&
        event2.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES;

      if (isDistant2) {
        const template2 = getRandomItem(DISTANT_EVENT_TEMPLATES);
        const distanceStr2 = formatDistance(event2.distanceMiles!);
        posts.push({
          message: template2.template(event2.name, event2.venue, distanceStr2),
          mood: template2.mood,
          tag: "Events",
        });
      } else {
        const template2 = getRandomItem(EVENT_TEMPLATES);
        posts.push({
          message: template2.template(event2.name, event2.venue),
          mood: template2.mood,
          tag: "Events",
        });
      }
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

    // Check if this city has intelligent bot configuration
    // If so, use the hyperlocal system with real road names
    const cityName = body.city.split(",")[0].trim();
    if (hasIntelligentBotConfig(cityName)) {
      console.log(`[Auto-Seed] City "${cityName}" has intelligent bot config - using hyperlocal system`);

      // Check for recent posts first
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: existingPulses } = await supabase
        .from("pulses")
        .select("id")
        .eq("city", body.city)
        .gte("created_at", fourHoursAgo)
        .limit(1);

      if (existingPulses && existingPulses.length > 0 && !body.force) {
        return NextResponse.json({
          success: true,
          message: "City already has recent pulses, skipping seed",
          created: 0,
          existingCount: existingPulses.length,
          pulses: [],
        });
      }

      // Use intelligent bot system (force=true since we already checked DB for recent posts)
      // Generate 4 varied posts (Traffic, Weather, Events x2) - no redundancy
      const result = await generateColdStartPosts(cityName, { count: 4, force: true });

      if (!result.success || result.posts.length === 0) {
        console.log(`[Auto-Seed] Intelligent bots returned no posts: ${result.reason}`);
        // Fall through to generic system below
      } else {
        // Insert intelligent bot posts with natural timing variation
        // Real users don't post at exact intervals - add organic randomness
        const now = Date.now();
        let cumulativeOffset = 0;

        const records = result.posts.map((post, index) => {
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

        console.log(`[Auto-Seed] SUCCESS! Created ${data.length} intelligent bot pulses for ${body.city}`);
        return NextResponse.json({
          success: true,
          created: data.length,
          pulses: data,
          mode: "intelligent",
          situationSummary: result.situationSummary,
        });
      }
    }

    // Check if city already has ANY pulses in the last 4 hours (user or bot)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: existingPulses, error: checkError } = await supabase
      .from("pulses")
      .select("id, is_bot, created_at")
      .eq("city", body.city)
      .gte("created_at", fourHoursAgo)
      .limit(5);

    if (checkError) {
      console.error("[Auto-Seed] Error checking existing pulses:", checkError);
    }

    console.log(`[Auto-Seed] Found ${existingPulses?.length || 0} existing pulses in last 4 hours`);

    if (existingPulses && existingPulses.length > 0 && !body.force) {
      console.log(`[Auto-Seed] Skipping - city has recent activity (use force=true to override)`);
      return NextResponse.json({
        success: true,
        message: "City already has recent pulses, skipping seed",
        created: 0,
        existingCount: existingPulses.length,
        pulses: [],
      });
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
  let events: EventData[] = [];
  if (lat && lon) {
    try {
      const eventsRes = await fetch(
        `${req.nextUrl.origin}/api/events/ticketmaster?lat=${lat}&lng=${lon}&radius=50`
      );
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        events = (eventsData.events || []).slice(0, 5).map((e: any) => ({
          name: e.name,
          venue: e.venue || "Local Venue",
          date: e.date,
          category: e.category,
        }));
        console.log(`[Auto-Seed GET] Found ${events.length} events via lat/lng for ${city}`);
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

  // Forward to POST handler with events and weather
  const response = await POST(
    new NextRequest(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, events, weather, force }),
    })
  );

  return response;
}
