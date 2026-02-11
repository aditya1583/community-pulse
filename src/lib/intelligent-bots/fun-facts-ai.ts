/**
 * AI-Powered Fun Facts Generator
 *
 * Generates contextual, engaging "did you know" facts using OpenAI
 * based on the current situation (events, weather, traffic, time of day)
 */
import OpenAI from "openai";
import type { SituationContext, PostType, EventData } from "./types";

// Lazy initialization - only create client when needed and API key exists
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Cache to prevent repeating facts within a session
const recentFactsCache: Set<string> = new Set();
const MAX_CACHE_SIZE = 50;

export interface FunFactResult {
  fact: string;
  category: string;
  source: "ai" | "fallback";
}

/**
 * Generate a contextual fun fact based on the current situation
 */
export async function generateFunFact(
  ctx: SituationContext,
  postType: PostType,
  specificContext?: {
    eventName?: string;
    eventVenue?: string;
    roadName?: string;
    weatherCondition?: string;
    temperature?: number;
  }
): Promise<FunFactResult | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    console.log("[FunFactsAI] No OpenAI API key, skipping AI fact generation");
    return null;
  }

  const prompt = buildPrompt(ctx, postType, specificContext);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a local trivia expert for ${ctx.city.name}, ${ctx.city.state}. Generate ONE interesting, verified "did you know" fact that's:
- Genuinely interesting and conversation-worthy
- Related to the context provided (event, weather, traffic, or local area)
- Factual and verifiable (don't make things up)
- Concise (1-2 sentences max, under 150 characters ideal)
- Written in a casual, friendly tone

STRICT ANTI-FABRICATION RULES:
- NEVER invent business names, restaurant names, or store names
- NEVER fabricate specific deals, discounts, happy hours, prices, or promotions
- NEVER claim a business is having a sale, special, or event unless that data was explicitly provided
- NEVER invent locations, addresses, or landmarks that may not exist
- NEVER use phrases like "hidden gem", "best kept secret", or "food trailer behind [store]"
- Stick to verifiable facts about the area, history, geography, or culture
- When in doubt, be general rather than specific

Return ONLY a JSON object: {"fact": "your fact here", "category": "event|weather|traffic|local"}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      console.log("[FunFactsAI] Empty response from OpenAI");
      return null;
    }

    const parsed = JSON.parse(raw) as { fact?: string; category?: string };

    if (!parsed.fact) {
      return null;
    }

    // Check if we've used this fact recently
    const factHash = parsed.fact.toLowerCase().slice(0, 50);
    if (recentFactsCache.has(factHash)) {
      console.log("[FunFactsAI] Fact already used recently, skipping");
      return null;
    }

    // Add to cache
    recentFactsCache.add(factHash);
    if (recentFactsCache.size > MAX_CACHE_SIZE) {
      // Remove oldest entry
      const first = recentFactsCache.values().next().value;
      if (first) recentFactsCache.delete(first);
    }

    console.log(`[FunFactsAI] Generated fact: "${parsed.fact}"`);

    return {
      fact: parsed.fact,
      category: parsed.category || "local",
      source: "ai",
    };
  } catch (error) {
    console.error("[FunFactsAI] Error generating fact:", error);
    return null;
  }
}

/**
 * Generate a fun fact specifically for an event
 */
export async function generateEventFunFact(
  event: EventData,
  cityName: string
): Promise<FunFactResult | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    return null;
  }

  const prompt = `Generate a fun fact about this event or artist:

Event: ${event.name}
Venue: ${event.venue}
Category: ${event.category}
City: ${cityName}, Texas

Examples of good facts:
- For a Taylor Swift concert: "Taylor Swift's Eras Tour is the highest-grossing concert tour of all time"
- For Texas Stars hockey: "The Texas Stars have won the Calder Cup twice since moving to Cedar Park"
- For SXSW: "SXSW launched the careers of artists like John Mayer and Hanson"

Generate something specific to THIS event, artist, or venue if possible. If it's a lesser-known event, generate a fact about the venue or event type.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a local entertainment trivia expert. Generate ONE verified, interesting fact about the event, artist, or venue. Keep it under 150 characters. NEVER invent venue names, business names, or fabricate details not in the provided data. Return JSON: {"fact": "your fact", "category": "event"}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { fact?: string };
    if (!parsed.fact) return null;

    console.log(`[FunFactsAI] Event fact: "${parsed.fact}"`);

    return {
      fact: parsed.fact,
      category: "event",
      source: "ai",
    };
  } catch (error) {
    console.error("[FunFactsAI] Error generating event fact:", error);
    return null;
  }
}

/**
 * Generate a fun fact about weather conditions
 */
export async function generateWeatherFunFact(
  condition: string,
  temperature: number,
  cityName: string
): Promise<FunFactResult | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    return null;
  }

  const prompt = `Generate a fun fact related to this weather:

