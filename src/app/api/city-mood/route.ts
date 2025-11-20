import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

type MoodScore = {
  mood: string;
  count: number;
  percent: number;
};

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

    // Fetch recent pulses for this city
    const { data, error } = await supabase
      .from("pulses")
      .select("mood, created_at")
      .eq("city", city)
      .gte("created_at", threeHoursAgo);

    if (error) {
      console.error("Error fetching pulses for city mood:", error);
      return NextResponse.json(
        { error: "Failed to fetch pulses" },
        { status: 500 }
      );
    }

    const pulses = data || [];

    if (pulses.length === 0) {
      return NextResponse.json({
        dominantMood: null,
        scores: [],
        pulseCount: 0,
        windowHours: 3,
      });
    }

    // Count moods
    const counts: Record<string, number> = {};
    for (const p of pulses) {
      const mood = p.mood || "unknown";
      counts[mood] = (counts[mood] || 0) + 1;
    }

    const total = pulses.length;
    const scores: MoodScore[] = Object.entries(counts)
      .map(([mood, count]) => ({
        mood,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const dominantMood = scores[0]?.mood ?? null;

    return NextResponse.json({
      dominantMood,
      scores,
      pulseCount: total,
      windowHours: 3,
    });
  } catch (e) {
    console.error("Unexpected error in /api/city-mood:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
