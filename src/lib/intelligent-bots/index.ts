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

import { getCityConfig, getCityConfigByCoords } from "./city-configs";
import { fetchTrafficData, fetchWeatherData, fetchEventData } from "./data-fetchers";
import { buildSituationContext, analyzeForPost, getSituationSummary } from "./situation-analyzer";
import { generatePost, generateSeedPosts } from "./template-engine";
import { checkCooldown, recordPost, checkColdStartAllowed, recordColdStart } from "./cooldown";
import type { GeneratedPost, CityCoords, PostType } from "./types";

export interface IntelligentPostResult {
  success: boolean;
  posted: boolean;
  reason: string;
  post?: GeneratedPost;
  situationSummary?: string;
  cooldownStatus?: {
    allowed: boolean;
    waitTimeMs: number;
  };
}

/**
 * Generate an intelligent post for a city if conditions warrant
 *
 * This is the main entry point for the intelligent bot system.
 * It fetches real data, analyzes the situation, checks cooldowns,
 * and generates a post only if appropriate.
 */
export async function generateIntelligentPost(
  cityName: string,
  options: { force?: boolean; coords?: CityCoords } = {}
): Promise<IntelligentPostResult> {
  // Get city config
  const config = getCityConfig(cityName) ||
    (options.coords ? getCityConfigByCoords(options.coords) : null);

  if (!config) {
    return {
      success: false,
      posted: false,
      reason: `No configuration for city: ${cityName}`,
    };
  }

  // Fetch real-time data in parallel (pass coords for better event coverage)
  const [traffic, weather, events] = await Promise.all([
    fetchTrafficData(config.coords),
    fetchWeatherData(config.coords),
    fetchEventData(config.name, config.state, config.coords),
  ]);

  // Build situation context
  const ctx = buildSituationContext(config, traffic, weather, events);
  const situationSummary = getSituationSummary(ctx);

  // Analyze what to post
  const decision = analyzeForPost(ctx);

  if (!decision.shouldPost || !decision.postType) {
    return {
      success: true,
      posted: false,
      reason: decision.reason,
      situationSummary,
    };
  }

  // Check cooldown (unless forced)
  if (!options.force) {
    const cooldown = checkCooldown(cityName, decision.postType, decision.priority);
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
  }

  // Generate the post (now with AI-powered fun facts!)
  const post = await generatePost(ctx, decision);

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
 * Creates 3 varied posts based on real conditions.
 * Bypasses regular cooldown but respects cold-start limits.
 */
export async function generateColdStartPosts(
  cityName: string,
  options: { coords?: CityCoords; count?: number; force?: boolean } = {}
): Promise<{
  success: boolean;
  posts: GeneratedPost[];
  reason: string;
  situationSummary?: string;
}> {
  const count = options.count || 3;

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

  // Get city config
  const config = getCityConfig(cityName) ||
    (options.coords ? getCityConfigByCoords(options.coords) : null);

  if (!config) {
    // No config - fall back to generic posts
    return {
      success: false,
      posts: [],
      reason: `No configuration for city: ${cityName}. Use generic auto-seed instead.`,
    };
  }

  // Fetch real-time data (pass coords for better event coverage in suburbs)
  const [traffic, weather, events] = await Promise.all([
    fetchTrafficData(config.coords),
    fetchWeatherData(config.coords),
    fetchEventData(config.name, config.state, config.coords),
  ]);

  // Build context
  const ctx = buildSituationContext(config, traffic, weather, events);
  const situationSummary = getSituationSummary(ctx);

  // Generate varied posts (now with AI-powered fun facts!)
  const posts = await generateSeedPosts(ctx, count);

  if (posts.length === 0) {
    return {
      success: false,
      posts: [],
      reason: "Failed to generate seed posts",
      situationSummary,
    };
  }

  // Record in cooldown
  recordColdStart(cityName, posts.map(p => ({ tag: p.tag as PostType })));

  return {
    success: true,
    posts,
    reason: `Generated ${posts.length} cold-start posts`,
    situationSummary,
  };
}
