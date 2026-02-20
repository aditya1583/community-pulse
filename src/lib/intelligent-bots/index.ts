/**
 * Intelligent Bots System
 *
 * Situationally-aware bot posting that uses real data to create
 * authentic, valuable posts for community feeds.
 *
 * Core Principles:
 * 1. Truth-First: Only post when real data supports it
 * 2. Hyperlocal: Use real road names, landmarks, venues
 * 3. Time-Aware: Rush hour, school times, weekends
 * 4. Silence > Noise: Don't post unless genuinely useful
 */

// Types
export type {
  CityConfig,
  CityCoords,
  CityFunFacts,
  TrafficData,
  WeatherData,
  EventData,
  FarmersMarketData,
  TimeContext,
  SituationContext,
  PostDecision,
  PostType,
  GeneratedPost,
  CooldownState,
} from "./types";

// City Configs
export {
  getCityConfig,
  getCityConfigByCoords,
  getOrCreateCityConfig,
  canProvideIntelligentContent,
  hasIntelligentBotConfig,
  getRandomRoad,
  getRandomLandmark,
  getRandomSchool,
  getAltRoute,
  LEANDER_CONFIG,
  CEDAR_PARK_CONFIG,
  AUSTIN_CONFIG,
} from "./city-configs";

// Data Fetchers
export {
  fetchTrafficData,
  fetchTrafficIncidents,
  fetchWeatherData,
  fetchEventData,
  fetchFarmersMarkets,
} from "./data-fetchers";

// Situation Analyzer
export {
  buildSituationContext,
  buildTimeContext,
  analyzeForPost,
  getSituationSummary,
} from "./situation-analyzer";

// Template Engine
export {
  generatePost,
  generateSeedPosts,
  getCuisineFact,
} from "./template-engine";
export type { ExtendedPostType } from "./template-engine";

// Engagement Posts - Data-grounded engagement content only
export {
  generateEngagementPost,
  generateEngagementSeedPosts,
  generatePollPost,
  generateRecommendationPost,
  generateSchoolAlertPost,
  generateThisOrThatPost,
  generateNeighborChallengePost,
  generateWouldYouRatherPost,
  generateConfessionBoothPost,
  generatePredictionPost,
  generateCivicAlertPost,
  generateWeatherAlertPost,
  generateFarmersMarketPost,
  generateRoutePulsePost,
  analyzeForEngagement,
  type EngagementPost,
  type EngagementType,
  type EngagementDecision,
  type PostActionData,
} from "./engagement-posts";

// Data Grounding
export {
  checkDataAvailability,
  DATA_GROUNDED_ENGAGEMENT_TYPES,
  FABRICATING_ENGAGEMENT_TYPES,
  addDataAttribution,
  getPostDataSources,
  type DataAvailability,
} from "./data-grounding";

// AI-Powered Fun Facts
export {
  generateFunFact,
  generateEventFunFact,
  generateWeatherFunFact,
  generateTrafficFunFact,
  formatFunFact,
  type FunFactResult,
} from "./fun-facts-ai";

// Cooldown System
export {
  checkCooldown,
  recordPost,
  resetCooldown,
  getCooldownStatus,
  checkColdStartAllowed,
  recordColdStart,
} from "./cooldown";

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

import { getCityConfig, getCityConfigByCoords, getOrCreateCityConfig } from "./city-configs";
import { fetchTrafficData, fetchWeatherData, fetchEventData, fetchFarmersMarkets } from "./data-fetchers";
import { buildSituationContext, analyzeForPost, getSituationSummary } from "./situation-analyzer";
import { generatePost, generateSeedPosts } from "./template-engine";
import { checkCooldown, recordPost, checkColdStartAllowed, recordColdStart } from "./cooldown";
import { generateEngagementSeedPosts, analyzeForEngagement, generateEngagementPost } from "./engagement-posts";
import type { GeneratedPost, CityCoords, PostType } from "./types";
import type { EngagementPost } from "./engagement-posts";

export interface IntelligentPostResult {
  success: boolean;
  posted: boolean;
  reason: string;
  post?: GeneratedPost | EngagementPost;
  situationSummary?: string;
  cooldownStatus?: {
    allowed: boolean;
    waitTimeMs: number;
  };
}

/**
 * Generate an intelligent post for a city if conditions warrant
 *
 * UNIVERSAL: Now works for ANY city with coordinates, not just pre-configured ones.
 *
 * This is the main entry point for the intelligent bot system.
 * It fetches real data, analyzes the situation, checks cooldowns,
 * and generates a post only if appropriate.
 */
