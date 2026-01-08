/**
 * Intelligent Seed API - Situationally-aware bot posts
 *
 * This endpoint generates bot posts based on REAL data:
 * - TomTom traffic conditions
 * - Open-Meteo weather
 * - Ticketmaster events
 * - Time of day / rush hours
 *
 * It only posts when conditions warrant it (truth-first principle).
 * Uses real road names and landmarks for the configured cities.
 *
 * POST /api/intelligent-seed
 * Body: { city: string, force?: boolean, mode?: "single" | "cold-start" }
 *
 * - single: Generate one post if conditions warrant (default)
 * - cold-start: Generate 3 varied posts for empty feeds
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateIntelligentPost,
  generateColdStartPosts,
  hasIntelligentBotConfig,
  getCooldownStatus,
} from "@/lib/intelligent-bots";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface RequestBody {
  city: string;
  force?: boolean;
  mode?: "single" | "cold-start";
  coords?: { lat: number; lon: number };
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    if (!body.city) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    // Check if we have config for this city
    if (!hasIntelligentBotConfig(body.city)) {
      return NextResponse.json(
        {
          error: "No intelligent bot configuration for this city",
          message: "Use /api/auto-seed for cities without hyperlocal config",
          city: body.city,
          configuredCities: ["Leander", "Cedar Park", "Austin"],
        },
        { status: 400 }
      );
    }

    // Validate Supabase connection
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const mode = body.mode || "single";

    if (mode === "cold-start") {
      // Generate multiple posts for empty feed
      const result = await generateColdStartPosts(body.city, {
        coords: body.coords,
        count: 3,
      });

      if (!result.success || result.posts.length === 0) {
        return NextResponse.json({
          success: false,
          posted: false,
          reason: result.reason,
          situationSummary: result.situationSummary,
        });
      }

      // Prepare records for insert
      const now = Date.now();
      const records = result.posts.map((post, index) => {
        const createdAt = new Date(now - index * 5 * 60 * 1000).toISOString(); // Stagger by 5 min
        const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();

        return {
          city: body.city,
          message: post.message,
          tag: post.tag,
          mood: post.mood,
          author: post.author,
          user_id: null,
          is_bot: true,
          hidden: false,
          created_at: createdAt,
          expires_at: expiresAt,
        };
      });

      // Insert into database
      const { data, error } = await supabase
        .from("pulses")
        .insert(records)
        .select("id, message, tag, author");

      if (error) {
        console.error("[IntelligentSeed] Database error:", error);
        return NextResponse.json(
          {
            error: "Failed to create posts",
            details: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        posted: true,
        mode: "cold-start",
        count: data?.length || 0,
        posts: data,
        situationSummary: result.situationSummary,
        reason: result.reason,
      });
    }

    // Single post mode
    const result = await generateIntelligentPost(body.city, {
      force: body.force,
      coords: body.coords,
    });

    if (!result.posted || !result.post) {
      return NextResponse.json({
        success: result.success,
        posted: false,
        reason: result.reason,
        situationSummary: result.situationSummary,
        cooldownStatus: result.cooldownStatus,
      });
    }

    // Insert single post
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("pulses")
      .insert({
        city: body.city,
        message: result.post.message,
        tag: result.post.tag,
        mood: result.post.mood,
        author: result.post.author,
        user_id: null,
        is_bot: true,
        hidden: false,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select("id, message, tag, author")
      .single();

    if (error) {
      console.error("[IntelligentSeed] Database error:", error);
      return NextResponse.json(
        {
          error: "Failed to create post",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      posted: true,
      mode: "single",
      post: data,
      situationSummary: result.situationSummary,
      reason: result.reason,
    });
  } catch (error) {
    console.error("[IntelligentSeed] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/intelligent-seed?city=Leander
 *
 * Check the current situation and cooldown status for a city
 * without actually creating a post.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { error: "City query parameter required" },
      { status: 400 }
    );
  }

  if (!hasIntelligentBotConfig(city)) {
    return NextResponse.json({
      city,
      configured: false,
      message: "No intelligent bot configuration for this city",
      configuredCities: ["Leander", "Cedar Park", "Austin"],
    });
  }

  // Get cooldown status
  const cooldown = getCooldownStatus(city);

  // Generate without posting to see what would happen
  const result = await generateIntelligentPost(city, { force: true });

  return NextResponse.json({
    city,
    configured: true,
    cooldown: {
      postsToday: cooldown.postsToday,
      lastPostTime: cooldown.lastPostTime?.toISOString() || null,
      lastPostType: cooldown.lastPostType,
      canPostInMinutes: Math.ceil(cooldown.canPostIn / 60000),
    },
    wouldPost: result.posted,
    reason: result.reason,
    situationSummary: result.situationSummary,
    previewPost: result.post,
  });
}
