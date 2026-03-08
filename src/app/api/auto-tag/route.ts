import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const VALID_TAGS = ["Traffic", "Weather", "Events", "Local"] as const;
type ValidTag = typeof VALID_TAGS[number];

/**
 * POST /api/auto-tag
 * 
 * Classifies a user's post message into the best category tag.
 * Uses GPT-4o-mini for fast, cheap classification.
 * Falls back to "Local" if unsure or if API is unavailable.
 */
export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return NextResponse.json({ tag: "Local" });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      // Fallback: simple keyword matching
      return NextResponse.json({ tag: classifyByKeywords(message) });
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 20,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Classify this neighborhood post into exactly one category. Respond with ONLY the category name.

Categories:
- Traffic: road conditions, accidents, construction, commute, parking, driving
- Weather: temperature, rain, storms, wind, forecasts, outdoor conditions
- Events: concerts, festivals, markets, gatherings, openings, sports, shows
- Local: restaurants, businesses, recommendations, general neighborhood chat, questions, opinions

If unsure, use "Local".`
        },
        {
          role: "user",
          content: message.slice(0, 200)
        }
      ],
    });

    const rawTag = completion.choices[0]?.message?.content?.trim() || "Local";
    
    // Validate the response is a valid tag
    const tag: ValidTag = VALID_TAGS.includes(rawTag as ValidTag)
      ? (rawTag as ValidTag)
      : "Local";

    return NextResponse.json({ tag });

  } catch (err) {
    console.error("[AutoTag] Error:", err);
    return NextResponse.json({ tag: "Local" }); // Always succeed
  }
}

/** Fallback keyword classifier when OpenAI is unavailable */
function classifyByKeywords(message: string): ValidTag {
  const lower = message.toLowerCase();
  
  if (/traffic|accident|road|closure|blocked|congestion|commute|parking|183|29|1431|mopac|i-35/i.test(lower)) {
    return "Traffic";
  }
  if (/weather|rain|storm|tornado|heat|cold|freeze|snow|humid|wind|forecast|temperature/i.test(lower)) {
    return "Weather";
  }
  if (/event|concert|festival|show|market|game|sports|live music|opening|parade|fair/i.test(lower)) {
    return "Events";
  }
  return "Local";
}
