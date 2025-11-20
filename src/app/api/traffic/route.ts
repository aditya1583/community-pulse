import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Heuristic fallback (if AI fails) ----------

const SEVERE_WORDS = [
  "stuck in traffic",
  "stuck in a traffic",
  "stuck in jam",
  "standstill",
  "stand still",
  "gridlock",
  "bumper to bumper",
  "bumper-to-bumper",
  "dead stop",
  "not moving",
  "completely stopped",
  "sitting in traffic",
  "horrible traffic",
  "terrible traffic",
  "awful traffic",
  "insane traffic",
  "crazy traffic",
  "worst traffic",
];

const MODERATE_WORDS = [
  "bad traffic",
  "heavy traffic",
  "traffic is bad",
  "traffic is not good",
  "traffic is slow",
  "slow traffic",
  "sluggish traffic",
  "backed up",
  "backed-up",
  "congestion",
  "congested",
  "delays",
  "delay",
  "busy roads",
  "busy street",
];

const LOW_WORDS = [
  "no traffic",
  "0 traffic",
  "zero traffic",
  "little traffic",
  "light traffic",
  "empty roads",
  "roads are empty",
  "smooth commute",
  "smooth traffic",
  "traffic is fine",
  "not much traffic",
  "normal traffic",
  "so normal and pleasure to drive",
];

function getLocalHourInChicago() {
  const now = new Date();
  const hourStr = now.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  });
  return Number(hourStr);
}

function heuristicTrafficLevel(messages: string[]): {
  level: "Light" | "Moderate" | "Heavy";
  score: number;
} {
  let score = 0;

  for (const raw of messages) {
    const msg = raw.toLowerCase();
    if (!msg.trim()) continue;

    let delta = 0;
    if (SEVERE_WORDS.some((w) => msg.includes(w))) delta += 4;
    else if (MODERATE_WORDS.some((w) => msg.includes(w))) delta += 2;
    else if (LOW_WORDS.some((w) => msg.includes(w))) delta -= 3;

    // generic mention of traffic nudges score a bit if not clearly low
    if (msg.includes("traffic") && delta === 0) delta += 1;

    score += delta;
  }

  const hour = getLocalHourInChicago();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
  const isLateNight = hour >= 22 || hour <= 5;

  if (isRushHour) score += 1;
  if (isLateNight) score -= 1;

  let level: "Light" | "Moderate" | "Heavy";
  if (score >= 5) level = "Heavy";
  else if (score >= 2) level = "Moderate";
  else level = "Light";

  return { level, score };
}

// ---------- AI helper ----------

async function aiTrafficLevel(params: {
  city: string;
  hour: number;
  messages: { created_at: string; message: string }[];
}): Promise<"Light" | "Moderate" | "Heavy"> {
  const { city, hour, messages } = params;

  // newest first already from query; take a small recent slice as “most recent”
  const mostRecent = messages.slice(0, 5);
  const recentBlock =
    mostRecent.length === 0
      ? "No recent pulses."
      : mostRecent
          .map(
            (m, idx) =>
              `${idx + 1}. [MOST RECENT] ${m.created_at}: ${m.message.replace(
                /\s+/g,
                " "
              )}`
          )
          .join("\n");

  const allBlock =
    messages.length === 0
      ? "No pulses in the last 60 minutes."
      : messages
          .map(
            (m, idx) =>
              `${idx + 1}. ${m.created_at}: ${m.message.replace(/\s+/g, " ")}`
          )
          .join("\n");

  const userContent = `
You are classifying CITY TRAFFIC LEVEL.

City: ${city}
Current hour (0-23): ${hour}

Most recent pulses (newest first, strongly prioritize these when deciding):
${recentBlock}

All pulses in the last 60 minutes (context only):
${allBlock}

Task:
- Decide the current overall traffic level RIGHT NOW: one of "Light", "Moderate", or "Heavy".
- The MOST RECENT 3–5 messages should dominate your decision.
  - If the last few messages say things like "no traffic", "0 traffic", "roads are empty", "smooth drive", or "traffic is normal",
    you MUST choose "Light", even if older messages complained about bad traffic.
  - If the last few messages describe being stuck, gridlock, standstill, or very slow traffic, choose "Heavy".
  - If it's a mix without a clear trend, choose "Moderate".
- Ignore non-traffic content when making the decision.

Return ONLY a JSON object like:
{"level":"Light"}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precise traffic classifier that outputs strict JSON with one key: level.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty AI response for traffic");

  const parsed = JSON.parse(raw) as { level?: string };

  const level = (parsed.level || "").trim();
  if (level === "Light" || level === "Moderate" || level === "Heavy") {
    return level;
  }
  throw new Error(`Invalid level from AI: ${parsed.level}`);
}

// ---------- Route handler ----------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { error: "Missing city parameter" },
      { status: 400 }
    );
  }

  try {
    const now = new Date();
    // SHORTER WINDOW: last 60 minutes only
    const sixtyMinutesAgo = new Date(
      now.getTime() - 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("pulses")
      .select("message, created_at")
      .eq("city", city)
      .gte("created_at", sixtyMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("Error fetching pulses for traffic:", error);
      return NextResponse.json(
        { error: "Failed to fetch pulses" },
        { status: 500 }
      );
    }

    const messages = (data || []) as { message: string; created_at: string }[];
    const hour = getLocalHourInChicago();

    // Try AI first
    try {
      const aiLevel = await aiTrafficLevel({ city, hour, messages });
      return NextResponse.json({
        level: aiLevel,
        source: "ai",
        pulseCount: messages.length,
      });
    } catch (aiErr) {
      console.warn("AI traffic classification failed, falling back:", aiErr);
    }

    // Fallback: heuristic
    const heuristic = heuristicTrafficLevel(messages.map((m) => m.message));
    return NextResponse.json({
      level: heuristic.level,
      source: "heuristic",
      score: heuristic.score,
      pulseCount: messages.length,
    });
  } catch (e) {
    console.error("Unexpected error in /api/traffic:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
