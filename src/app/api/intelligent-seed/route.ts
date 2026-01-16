/**
 * Intelligent Seed API - Situationally-aware bot posts
 *
 * UNIVERSAL SUPPORT: Works for ANY city, not just pre-configured ones.
 * - Pre-configured cities (Leander, Cedar Park, Austin) get hyperlocal content
 *   with real road names, landmarks, schools, and local venues
 * - All other cities get dynamic configs with contextual content
 *   (weather, events, time-based engagement posts)
 *
 * This endpoint generates bot posts based on REAL data:
 * - TomTom traffic conditions
 * - Open-Meteo weather
 * - Ticketmaster events
 * - Time of day / rush hours
 *
 * It only posts when conditions warrant it (truth-first principle).
 *
 * POST /api/intelligent-seed
 * Body: { city: string, coords?: { lat, lon }, force?: boolean, mode?: "single" | "cold-start" }
 *
 * - city: City name (required)
 * - coords: Coordinates (required for non-configured cities)
 * - mode: "single" (default) or "cold-start" (generates 3 varied posts)
 * - force: Skip cooldown checks
 *
 * GET /api/intelligent-seed?city=CityName&lat=XX.XXX&lon=-XX.XXX
 * Preview what would be posted without actually creating it
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateIntelligentPost,
  generateColdStartPosts,
  hasIntelligentBotConfig,
  getCooldownStatus,
  getCityConfig,
  getOrCreateCityConfig,
} from "@/lib/intelligent-bots";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Get expiration time in hours based on post type.
 * Time-sensitive content (weather, traffic) expires faster to avoid stale data.
 */