export async function generateIntelligentPost(
  cityName: string,
  options: { force?: boolean; coords?: CityCoords; includeEngagement?: boolean; excludeTypes?: string[] } = {}
): Promise<IntelligentPostResult> {
  // UNIVERSAL CONFIG: Get pre-configured OR generate dynamic config
  let config = getCityConfig(cityName) ||
    (options.coords ? getCityConfigByCoords(options.coords) : null);

  // If no pre-configured match but we have coords, generate dynamic config
  if (!config && options.coords) {
    config = getOrCreateCityConfig(cityName, options.coords);
  }

  if (!config) {
    return {
      success: false,
      posted: false,
      reason: `No configuration for city: ${cityName}. Provide coords for universal support.`,
    };
  }

  // Fetch real-time data in parallel (with Supabase caching to avoid timeouts)
  const { cachedFetch } = await import("@/lib/api-cache");
  const { lat, lon } = config.coords;

  const [traffic, weather, events, farmersMarkets] = await Promise.all([
    cachedFetch("traffic", config.name, () => fetchTrafficData(config!.coords), lat, lon),
    cachedFetch("weather", config.name, () => fetchWeatherData(config!.coords), lat, lon),
    cachedFetch("events", config.name, () => fetchEventData(config!.name, config!.state, config!.coords), lat, lon),
    cachedFetch("farmers_markets", config.name, () => fetchFarmersMarkets(config!.name, config!.state, config!.coords), lat, lon),
  ]);

  // Build situation context
  const ctx = buildSituationContext(config, traffic, weather, events, farmersMarkets);
  const situationSummary = getSituationSummary(ctx);

  // Check for engagement post opportunity first (if enabled)
  if (options.includeEngagement !== false) {
    const engagementDecision = analyzeForEngagement(ctx);

    if (engagementDecision.shouldPost && engagementDecision.engagementType) {
      // Check cooldown for engagement posts
      // Note: We ALWAYS check cooldown even with force:true to prevent instant duplicates in loops
      const cooldown = checkCooldown(
        cityName,
        "General", // Engagement posts are usually "General" tag
        options.force ? 10 : 5, // Force = high priority
        engagementDecision.engagementType
      );

      if (cooldown.allowed) {
        const engagementPost = await generateEngagementPost(ctx, engagementDecision.engagementType);
        if (engagementPost) {
          // Record the post in cooldown state
          recordPost(cityName, engagementPost.tag as PostType || "General", engagementDecision.engagementType);

          return {
            success: true,
            posted: true,
            reason: engagementDecision.reason,
            post: engagementPost,
            situationSummary,
          };
        }
      } else {
        console.log(`[IntelligentPost] Engagement ${engagementDecision.engagementType} blocked: ${cooldown.reason}`);
      }
    }
  }

  // Analyze what to post (regular informational posts)
  const decision = analyzeForPost(ctx, options.excludeTypes);

  if (!decision.shouldPost || !decision.postType) {
    return {
      success: true,
      posted: false,
      reason: decision.reason,
      situationSummary,
    };
  }

  // Check cooldown for regular posts
  // Note: We ALWAYS check cooldown even with force:true to prevent instant duplicates in loops
  const cooldown = checkCooldown(
    cityName,
    decision.postType,
    options.force ? 10 : decision.priority
  );

  if (!cooldown.allowed) {
    return {
      success: true,
      posted: false,
      reason: cooldown.reason,
      situationSummary,
      cooldownStatus: {
        allowed: false,
        waitTimeMs: cooldown.waitTimeMs,
      },
    };
  }

  // Fetch recent bot posts for this city to avoid repetition
  let recentPostMessages: string[] = [];
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: recentRows } = await supabase
      .from("pulses")
      .select("message")
      .eq("is_bot", true)
      .ilike("city", `${cityName}%`)
      .order("created_at", { ascending: false })
      .limit(5);
    recentPostMessages = (recentRows || []).map((r: { message: string }) => r.message);
  } catch {
    // Non-critical — continue without
  }

  // Generate the post
  const post = await generatePost(ctx, decision, { recentPosts: recentPostMessages });

  if (!post) {
    return {
      success: false,
      posted: false,
      reason: "Failed to generate post from template",
      situationSummary,
    };
  }

  // Record the post in cooldown state
  recordPost(cityName, decision.postType);

  return {
    success: true,
    posted: true,
    reason: decision.reason,
    post,
    situationSummary,
  };
}

