import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

type MoodScore = {
  mood: string;
  count: number;
  percent: number;
};

type TagScore = {
  tag: string;
  count: number;
  percent: number;
};

/**
 * City Vibe Analysis - ENHANCED
 *
 * This API analyzes ALL available city data to determine the vibe:
 * - User pulses (emotional state from community)
 * - Events count (activity level)
 * - Traffic level (commute mood)
 * - Weather (environmental context)
 *
 * The key insight: A city is NOT quiet just because there are no pulses.
 * If there are 20 events happening and traffic is flowing, the city is ACTIVE.
 *
 * We create BUZZ from all available data sources.
 * "Quiet" is the LAST resort when we truly have nothing.
 *
 * The "gossip factor": users should wonder "Why is my city frustrated?"
 */

// Additional context passed from the client
type CityContext = {
  eventsCount?: number;
  trafficLevel?: "Light" | "Moderate" | "Heavy" | null;
  weatherCondition?: string | null;
  newsCount?: number;
};

// Maps mood emojis to emotion labels for headline generation
const MOOD_TO_EMOTION: Record<string, string> = {
  // Traffic moods
  "😤": "Frustrated",
  "🏃": "Rushed",
  "😌": "Chill",
  "🛑": "Stuck",
  // Weather moods
  "☀️": "Blessed",
  "🏠": "Cozy",
  "🥵": "Overheated",
  "🥶": "Freezing",
  // Events moods
  "🎉": "Excited",
  "🤔": "Curious",
  "😅": "Busy",
  // General moods
  "😊": "Happy",
  "😐": "Neutral",
  "😢": "Down",
  "😡": "Angry",
  "😴": "Sleepy",
  "🤩": "Thrilled",
};

// Maps traffic levels to emotions
const TRAFFIC_TO_EMOTION: Record<string, { emotion: string; emoji: string }> = {
  Light: { emotion: "flowing", emoji: "🚗" },
  Moderate: { emotion: "busy", emoji: "🚙" },
  Heavy: { emotion: "congested", emoji: "🚦" },
};

/**
 * Determines city "vibe intensity" based on ALL activity sources
 *
 * This is the key change: we now consider events, traffic, and weather
 * in addition to pulse count. A city with 20 events is NOT quiet!
 */
function calculateVibeIntensity(
  pulseCount: number,
  dominantPercent: number,
  windowHours: number,
  context: CityContext
): "quiet" | "active" | "buzzing" | "intense" {
  const pulsesPerHour = pulseCount / windowHours;
  const eventsCount = context.eventsCount ?? 0;
  const trafficLevel = context.trafficLevel;

  // Calculate an "activity score" from all sources
  let activityScore = 0;

  // Pulses contribute to activity
  activityScore += pulsesPerHour * 2;

  // Events are a major activity signal
  if (eventsCount >= 20) activityScore += 4;
  else if (eventsCount >= 10) activityScore += 3;
  else if (eventsCount >= 5) activityScore += 2;
  else if (eventsCount >= 1) activityScore += 1;

  // Traffic indicates life in the city
  if (trafficLevel === "Heavy") activityScore += 2;
  else if (trafficLevel === "Moderate") activityScore += 1.5;
  else if (trafficLevel === "Light") activityScore += 1;

  // News indicates noteworthy happenings
  if ((context.newsCount ?? 0) > 0) activityScore += 0.5;

  // Determine intensity from activity score
  if (activityScore >= 6) return "intense";
  if (activityScore >= 4) return "buzzing";
  if (activityScore >= 1) return "active";

  // Truly quiet - no data at all
  return "quiet";
}

/**
 * Generates a compelling headline based on ALL city activity
 *
 * Priority order for headline generation:
 * 1. If we have pulses with strong mood signal -> use pulse emotion
 * 2. If we have events -> highlight event activity
 * 3. If we have traffic data -> mention traffic flow
 * 4. If we have weather -> use weather as fallback
 * 5. Only say "quiet" if we truly have NOTHING
 */
