import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin Seed Pulse API
 *
 * Creates bot-generated pulses to seed content during cold start.
 * Bot pulses are marked with is_bot=true and author="Community Bot"
 *
 * Security: Requires ADMIN_SECRET header to prevent abuse
 *
 * Usage:
 * POST /api/admin/seed-pulse
 * Headers: { "x-admin-secret": "your-secret" }
 * Body: {
 *   city: "Leander, Texas, US",
 *   message: "School zone lights are flashing on 183A",
 *   tag: "Traffic",
 *   mood: "🚗"
 * }
 *
 * Or batch mode:
 * Body: {
 *   pulses: [
 *     { city: "...", message: "...", tag: "...", mood: "..." },
 *     { city: "...", message: "...", tag: "...", mood: "..." }
 *   ]
 * }
 */

const BOT_AUTHOR = "Community Bot";
const BOT_USER_ID = "bot-system-001"; // Fixed ID for the bot

// Valid tags and moods
const VALID_TAGS = ["Traffic", "Weather", "Events", "General"];
const VALID_MOODS = ["😊", "😌", "😤", "🏃", "🛑", "😢", "😡", "😴", "🤩", "🎉", "🤔", "😅", "☀️", "🏠", "🥵", "🥶", "😐"];

type SeedPulseInput = {
  city: string;
  message: string;
  tag: string;
  mood: string;
};

type RequestBody = SeedPulseInput | { pulses: SeedPulseInput[] };

function validatePulse(pulse: SeedPulseInput): string | null {
  if (!pulse.city || pulse.city.trim().length < 2) {
    return "City is required";
  }
  if (!pulse.message || pulse.message.trim().length < 3) {
    return "Message must be at least 3 characters";
  }
  if (pulse.message.length > 240) {
    return "Message must be 240 characters or less";
  }
  if (!VALID_TAGS.includes(pulse.tag)) {
    return `Invalid tag. Must be one of: ${VALID_TAGS.join(", ")}`;
  }
  if (!VALID_MOODS.includes(pulse.mood)) {
    return `Invalid mood. Must be one of: ${VALID_MOODS.join(", ")}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Verify admin secret
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers.get("x-admin-secret");

  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin functionality not configured" },
      { status: 500 }
    );
  }

  if (providedSecret !== adminSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

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
    const body: RequestBody = await req.json();

    // Determine if single pulse or batch
    const pulsesToCreate: SeedPulseInput[] = "pulses" in body
      ? body.pulses
      : [body as SeedPulseInput];

    if (pulsesToCreate.length === 0) {
      return NextResponse.json(
        { error: "No pulses provided" },
        { status: 400 }
      );
    }

    if (pulsesToCreate.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 pulses per request" },
        { status: 400 }
      );
    }

    // Validate all pulses
    for (let i = 0; i < pulsesToCreate.length; i++) {
      const validationError = validatePulse(pulsesToCreate[i]);
      if (validationError) {
        return NextResponse.json(
          { error: `Pulse ${i + 1}: ${validationError}` },
          { status: 400 }
        );
      }
    }

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Build insert records
    const records = pulsesToCreate.map((p) => ({
      city: p.city.trim(),
      message: p.message.trim(),
      tag: p.tag,
      mood: p.mood,
      author: BOT_AUTHOR,
      user_id: BOT_USER_ID,
      is_bot: true,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    }));

    // Insert into database
    const { data, error } = await supabase
      .from("pulses")
      .insert(records)
      .select("id, city, message, tag, mood, created_at");

    if (error) {
      console.error("Error inserting bot pulses:", error);
      return NextResponse.json(
        { error: "Failed to create pulses" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: data.length,
      pulses: data,
    });

  } catch (err) {
    console.error("Error in seed-pulse:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * GET endpoint for health check / info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/seed-pulse",
    method: "POST",
    description: "Create bot-generated pulses for content seeding",
    requiredHeaders: {
      "x-admin-secret": "Your ADMIN_SECRET env variable",
    },
    singlePulse: {
      city: "Leander, Texas, US",
      message: "School zone lights are flashing on 183A",
      tag: "Traffic",
      mood: "🚗",
    },
    batchMode: {
      pulses: [
        { city: "...", message: "...", tag: "Traffic", mood: "😤" },
        { city: "...", message: "...", tag: "Events", mood: "🎉" },
      ],
    },
    validTags: VALID_TAGS,
    validMoods: VALID_MOODS,
  });
}