/**
 * Generate seed posts for a city with no content (cold-start)
 *
 * UNIVERSAL: Now works for ANY city with coordinates, not just pre-configured ones.
 *
 * Creates varied posts based on real conditions:
 * - Weather-based contextual polls (works for any location via Open-Meteo)
 * - Event-based posts (works for any location via Ticketmaster)
 * - Farmers market posts (works for any location via USDA/OSM)
 * - Time-based engagement posts (rush hour, weekends)
 *
 * Includes both informational and engagement posts.
 * Bypasses regular cooldown but respects cold-start limits.
 */
export async function generateColdStartPosts(
  cityName: string,
  options: { coords?: CityCoords; count?: number; force?: boolean; includeEngagement?: boolean } = {}
): Promise<{
  success: boolean;
  posts: (GeneratedPost | EngagementPost)[];
  reason: string;
  situationSummary?: string;
}> {
  const count = options.count || 7; // Cold-start: 7 posts (4 regular + 3 engagement)
  const includeEngagement = options.includeEngagement !== false;

  // Check cold-start is allowed (unless forced)
  if (!options.force) {
    const coldStartCheck = checkColdStartAllowed(cityName);
    if (!coldStartCheck.allowed) {
      return {
        success: false,
        posts: [],
        reason: coldStartCheck.reason,
      };
    }
  }

  // UNIVERSAL CONFIG: Get pre-configured OR generate dynamic config
  // This is the key change that enables the system to work for ANY city
  if (!options.coords) {
    // Without coords, we can't generate dynamic config for unknown cities
    const preconfigured = getCityConfig(cityName);
    if (!preconfigured) {
      return {
        success: false,
        posts: [],
        reason: `No coordinates provided for city: ${cityName}. Coords required for universal support.`,
      };
    }
  }

  // Get or create config - this will use pre-configured if available,
  // or generate a dynamic config for any other city
  const config = options.coords
    ? getOrCreateCityConfig(cityName, options.coords)
    : getCityConfig(cityName)!; // Safe because we checked above

  console.log(`[IntelligentBots] Using config for ${config.name}, ${config.state} (coords: ${config.coords.lat}, ${config.coords.lon})`);

  // Fetch real-time data with caching (avoids Vercel timeouts)
  const { cachedFetch } = await import("@/lib/api-cache");
  const { lat: cLat, lon: cLon } = config.coords;

  const [traffic, weather, events, farmersMarkets] = await Promise.all([
    cachedFetch("traffic", config.name, () => fetchTrafficData(config.coords), cLat, cLon),
    cachedFetch("weather", config.name, () => fetchWeatherData(config.coords), cLat, cLon),
    cachedFetch("events", config.name, () => fetchEventData(config.name, config.state, config.coords), cLat, cLon),
    cachedFetch("farmers_markets", config.name, () => fetchFarmersMarkets(config.name, config.state, config.coords), cLat, cLon),
  ]);

  console.log(`[IntelligentBots] Data fetched - Weather: ${weather.temperature}°F ${weather.condition}, Events: ${events.length}, Markets: ${farmersMarkets.length}`);

  // Build context
  const ctx = buildSituationContext(config, traffic, weather, events, farmersMarkets);
  const situationSummary = getSituationSummary(ctx);

  // Generate varied posts (now with AI-powered fun facts!)
  const regularPosts = await generateSeedPosts(ctx, Math.ceil(count * 0.6)); // 60% regular posts

  // Generate engagement posts if enabled
  let engagementPosts: EngagementPost[] = [];
  if (includeEngagement) {
    engagementPosts = await generateEngagementSeedPosts(ctx, Math.ceil(count * 0.4)); // 40% engagement
  }

  const allPosts = [...regularPosts, ...engagementPosts];

  if (allPosts.length === 0) {
    return {
      success: false,
      posts: [],
      reason: "No real data available to generate posts. Nothing happening right now — check back later.",
      situationSummary,
    };
  }

  // DATA GROUNDING: If fewer than 2 posts backed by real data, return empty
  // This prevents showing a feed with only fabricated content
  if (allPosts.length < 2) {
    console.log(`[IntelligentBots] Only ${allPosts.length} post(s) generated from real data. Minimum is 2.`);
    return {
      success: false,
      posts: [],
      reason: "Not enough real data to populate feed. Nothing happening right now — check back later.",
      situationSummary,
    };
  }

  // Record in cooldown
  recordColdStart(cityName, regularPosts.map(p => ({ tag: p.tag as PostType })));

  return {
    success: true,
    posts: allPosts,
    reason: `Generated ${allPosts.length} cold-start posts (${regularPosts.length} regular, ${engagementPosts.length} engagement)`,
    situationSummary,
  };
}
