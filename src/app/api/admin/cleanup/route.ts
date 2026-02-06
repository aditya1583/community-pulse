/**
 * Admin Cleanup Endpoint
 * Deletes junk data: coordinate-based cities, excess bot posts
 * Protected by CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_BOT_POSTS_PER_CITY = 5;

export async function POST(request: NextRequest) {
  // Verify secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const results: Record<string, unknown> = {};

  try {
    // 1. Delete pulses with junk city names (coordinates or "Current Location")
    const { data: coordPulses, error: coordFetchError } = await supabase
      .from("pulses")
      .select("id, city")
      .or("city.like.%°%,city.like.Current Location%");

    if (coordFetchError) {
      results.coordError = coordFetchError.message;
    } else if (coordPulses && coordPulses.length > 0) {
      const coordIds = coordPulses.map(p => p.id);
      const { error: coordDeleteError } = await supabase
        .from("pulses")
        .delete()
        .in("id", coordIds);
      
      results.coordPulsesDeleted = coordDeleteError ? 0 : coordIds.length;
      if (coordDeleteError) results.coordDeleteError = coordDeleteError.message;
    } else {
      results.coordPulsesDeleted = 0;
    }

    // 2. Get all cities with bot posts
    const { data: citiesWithBots, error: citiesError } = await supabase
      .from("pulses")
      .select("city")
      .eq("is_bot", true);

    if (citiesError) {
      results.citiesError = citiesError.message;
    } else {
      // Get unique cities
      const uniqueCities = [...new Set(citiesWithBots?.map(p => p.city) || [])];
      let totalDeleted = 0;

      for (const city of uniqueCities) {
        // Get all bot posts for this city, ordered by created_at desc
        const { data: botPosts, error: fetchError } = await supabase
          .from("pulses")
          .select("id")
          .eq("city", city)
          .eq("is_bot", true)
          .order("created_at", { ascending: false });

        if (fetchError || !botPosts) continue;

        if (botPosts.length > MAX_BOT_POSTS_PER_CITY) {
          const idsToDelete = botPosts.slice(MAX_BOT_POSTS_PER_CITY).map(p => p.id);
          const { error: deleteError } = await supabase
            .from("pulses")
            .delete()
            .in("id", idsToDelete);

          if (!deleteError) {
            totalDeleted += idsToDelete.length;
          }
        }
      }

      results.excessBotPostsDeleted = totalDeleted;
      results.citiesProcessed = uniqueCities.length;
    }

    // 3. Normalize duplicate city names - keep only canonical forms
    // Delete bot posts with non-canonical city names
    const canonicalCities: Record<string, string> = {
      "Leander, Texas, US": "Leander, Texas",
      "Leander, TX": "Leander, Texas",
      "Austin, TX, US": "Austin, Texas",
      "Austin, TX": "Austin, Texas",
      "Austin, Texas, US": "Austin, Texas",
      "Cedar Park, TX": "Cedar Park, Texas",
    };

    let normalizedDeleted = 0;
    for (const [variant, canonical] of Object.entries(canonicalCities)) {
      if (variant === canonical) continue;
      
      const { data: variantPosts } = await supabase
        .from("pulses")
        .select("id")
        .eq("city", variant)
        .eq("is_bot", true);
      
      if (variantPosts && variantPosts.length > 0) {
        const ids = variantPosts.map(p => p.id);
        const { error } = await supabase
          .from("pulses")
          .delete()
          .in("id", ids);
        
        if (!error) normalizedDeleted += ids.length;
      }
    }
    results.normalizedDeleted = normalizedDeleted;

    // Report remaining cities
    const { data: allCities } = await supabase
      .from("pulses")
      .select("city")
      .eq("is_bot", true);
    
    const cityCount: Record<string, number> = {};
    allCities?.forEach(p => {
      cityCount[p.city] = (cityCount[p.city] || 0) + 1;
    });
    results.remainingCities = cityCount;

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    return NextResponse.json({
      error: "Cleanup failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
