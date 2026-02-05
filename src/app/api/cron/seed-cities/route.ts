/**
 * Cron Job: Seed Cities with Fresh Content
 * 
 * Runs every 2 hours via Vercel Cron to ensure cities always have fresh,
 * relevant content even when no users are posting.
 * 
 * Schedule: "0 *​/2 * * *" (every 2 hours)
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for multiple city seeding

// Cities to seed with coordinates
const SEED_CITIES = [
  { city: "Leander, TX", lat: 30.5788, lon: -97.8531 },
  { city: "Cedar Park, TX", lat: 30.5052, lon: -97.8203 },
  { city: "Austin, TX", lat: 30.2672, lon: -97.7431 },
  // Add more cities as you expand
];

// Verify cron secret to prevent unauthorized calls
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // If no secret configured, allow in development
  if (!cronSecret) {
    console.warn("[Cron] No CRON_SECRET configured - allowing request");
    return true;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ city: string; success: boolean; created?: number; error?: string }> = [];
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  console.log(`[Cron] Starting city seed job at ${new Date().toISOString()}`);

  for (const { city, lat, lon } of SEED_CITIES) {
    try {
      const response = await fetch(`${baseUrl}/api/intelligent-seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          coords: { lat, lon },
          mode: "cold-start",
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        results.push({
          city,
          success: true,
          created: data.count || data.posts?.length || 0,
        });
        console.log(`[Cron] ${city}: Created ${data.count || 0} posts`);
      } else {
        results.push({
          city,
          success: false,
          error: data.error || data.reason || "Unknown error",
        });
        console.log(`[Cron] ${city}: Failed - ${data.error || data.reason}`);
      }
    } catch (error) {
      results.push({
        city,
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
      });
      console.error(`[Cron] ${city}: Exception - ${error}`);
    }

    // Small delay between cities to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const totalCreated = results.reduce((sum, r) => sum + (r.created || 0), 0);
  const successCount = results.filter(r => r.success).length;

  console.log(`[Cron] Completed: ${successCount}/${SEED_CITIES.length} cities, ${totalCreated} posts created`);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      citiesProcessed: SEED_CITIES.length,
      citiesSucceeded: successCount,
      totalPostsCreated: totalCreated,
    },
    results,
  });
}
