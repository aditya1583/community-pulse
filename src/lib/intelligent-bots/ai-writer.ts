/**
 * AI-powered post writer using GPT-4o-mini.
 * Takes real data (weather, traffic, events) and writes posts
 * that sound like a witty local friend, not a data dump.
 */

import OpenAI from "openai";
import type { SituationContext, PostDecision, PostType } from "./types";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

const SYSTEM_PROMPT = `You are "Voxlo AI," the voice of a hyperlocal community app. You write short posts about what's happening RIGHT NOW in a specific city.

VOICE & TONE:
- Sound like a fun, informed neighbor — not a weather robot or news anchor
- Witty, occasionally sarcastic, always warm
- Use local references when you can (nearby landmarks, roads, vibes)
- Think: if a cool friend texted you about local stuff, how would it sound?

RULES:
- MAX 180 characters. Brevity is king.
- ONE post = ONE fact or observation. Don't cram multiple data points.
- Every post MUST be grounded in the real data provided. No making stuff up.
- No hashtags, no "Hey everyone!", no "Did you know?"
- No engagement bait, polls, or questions asking people to share
- Include exactly ONE relevant emoji at the start
- End with a newline and data attribution: "📡 Data: {source} • {day} {time}"
- Use casual time like "Thu 6:30 PM" not ISO timestamps
- Be DIFFERENT every time. If the last post was straightforward, make the next one funny.

EXAMPLES OF GOOD POSTS:
"🌧️ Rain hitting Cedar Park — if you left your windows down, this is your sign. 72°F and dropping."
"🚗 MoPac is a parking lot right now. 11 mph near The Domain. Take Burnet instead."
"🎵 Dirty Dozen Brass Band at Antone's tomorrow night. Mardi Gras energy without the flight to NOLA."
"☀️ 85°F and clear — perfect patio weather. UV's low, go enjoy it before summer tries to kill us."
"🥵 108°F heat index. Your car's steering wheel is now a weapon. Stay hydrated out there."
"❄️ 28°F in Austin. Yes, we're panicking. No, H-E-B is not out of bread yet."

EXAMPLES OF BAD POSTS (don't do these):
"🚗 6th Street: 9 mph near The Domain." (boring data dump)
"🌡️ Forecast: Tomorrow — rain, high 85°F, low 64°F." (robotic)
"📅 Feb 21: LOVB Austin v LOVB Madison at H-E-B Center." (calendar entry)`;

interface DataPayload {
  city: string;
  state?: string;
  postType: PostType;
  category: string;
  weather?: {
    temp?: number;
    feelsLike?: number;
    condition?: string;
    humidity?: number;
    uvIndex?: number;
    forecastHigh?: number;
    forecastLow?: number;
    forecastCondition?: string;
  };
  traffic?: {
    congestion?: number;
    speed?: number;
    road?: string;
    landmark?: string;
    altRoute?: string;
    incidents?: string[];
  };
  event?: {
    name?: string;
    venue?: string;
    date?: string;
    genre?: string;
  };
  timeOfDay: string;
  dayOfWeek: string;
  recentPosts?: string[]; // last 3 posts to avoid repetition
}