function getExpirationHours(tag: string): number {
  const tagLower = tag.toLowerCase();

  // Weather changes constantly - expire in 3 hours
  if (tagLower === "weather") return 3;

  // Traffic conditions change throughout the day - expire in 2 hours
  if (tagLower === "traffic") return 2;

  // Events are date-specific but info stays relevant longer
  if (tagLower === "events") return 12;

  // General content, polls, engagement - 24 hours
  return 24;
}

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

    // UNIVERSAL SUPPORT: Any city works if coords are provided
    // Pre-configured cities (Leander, Cedar Park, Austin) get hyperlocal content
    // All other cities get dynamic configs with contextual content
    const hasPreconfiguredCity = hasIntelligentBotConfig(body.city);

    if (!hasPreconfiguredCity && !body.coords) {
      return NextResponse.json(
        {
          error: "Coordinates required for non-configured cities",
          message: "Provide coords: { lat: number, lon: number } to enable universal support",
          city: body.city,
          preconfiguredCities: ["Leander", "Cedar Park", "Austin"],
          hint: "Pre-configured cities get hyperlocal content. Other cities get contextual weather/events/engagement posts.",
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

      // Get city config for coordinates (so posts appear within radius)
      const cityConfig = body.coords
        ? getOrCreateCityConfig(body.city, body.coords)
        : getCityConfig(body.city);

      const postLat = cityConfig?.coords.lat ?? body.coords?.lat;
      const postLon = cityConfig?.coords.lon ?? body.coords?.lon;

      // Prepare records for insert
      const now = Date.now();
      const records = result.posts.map((post, index) => {
        const createdAt = new Date(now - index * 5 * 60 * 1000).toISOString(); // Stagger by 5 min

        // Expiration based on content type - weather/traffic are time-sensitive
        const expirationHours = getExpirationHours(post.tag);
        const expiresAt = new Date(now + expirationHours * 60 * 60 * 1000).toISOString();

        // Base record with coordinates (so posts appear in-radius)
        const record: Record<string, unknown> = {
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
          poll_options: post.options || null,
          lat: postLat,
          lon: postLon,
        };

        // Add prediction metadata if this is a prediction post
        if (post.prediction) {
          record.is_prediction = true;
          record.prediction_resolves_at = post.prediction.resolvesAt instanceof Date
            ? post.prediction.resolvesAt.toISOString()
            : post.prediction.resolvesAt;
          record.prediction_xp_reward = post.prediction.xpReward;
          record.prediction_category = post.prediction.category;
          record.prediction_data_source = post.prediction.dataSource;
        }

        return record;
      });

      // DEDUPLICATION: Check for similar posts in the last hour to prevent redundancy
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentPosts } = await supabase
        .from("pulses")
        .select("message, tag")
        .eq("city", body.city)
        .eq("is_bot", true)
        .gte("created_at", oneHourAgo);

      const recentMessages = new Set(
        (recentPosts || []).map((p) => `${p.tag}:${p.message.substring(0, 50)}`)
      );

      // Filter out duplicates
      const uniqueRecords = records.filter((r) => {
        const key = `${r.tag}:${(r.message as string).substring(0, 50)}`;
        return !recentMessages.has(key);
      });

      if (uniqueRecords.length === 0) {
        return NextResponse.json({
          success: true,
          posted: false,
          reason: "All posts would be duplicates of recent content",
          mode: "cold-start",
          count: 0,
        });
      }

      // Insert only unique posts
      const { data, error } = await supabase
        .from("pulses")
        .insert(uniqueRecords)
        .select("id, message, tag, author, poll_options");

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

    // Get city config for coordinates (so posts appear in-radius)
    const singleCityConfig = body.coords
      ? getOrCreateCityConfig(body.city, body.coords)
      : getCityConfig(body.city);

    const singlePostLat = singleCityConfig?.coords.lat ?? body.coords?.lat;
    const singlePostLon = singleCityConfig?.coords.lon ?? body.coords?.lon;

    // Insert single post
    const now = new Date();

    // Expiration based on content type - weather/traffic are time-sensitive
    const expirationHours = getExpirationHours(result.post.tag);
    const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);

    // Build insert record with coordinates (so posts appear in-radius)
    const insertRecord: Record<string, unknown> = {
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
      poll_options: result.post.options || null,
      lat: singlePostLat,
      lon: singlePostLon,
    };

    // Add prediction metadata if this is a prediction post
    if (result.post.prediction) {
      insertRecord.is_prediction = true;
      insertRecord.prediction_resolves_at = result.post.prediction.resolvesAt instanceof Date
        ? result.post.prediction.resolvesAt.toISOString()
        : result.post.prediction.resolvesAt;
      insertRecord.prediction_xp_reward = result.post.prediction.xpReward;
      insertRecord.prediction_category = result.post.prediction.category;
      insertRecord.prediction_data_source = result.post.prediction.dataSource;
    }

    // DEDUPLICATION: Check for similar posts in the last hour
    const singleOneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: singleRecentPosts } = await supabase
      .from("pulses")
      .select("message")
      .eq("city", body.city)
      .eq("tag", result.post.tag)
      .eq("is_bot", true)
      .gte("created_at", singleOneHourAgo);

    const isDuplicate = (singleRecentPosts || []).some(
      (p) => p.message.substring(0, 50) === result.post!.message.substring(0, 50)
    );

    if (isDuplicate) {
      return NextResponse.json({
        success: true,
        posted: false,
        reason: "Similar post already exists from recent seeding",
        mode: "single",
      });
    }

    const { data, error } = await supabase
      .from("pulses")
      .insert(insertRecord)
      .select("id, message, tag, author, poll_options, is_prediction, prediction_resolves_at, prediction_xp_reward")
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
 * GET /api/intelligent-seed?city=Leander&lat=30.5788&lon=-97.8531
 *
 * Check the current situation and cooldown status for a city
 * without actually creating a post.
 *
 * UNIVERSAL SUPPORT: Works for any city if lat/lon are provided.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!city) {
    return NextResponse.json(
      { error: "City query parameter required" },
      { status: 400 }
    );
  }

  const isPreconfigured = hasIntelligentBotConfig(city);
  const coords = lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : undefined;

  // Non-configured cities need coords for universal support
  if (!isPreconfigured && !coords) {
    return NextResponse.json({
      city,
      configured: false,
      universalSupported: true,
      message: "Provide lat/lon query params to enable universal support for this city",
      preconfiguredCities: ["Leander", "Cedar Park", "Austin"],
      hint: "Example: ?city=Liberty Hill&lat=30.6649&lon=-97.9225",
    });
  }

  // Get cooldown status
  const cooldown = getCooldownStatus(city);

  // Generate without posting to see what would happen
  const result = await generateIntelligentPost(city, { force: true, coords });

  return NextResponse.json({
    city,
    configured: isPreconfigured,
    universalMode: !isPreconfigured,
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
