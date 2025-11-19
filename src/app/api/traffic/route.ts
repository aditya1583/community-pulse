import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

// Very dumb but effective keyword buckets for MVP
const SEVERE_WORDS = [
  "accident",
  "crash",
  "standstill",
  "gridlock",
  "bumper to bumper",
  "dead stop",
  "blocked",
  "pileup",
  "wreck",
  "stalled",
  "shutdown",
  "lane closure",
];

const MODERATE_WORDS = [
  "slow",
  "slowing",
  "delay",
  "delays",
  "heavy",
  "backed up",
  "backed-up",
  "crowded",
  "busy",
  "congestion",
  "congested",
  "jam",
  "traffic jam",
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

function mapScoreToLevel(score: number, hasAnyTrafficPulses: boolean, hour: number) {
  // Fallback if literally no data
  if (!hasAnyTrafficPulses) {
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
    if (isRushHour) return "Moderate";
    if (hour >= 22 || hour <= 5) return "Light";
    return "Light";
  }

  if (score <= 2) return "Light";
  if (score <= 5) return "Moderate";
  return "Heavy";
}

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
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

    // Fetch recent "Traffic" pulses for this city
    const { data, error } = await supabase
      .from("pulses")
      .select("message, tag, created_at")
      .eq("city", city)
      .eq("tag", "Traffic")
      .gte("created_at", threeHoursAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching traffic pulses:", error);
      return NextResponse.json(
        { error: "Failed to fetch pulses" },
        { status: 500 }
      );
    }

    const pulses = data || [];
    const hour = getLocalHourInChicago();

    let score = 0;
    const loweredMessages = pulses.map((p) => (p.message || "").toLowerCase());

    for (const msg of loweredMessages) {
      // base weight per pulse
      score += 0.5;

      if (SEVERE_WORDS.some((w) => msg.includes(w))) {
        score += 2;
      } else if (MODERATE_WORDS.some((w) => msg.includes(w))) {
        score += 1;
      }
    }

    // Time-of-day adjustment (rush hours)
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
    const isLateNight = hour >= 22 || hour <= 5;

    if (isRushHour) score += 1;
    if (isLateNight) score -= 1;

    const level = mapScoreToLevel(score, pulses.length > 0, hour);

    return NextResponse.json({
      level,      // "Light" | "Moderate" | "Heavy"
      score,      // for debugging if you want
      pulseCount: pulses.length,
      hour,
    });
  } catch (e) {
    console.error("Unexpected error in /api/traffic:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