function buildDataPayload(ctx: SituationContext, decision: PostDecision): DataPayload {
  const now = ctx.timestamp;
  const hour = now.getHours();
  const timeOfDay = hour < 6 ? "late night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const payload: DataPayload = {
    city: ctx.city.name,
    state: ctx.city.state,
    postType: decision.postType!,
    category: decision.templateCategory,
    timeOfDay,
    dayOfWeek: days[now.getDay()],
  };

  if (ctx.weather) {
    payload.weather = {
      temp: ctx.weather.current?.temp,
      feelsLike: ctx.weather.current?.feelsLike,
      condition: ctx.weather.current?.condition,
      humidity: ctx.weather.current?.humidity,
      uvIndex: ctx.weather.current?.uvIndex,
      forecastHigh: ctx.weather.forecast?.[0]?.high,
      forecastLow: ctx.weather.forecast?.[0]?.low,
      forecastCondition: ctx.weather.forecast?.[0]?.condition,
    };
  }

  if (ctx.traffic) {
    const roads = ctx.city.majorRoads || [];
    const landmarks = ctx.city.landmarks || [];
    payload.traffic = {
      congestion: ctx.traffic.congestionLevel,
      speed: ctx.traffic.averageSpeed,
      road: roads.length > 0 ? roads[Math.floor(Math.random() * roads.length)] : undefined,
      landmark: landmarks.length > 0 ? landmarks[Math.floor(Math.random() * landmarks.length)] : undefined,
      incidents: ctx.traffic.incidents?.map((i: { description?: string }) => i.description).filter(Boolean) as string[] || [],
    };
    // Skip traffic if we have no local road data AND no incidents — would produce generic garbage
    if (!payload.traffic.road && !payload.traffic.landmark && (!payload.traffic.incidents || payload.traffic.incidents.length === 0)) {
      delete payload.traffic;
    }
  }

  if (ctx.events?.length > 0) {
    // Filter out events already mentioned in recent posts to prevent duplicates
    const recentLower = (recentPosts || []).map(p => p.toLowerCase());
    const unusedEvents = ctx.events.filter(e => {
      const nameLower = (e.name || "").toLowerCase();
      // Skip if any recent post mentions this event name (or first 3+ words of it)
      const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2).slice(0, 4);
      return !recentLower.some(post => 
        nameWords.length >= 2 && nameWords.filter(w => post.includes(w)).length >= Math.ceil(nameWords.length * 0.6)
      );
    });
    const pool = unusedEvents.length > 0 ? unusedEvents : ctx.events;
    const event = pool[Math.floor(Math.random() * pool.length)];
    payload.event = {
      name: event.name,
      venue: event.venue,
      date: event.startTime ? new Date(event.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined,
      genre: event.genre,
    };
  }

  return payload;
}

const MOOD_MAP: Record<string, string[]> = {
  Weather: ["😎", "🌤️", "🌧️", "🥵", "❄️"],
  Traffic: ["😤", "😐", "🚗"],
  Events: ["🎉", "🎵", "🏈"],
  General: ["😎", "🤔", "✨"],
};

function pickMood(postType: PostType): string {
  const moods = MOOD_MAP[postType] || MOOD_MAP.General;
  return moods[Math.floor(Math.random() * moods.length)];
}

/**
 * Generate a post using GPT-4o-mini with real data context.
 * Falls back to null if AI is unavailable (caller should fall back to templates).
 */
export async function aiGeneratePost(
  ctx: SituationContext,
  decision: PostDecision,
  recentPosts?: string[]
): Promise<{ message: string; mood: string } | null> {
  const openai = getClient();
  if (!openai || !decision.postType) return null;

  const data = buildDataPayload(ctx, decision);
  if (recentPosts?.length) {
    data.recentPosts = recentPosts.slice(0, 3);
  }

  const now = ctx.timestamp;
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
  const dayStr = now.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" });

  const userPrompt = `Write a ${data.postType.toLowerCase()} post for ${data.city}, ${data.state || ""}.

DATA:
${JSON.stringify(data, null, 2)}

ATTRIBUTION LINE (append at end after newline):
📡 Data: ${getSource(data.postType)} • ${dayStr} ${timeStr}

${recentPosts?.length ? `RECENT POSTS (don't repeat these themes):\n${recentPosts.map(p => `- "${p}"`).join("\n")}` : ""}

Write the post now. Just the post text, nothing else.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.9,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text || text.length < 10) return null;

    return {
      message: text,
      mood: pickMood(data.postType),
    };
  } catch (err) {
    console.error("[AIWriter] GPT call failed:", err);
    return null;
  }
}

function getSource(postType: PostType): string {
  switch (postType) {
    case "Weather": return "Open-Meteo";
    case "Traffic": return "TomTom";
    case "Events": return "Ticketmaster";
    default: return "Local Data";
  }
}