City: ${cityName}, Texas
Current Weather: ${condition}
Temperature: ${temperature}°F

Examples:
- For rain in Austin: "Austin sits in 'Flash Flood Alley' - one of the most flood-prone regions in North America"
- For 105°F heat: "Austin's record high was 112°F in August 2023"
- For rare snow: "Austin averages less than 1 inch of snow per year"

Generate a fact about weather patterns, climate records, or local weather history relevant to current conditions.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a Texas weather expert. Generate ONE verified, interesting fact about ${cityName}'s weather or climate relevant to current conditions. Keep it under 150 characters. Return JSON: {"fact": "your fact", "category": "weather"}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { fact?: string };
    if (!parsed.fact) return null;

    console.log(`[FunFactsAI] Weather fact: "${parsed.fact}"`);

    return {
      fact: parsed.fact,
      category: "weather",
      source: "ai",
    };
  } catch (error) {
    console.error("[FunFactsAI] Error generating weather fact:", error);
    return null;
  }
}

/**
 * Generate a fun fact about traffic/roads
 */
export async function generateTrafficFunFact(
  roadName: string,
  cityName: string
): Promise<FunFactResult | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    return null;
  }

  const prompt = `Generate a fun fact about this road or traffic in the area:

Road: ${roadName}
City: ${cityName}, Texas

Examples:
- For I-35: "I-35 through Austin is the most congested highway in Texas"
- For MoPac: "MoPac was named after the Missouri Pacific Railroad that ran along its route"
- For Ronald Reagan Blvd: "Ronald Reagan Blvd was originally County Road 175"

Generate a fact about the road's history, naming, or traffic patterns.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a Texas roads and infrastructure expert. Generate ONE verified, interesting fact about ${roadName} or traffic in ${cityName}. Keep it under 150 characters. Return JSON: {"fact": "your fact", "category": "traffic"}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { fact?: string };
    if (!parsed.fact) return null;

    console.log(`[FunFactsAI] Traffic fact: "${parsed.fact}"`);

    return {
      fact: parsed.fact,
      category: "traffic",
      source: "ai",
    };
  } catch (error) {
    console.error("[FunFactsAI] Error generating traffic fact:", error);
    return null;
  }
}

/**
 * Build the prompt based on context
 */
function buildPrompt(
  ctx: SituationContext,
  postType: PostType,
  specificContext?: {
    eventName?: string;
    eventVenue?: string;
    roadName?: string;
    weatherCondition?: string;
    temperature?: number;
  }
): string {
  const city = ctx.city.name;
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let context = `City: ${city}, Texas\nTime: ${time}\nPost Type: ${postType}\n`;

  switch (postType) {
    case "Events":
      if (specificContext?.eventName) {
        context += `Event: ${specificContext.eventName}\n`;
        if (specificContext.eventVenue) {
          context += `Venue: ${specificContext.eventVenue}\n`;
        }
        context += `\nGenerate a fun fact about this event, the artist/team, or the venue.`;
      } else if (ctx.events.length > 0) {
        context += `Event: ${ctx.events[0].name}\nVenue: ${ctx.events[0].venue}\n`;
        context += `\nGenerate a fun fact about this event, the artist/team, or the venue.`;
      }
      break;

    case "Traffic":
      const road = specificContext?.roadName || ctx.city.roads.major[0];
      context += `Road: ${road}\nCongestion: ${Math.round(ctx.traffic.congestionLevel * 100)}%\n`;
      context += `\nGenerate a fun fact about this road, its history, or traffic patterns in ${city}.`;
      break;

    case "Weather":
      context += `Condition: ${specificContext?.weatherCondition || ctx.weather.condition}\n`;
      context += `Temperature: ${specificContext?.temperature || ctx.weather.temperature}°F\n`;
      context += `\nGenerate a fun fact about ${city}'s weather, climate records, or this type of weather in Texas.`;
      break;

    case "General":
    default:
      context += `\nGenerate a fun fact about ${city}, its history, culture, or local trivia.`;
      break;
  }

  return context;
}

/**
 * Format a fun fact for inclusion in a post
 */
export function formatFunFact(fact: string): string {
  const prefixes = [
    "💡 Fun fact:",
    "🤓 Did you know?",
    "📚 Trivia:",
    "✨ BTW:",
    "🧠 Random fact:",
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix} ${fact}`;
}