function generateVibeHeadline(
  cityName: string,
  dominantMood: string | null,
  dominantMoodPercent: number,
  dominantTag: string | null,
  dominantTagPercent: number,
  pulseCount: number,
  intensity: "quiet" | "active" | "buzzing" | "intense",
  context: CityContext
): { headline: string; subtext: string; emotion: string } {
  const shortCityName = cityName.split(",")[0].trim();
  const eventsCount = context.eventsCount ?? 0;
  const trafficLevel = context.trafficLevel;
  const weatherCondition = context.weatherCondition;

  // === PULSE-BASED HEADLINES (highest priority when we have strong signal) ===

  // Strong pulse signal (70%+ concentration) - this IS the city's mood
  if (pulseCount > 0 && dominantMoodPercent >= 70 && dominantMood) {
    const emotion = MOOD_TO_EMOTION[dominantMood] || "Mixed";
    const tagContext = dominantTag && dominantTagPercent >= 50
      ? ` about ${dominantTag}`
      : "";

    return {
      headline: `${shortCityName} is ${emotion}`,
      subtext: dominantTagPercent >= 50
        ? `${dominantMoodPercent}% of pulses are${tagContext}`
        : `${pulseCount} ${pulseCount === 1 ? "pulse" : "pulses"} in the last 3 hours`,
      emotion: emotion.toLowerCase(),
    };
  }

  // Moderate pulse signal (50-70%) with good volume
  if (pulseCount >= 3 && dominantMoodPercent >= 50 && dominantMood) {
    const emotion = MOOD_TO_EMOTION[dominantMood] || "Mixed";
    return {
      headline: `${shortCityName} is feeling ${emotion.toLowerCase()}`,
      subtext: `${pulseCount} ${pulseCount === 1 ? "thing" : "things"} happening right now`,
      emotion: emotion.toLowerCase(),
    };
  }

  // === ACTIVITY-BASED HEADLINES (when we have city data but few/no pulses) ===

  // Intense activity from any source
  if (intensity === "intense") {
    if (eventsCount >= 15) {
      return {
        headline: `${shortCityName} is buzzing`,
        subtext: `${eventsCount} events happening today`,
        emotion: "excited",
      };
    }
    if (trafficLevel === "Heavy") {
      return {
        headline: `${shortCityName} is on the move`,
        subtext: `Heavy traffic and ${eventsCount > 0 ? `${eventsCount} events` : "lots of activity"}`,
        emotion: "busy",
      };
    }
  }

  // High activity - events are the main driver
  if (intensity === "buzzing" || eventsCount >= 10) {
    const trafficNote = trafficLevel ? ` | Traffic: ${trafficLevel}` : "";
    return {
      headline: `${eventsCount} things happening in ${shortCityName}`,
      subtext: pulseCount > 0
        ? `${pulseCount} pulses from neighbors${trafficNote}`
        : `Check out what's going on${trafficNote}`,
      emotion: "active",
    };
  }

  // Moderate activity - mix of signals
  if (intensity === "active") {
    // Events as primary signal
    if (eventsCount >= 5) {
      return {
        headline: `${shortCityName} has ${eventsCount} events today`,
        subtext: trafficLevel
          ? `Traffic is ${trafficLevel.toLowerCase()}`
          : "See what's happening nearby",
        emotion: "active",
      };
    }

    // Traffic as primary signal
    if (trafficLevel) {
      const trafficInfo = TRAFFIC_TO_EMOTION[trafficLevel];
      if (trafficLevel === "Light") {
        return {
          headline: `${shortCityName} is flowing smoothly`,
          subtext: eventsCount > 0
            ? `${eventsCount} events happening today`
            : weatherCondition || "Roads are clear",
          emotion: "chill",
        };
      }
      if (trafficLevel === "Moderate" || trafficLevel === "Heavy") {
        return {
          headline: `${shortCityName} is ${trafficInfo.emotion}`,
          subtext: eventsCount > 0
            ? `${eventsCount} events and ${trafficLevel.toLowerCase()} traffic`
            : `Traffic is ${trafficLevel.toLowerCase()} right now`,
          emotion: trafficLevel === "Heavy" ? "busy" : "active",
        };
      }
    }

    // Weather as fallback for active state
    if (weatherCondition) {
      return {
        headline: `${shortCityName} today: ${weatherCondition}`,
        subtext: eventsCount > 0
          ? `${eventsCount} events happening`
          : "Share what's happening around you",
        emotion: "active",
      };
    }
  }

  // === LOW ACTIVITY HEADLINES ===

  // Some pulses but no strong signal
  if (pulseCount > 0) {
    return {
      headline: `${pulseCount} ${pulseCount === 1 ? "thing" : "things"} happening in ${shortCityName}`,
      subtext: "See what your neighbors are saying",
      emotion: "active",
    };
  }

  // We have SOME data but no pulses - don't say "quiet"!
  if (eventsCount > 0 || trafficLevel) {
    const parts: string[] = [];
    if (trafficLevel) parts.push(`Traffic: ${trafficLevel}`);
    if (eventsCount > 0) parts.push(`${eventsCount} event${eventsCount === 1 ? "" : "s"}`);

    return {
      headline: `${shortCityName} is waking up`,
      subtext: parts.length > 0 ? parts.join(" | ") : "Be the first to share the vibe",
      emotion: "active",
    };
  }

  // Weather as last resort before "quiet"
  if (weatherCondition) {
    return {
      headline: `${weatherCondition} in ${shortCityName}`,
      subtext: "Be the first to share the vibe",
      emotion: "neutral",
    };
  }

  // TRUE quiet - we really have nothing
  return {
    headline: `${shortCityName} is quiet right now`,
    subtext: "Be the first to set the vibe",
    emotion: "quiet",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  // NEW: Accept context parameters for holistic vibe calculation
  const eventsCountParam = searchParams.get("eventsCount");
  const trafficLevelParam = searchParams.get("trafficLevel");
  const weatherConditionParam = searchParams.get("weatherCondition");
  const newsCountParam = searchParams.get("newsCount");

  // Build context object from query params
  const context: CityContext = {
    eventsCount: eventsCountParam ? parseInt(eventsCountParam, 10) : undefined,
    trafficLevel: (trafficLevelParam as CityContext["trafficLevel"]) || undefined,
    weatherCondition: weatherConditionParam || undefined,
    newsCount: newsCountParam ? parseInt(newsCountParam, 10) : undefined,
  };

  if (!city) {
    return NextResponse.json(
      { error: "Missing city parameter" },
      { status: 400 }
    );
  }

  try {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

    // Fetch recent pulses with mood AND tag for richer analysis
    const { data, error } = await supabase
      .from("pulses")
      .select("mood, tag, created_at")
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
    const windowHours = 3;

    // Even with no pulses, calculate intensity from other sources
    const intensityWithContext = calculateVibeIntensity(0, 0, windowHours, context);

    if (pulses.length === 0) {
      // ENHANCED: Generate headline using ALL available context, not just pulses
      const { headline, subtext, emotion } = generateVibeHeadline(
        city, null, 0, null, 0, 0, intensityWithContext, context
      );

      return NextResponse.json({
        dominantMood: null,
        scores: [],
        pulseCount: 0,
        windowHours,
        // New vibe fields
        tagScores: [],
        dominantTag: null,
        vibeHeadline: headline,
        vibeSubtext: subtext,
        vibeEmotion: emotion,
        vibeIntensity: intensityWithContext,
      });
    }

    // Count moods
    const moodCounts: Record<string, number> = {};
    for (const p of pulses) {
      const mood = p.mood || "unknown";
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }

    const total = pulses.length;
    const scores: MoodScore[] = Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const dominantMood = scores[0]?.mood ?? null;
    const dominantMoodPercent = scores[0]?.percent ?? 0;

    // Count tags/categories
    const tagCounts: Record<string, number> = {};
    for (const p of pulses) {
      const tag = p.tag || "General";
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    const tagScores: TagScore[] = Object.entries(tagCounts)
      .map(([tag, count]) => ({
        tag,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const dominantTag = tagScores[0]?.tag ?? null;
    const dominantTagPercent = tagScores[0]?.percent ?? 0;

    // Calculate vibe intensity using ALL sources
    const intensity = calculateVibeIntensity(total, dominantMoodPercent, windowHours, context);

    // Generate compelling headline using ALL context
    const { headline, subtext, emotion } = generateVibeHeadline(
      city,
      dominantMood,
      dominantMoodPercent,
      dominantTag,
      dominantTagPercent,
      total,
      intensity,
      context
    );

    return NextResponse.json({
      dominantMood,
      scores,
      pulseCount: total,
      windowHours,
      // New vibe fields for the gossip factor
      tagScores,
      dominantTag,
      vibeHeadline: headline,
      vibeSubtext: subtext,
      vibeEmotion: emotion,
      vibeIntensity: intensity,
    });
  } catch (e) {
    console.error("Unexpected error in /api/city-mood:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
