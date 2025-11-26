import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

type MoodCounts = Record<string, number>;

type ForecastResult = {
  label: string;
  icon: string;
  headline: string;
  detail: string;
  dominantMood: string | null;
};

const WINDOW_HOURS = 3;

function chooseForecast(counts: MoodCounts, total: number): ForecastResult {
  const share = (mood: string) => (counts[mood] || 0) / total;

  const hypeRatio = share("🤩");
  const tenseRatio = share("😡");
  const sadRatio = share("😢");
  const chillRatio = share("😴");
  const happyRatio = share("😊");
  const neutralRatio = share("😐");

  const weightedScore =
    hypeRatio * 2 +
    happyRatio * 1 +
    chillRatio * 0.8 -
    tenseRatio * 1.2 -
    sadRatio * 0.8;

  if (hypeRatio >= 0.35 && weightedScore > 0) {
    return {
      label: "party",
      icon: "🎉",
      headline: "Party vibes incoming",
      detail: "Lots of excited pulses with hype emojis in the last few hours.",
      dominantMood: "🤩",
    };
  }

  if (tenseRatio + sadRatio >= 0.45) {
    return {
      label: "tense",
      icon: "⚠️",
      headline: "Tense stretch ahead",
      detail: "Complaints and frustration are dominating recent check-ins.",
      dominantMood: tenseRatio >= sadRatio ? "😡" : "😢",
    };
  }

  if (chillRatio >= 0.25 && weightedScore >= 0) {
    return {
      label: "chill",
      icon: "🌙",
      headline: "Chill mood on deck",
      detail: "Plenty of sleepy or relaxed pulses; things look calm for now.",
      dominantMood: "😴",
    };
  }

  if (weightedScore > 0.35 || happyRatio + neutralRatio >= 0.55) {
    return {
      label: "busy",
      icon: "🚦",
      headline: "Busy but steady",
      detail: "Activity is up but the tone stays mostly neutral or upbeat.",
      dominantMood: happyRatio >= neutralRatio ? "😊" : "😐",
    };
  }

  return {
    label: "steady",
    icon: "🌤️",
    headline: "Steady vibes",
    detail: "Mixed moods without a clear swing — expect a balanced stretch.",
    dominantMood: null,
  };
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
    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("pulses")
      .select("mood")
      .eq("city", city)
      .gte("created_at", since);

    if (error) {
      console.error("Error fetching pulses for mood forecast:", error);
      return NextResponse.json(
        { error: "Failed to fetch pulses" },
        { status: 500 }
      );
    }

    const pulses = data || [];

    if (pulses.length === 0) {
      return NextResponse.json({
        forecast: null,
        totalPulses: 0,
        windowHours: WINDOW_HOURS,
      });
    }

    const counts: MoodCounts = {};
    for (const row of pulses) {
      const mood = row.mood || "unknown";
      counts[mood] = (counts[mood] || 0) + 1;
    }

    const forecast = chooseForecast(counts, pulses.length);

    return NextResponse.json({
      forecast,
      totalPulses: pulses.length,
      windowHours: WINDOW_HOURS,
    });
  } catch (err) {
    console.error("Unexpected error in /api/mood-forecast:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
