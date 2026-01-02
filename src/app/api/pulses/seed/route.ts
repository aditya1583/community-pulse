import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Pulse Seeding Bot API
 *
 * Generates realistic pulses for cities with no recent activity
 * Solves the cold-start problem by showing activity even before users arrive
 *
 * Bot pulses are marked with is_bot=true for transparency
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Pulse templates by category - realistic, location-aware content
const PULSE_TEMPLATES = {
  Traffic: [
    { mood: "😌", messages: [
      "Roads are looking clear this {timeOfDay}!",
      "Smooth sailing on the main roads today",
      "No traffic issues to report right now",
      "Easy commute through downtown today",
    ]},
    { mood: "😤", messages: [
      "Getting a bit congested near the highway exit",
      "Slow going on the main drag this {timeOfDay}",
      "Construction causing some delays today",
      "Rush hour traffic building up as usual",
    ]},
    { mood: "🛑", messages: [
      "Major backup near downtown - avoid if you can",
      "Accident reported on the highway, expect delays",
    ]},
  ],
  Weather: [
    { mood: "☀️", messages: [
      "Beautiful day out here in {city}!",
      "Perfect weather for a walk today",
      "Gorgeous {timeOfDay} - get outside if you can!",
      "Sunny skies making everyone smile today",
    ]},
    { mood: "🏠", messages: [
      "Good day to stay cozy indoors",
      "A bit dreary but cozy vibes",
      "Perfect weather for a coffee shop day",
    ]},
    { mood: "🥵", messages: [
      "It's HOT out there - stay hydrated!",
      "Scorcher of a day in {city}",
    ]},
    { mood: "🥶", messages: [
      "Bundle up if you're heading out!",
      "Definitely a hot coffee kind of day",
    ]},
  ],
  Events: [
    { mood: "🎉", messages: [
      "Heard there's live music downtown tonight!",
      "Looks like something fun happening at the park",
      "Festival vibes in {city} this weekend",
      "Great turnout at the local market today",
    ]},
    { mood: "🤔", messages: [
      "Anyone know what's going on downtown?",
      "Saw a crowd gathering - must be an event",
    ]},
  ],
  General: [
    { mood: "😌", messages: [
      "Chill vibes in {city} today",
      "Peaceful {timeOfDay} in the neighborhood",
      "Quiet day around here - just how I like it",
      "Good energy in {city} today",
      "Everyone seems in a good mood today",
    ]},
    { mood: "😊", messages: [
      "Love this community! Great day in {city}",
      "Friendly faces everywhere today",
      "What a beautiful day to be in {city}",
    ]},
    { mood: "🎉", messages: [
      "Energy is high in {city} today!",
      "Busy but good vibes all around",
      "Lots happening around town!",
    ]},
    { mood: "😴", messages: [
      "Slow {timeOfDay} in {city}",
      "Pretty quiet around here today",
    ]},
  ],
};

// Bot usernames - fun anonymous names
const BOT_USERNAMES = [
  "Local Scout", "Neighborhood Watcher", "City Pulse", "Area Reporter",
  "Street Observer", "Community Eye", "Local Insider", "Town Spotter",
];

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePulseContent(city: string, category: keyof typeof PULSE_TEMPLATES): {
  message: string;
  mood: string;
} {
  const templates = PULSE_TEMPLATES[category];
  const template = getRandomElement(templates);
  const message = getRandomElement(template.messages)
    .replace("{city}", city)
    .replace("{timeOfDay}", getTimeOfDay());

  return {
    message,
    mood: template.mood,
  };
}

// Calculate expiry based on category
function getExpiryTime(category: string): string {
  const hours: Record<string, number> = {
    Traffic: 2,
    Weather: 4,
    Events: 24,
    General: 24,
  };
  const hoursToAdd = hours[category] || 24;
  return new Date(Date.now() + hoursToAdd * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  // Verify this is an authorized request (cron job or admin)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { city, neighborhood, count = 3 } = body;

    if (!city) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if city already has recent pulses (last 4 hours)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: existingPulses } = await supabase
      .from("pulses")
      .select("id")
      .eq("city", city)
      .gte("created_at", fourHoursAgo)
      .limit(1);

    if (existingPulses && existingPulses.length > 0) {
      return NextResponse.json({
        message: "City already has recent activity",
        seeded: 0,
      });
    }

    // Generate pulses for different categories
    const categories: (keyof typeof PULSE_TEMPLATES)[] = ["General", "Traffic", "Weather"];
    const pulsesToCreate = Math.min(count, 5); // Max 5 pulses at a time
    const createdPulses = [];

    for (let i = 0; i < pulsesToCreate; i++) {
      const category = categories[i % categories.length];
      const { message, mood } = generatePulseContent(city, category);
      const username = getRandomElement(BOT_USERNAMES);

      // Stagger creation times slightly (0-30 mins ago)
      const createdAt = new Date(Date.now() - Math.random() * 30 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("pulses")
        .insert({
          city,
          neighborhood: neighborhood || null,
          mood,
          tag: category,
          message,
          author: username,
          is_bot: true,
          created_at: createdAt,
          expires_at: getExpiryTime(category),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating bot pulse:", error);
      } else if (data) {
        createdPulses.push(data);
      }
    }

    return NextResponse.json({
      message: `Seeded ${createdPulses.length} pulses for ${city}`,
      seeded: createdPulses.length,
      pulses: createdPulses,
    });

  } catch (error) {
    console.error("Pulse seeding error:", error);
    return NextResponse.json(
      { error: "Failed to seed pulses" },
      { status: 500 }
    );
  }
}

// GET endpoint to check seeding status for a city
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json({ error: "City parameter required" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check recent pulse activity
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const { data: pulses, error } = await supabase
    .from("pulses")
    .select("id, is_bot, created_at")
    .eq("city", city)
    .gte("created_at", fourHoursAgo);

  if (error) {
    console.error("Error checking pulses:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const totalPulses = pulses?.length || 0;
  const botPulses = pulses?.filter(p => p.is_bot).length || 0;
  const userPulses = totalPulses - botPulses;

  return NextResponse.json({
    city,
    totalPulses,
    userPulses,
    botPulses,
    needsSeeding: totalPulses === 0,
  });
}
