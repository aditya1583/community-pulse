import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

/**
 * GET /api/community-summary?city=Leander,+Texas
 * 
 * Returns an AI-generated one-line summary of what the community is talking about.
 * Uses GPT-4o-mini to summarize recent user posts (not bot posts).
 * Cached for 15 minutes per city.
 */

// Simple in-memory cache
const cache: Record<string, { summary: string; emoji: string; fetchedAt: number }> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 min

export async function GET(req: NextRequest) {
  try {
    const city = req.nextUrl.searchParams.get("city");
    if (!city) {
      return NextResponse.json({ error: "city parameter required" }, { status: 400 });
    }

    // Check cache
    const cached = cache[city];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return NextResponse.json({ summary: cached.summary, emoji: cached.emoji, cached: true });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get recent user posts (last 24h, not bot posts)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: pulses } = await supabase
      .from("pulses")
      .select("message, mood, tag, author, created_at")
      .eq("is_bot", false)
      .ilike("city", `%${city.split(",")[0]}%`)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!pulses || pulses.length === 0) {
      const result = { summary: "Your neighborhood is quiet right now. Be the first to share what's happening.", emoji: "🤫" };
      cache[city] = { ...result, fetchedAt: Date.now() };
      return NextResponse.json(result);
    }

    // If no OpenAI key, fall back to simple summary
    if (!openaiKey) {
      const count = pulses.length;
      const result = { 
        summary: `${count} ${count === 1 ? "neighbor" : "neighbors"} shared updates today. Check out what's happening.`,
        emoji: "💬"
      };
      cache[city] = { ...result, fetchedAt: Date.now() };
      return NextResponse.json(result);
    }

    // Build prompt
    const postSummaries = pulses.map((p, i) => 
      `${i + 1}. "${p.message}" (mood: ${p.mood || "none"}, by ${p.author})`
    ).join("\n");

    const cityShort = city.split(",")[0].trim();

    const openai = new OpenAI({ apiKey: openaiKey });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You summarize what a neighborhood is talking about in one short, warm, natural sentence (max 15 words). Include the city name. Output JSON: {"summary": "...", "emoji": "..."}. The emoji should match the dominant vibe. Be conversational, not robotic.`
        },
        {
          role: "user",
          content: `Here are the ${pulses.length} most recent posts from neighbors in ${cityShort}:\n\n${postSummaries}\n\nSummarize what the community is talking about.`
        }
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    let result = { summary: `${pulses.length} neighbors are sharing in ${cityShort}`, emoji: "💬" };

    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.summary) result.summary = parsed.summary;
        if (parsed.emoji) result.emoji = parsed.emoji;
      } catch {
        // Use fallback
      }
    }

    cache[city] = { ...result, fetchedAt: Date.now() };
    return NextResponse.json(result);

  } catch (err) {
    console.error("[CommunitySummary] Error:", err);
    return NextResponse.json(
      { summary: "Check out what neighbors are sharing today.", emoji: "💬" },
      { status: 200 } // Graceful degradation
    );
  }
}
