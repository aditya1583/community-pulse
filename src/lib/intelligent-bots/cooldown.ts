/**
 * Cooldown System - Prevents bot spam
 *
 * Rules:
 * - Minimum 30 minutes between any bot posts
 * - Minimum 2 hours between posts of the same type
 * - Maximum 8 posts per day per city
 * - Major incidents can bypass cooldown
 */

import type { PostType, CooldownState as CooldownStateBase } from "./types";

// Extend the base CooldownState type for internal tracking
export interface CooldownState extends CooldownStateBase {
  lastEngagementType: string | null;
  engagementPostsByType: Record<string, number>;
}

// In-memory cooldown state (per city)
const cooldownStates = new Map<string, CooldownState>();

const COOLDOWN_CONFIG = {
  // Minimum time between any posts (30 minutes)
  minTimeBetweenPosts: 30 * 60 * 1000,

  // Minimum time between same-type posts (2 hours)
  minTimeBetweenSameType: 2 * 60 * 60 * 1000,

  // ANTI-DUPLICATE: Minimum time between exact same type/engagement posts
  // Even if forced, we don't want two posts about the same thing in 5 mins
  minAntiDuplicateWindow: 5 * 60 * 1000,

  // Maximum posts per day per city
  maxPostsPerDay: 8,

  // Priority threshold to bypass cooldown (1-10)
  priorityBypassThreshold: 8,
};

/**
 * Get or initialize cooldown state for a city
 */
function getState(city: string): CooldownState {
  const normalized = city.toLowerCase();

  if (!cooldownStates.has(normalized)) {
    cooldownStates.set(normalized, {
      lastPostTime: 0,
      lastPostType: null,
      lastEngagementType: null,
      postsToday: 0,
      postsByType: {
        Traffic: 0,
        Weather: 0,
        Events: 0,
        General: 0,
      },
      engagementPostsByType: {},
    });
  }

  return cooldownStates.get(normalized)!;
}

/**
 * Check if we're on a new day and reset counters if needed
 */
function maybeResetDaily(state: CooldownState): void {
  const now = new Date();
  const lastPost = new Date(state.lastPostTime);

  // If last post was on a different day, reset daily counters
  if (
    lastPost.getDate() !== now.getDate() ||
    lastPost.getMonth() !== now.getMonth() ||
    lastPost.getFullYear() !== now.getFullYear()
  ) {
    state.postsToday = 0;
    state.postsByType = {
      Traffic: 0,
      Weather: 0,
      Events: 0,
      General: 0,
    };
    state.engagementPostsByType = {};
    state.lastEngagementType = null;
  }
}

export interface CooldownCheck {
  allowed: boolean;
  reason: string;
  waitTimeMs: number;
}

/**
 * Check if a post is allowed based on cooldown rules
 */
export function checkCooldown(
  city: string,
  postType: PostType,
  priority: number = 5,
  engagementType: string | null = null
): CooldownCheck {
  const state = getState(city);
  const now = Date.now();

  maybeResetDaily(state);

  // ANTI-DUPLICATE CHECK (Always enabled, even for high priority / forced)
  // We NEVER want two posts of the exact same type/engagement within 5 minutes
  const timeSinceLastPost = now - state.lastPostTime;
  if (timeSinceLastPost < COOLDOWN_CONFIG.minAntiDuplicateWindow) {
    const isSameType = state.lastPostType === postType;
    const isSameEngagement = engagementType && state.lastEngagementType === engagementType;

    if (isSameType && (!engagementType || isSameEngagement)) {
      return {
        allowed: false,
        reason: `Anti-duplicate: Just posted ${engagementType || postType} ${Math.round(timeSinceLastPost / 1000)}s ago`,
        waitTimeMs: COOLDOWN_CONFIG.minAntiDuplicateWindow - timeSinceLastPost,
      };
    }
  }

  // High priority posts can bypass remaining cooldowns
  if (priority >= COOLDOWN_CONFIG.priorityBypassThreshold) {
    return { allowed: true, reason: "High priority bypass", waitTimeMs: 0 };
  }

  // Check daily limit
  if (state.postsToday >= COOLDOWN_CONFIG.maxPostsPerDay) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const waitTime = tomorrow.getTime() - now;

    return {
      allowed: false,
      reason: `Daily limit reached (${COOLDOWN_CONFIG.maxPostsPerDay} posts)`,
      waitTimeMs: waitTime,
    };
  }

  // Check minimum time between any posts
  if (timeSinceLastPost < COOLDOWN_CONFIG.minTimeBetweenPosts) {
    const waitTime = COOLDOWN_CONFIG.minTimeBetweenPosts - timeSinceLastPost;
    return {
      allowed: false,
      reason: `Too soon since last post (${Math.round(timeSinceLastPost / 60000)}m ago)`,
      waitTimeMs: waitTime,
    };
  }

  // Check minimum time between same-type posts
  if (state.lastPostType === postType) {
    if (timeSinceLastPost < COOLDOWN_CONFIG.minTimeBetweenSameType) {
      const waitTime = COOLDOWN_CONFIG.minTimeBetweenSameType - timeSinceLastPost;
      return {
        allowed: false,
        reason: `Too soon for another ${postType} post`,
        waitTimeMs: waitTime,
      };
    }
  }

  // Check engagement type specific cooldown
  if (engagementType && state.engagementPostsByType[engagementType]) {
    // For specific engagement types, limit to once per hour
    if (timeSinceLastPost < 60 * 60 * 1000) {
      return {
        allowed: false,
        reason: `Already posted ${engagementType} recently`,
        waitTimeMs: 60 * 60 * 1000 - timeSinceLastPost
      };
    }
  }

  return { allowed: true, reason: "Cooldown passed", waitTimeMs: 0 };
}

/**
 * Record that a post was made (updates cooldown state)
 */
export function recordPost(city: string, postType: PostType, engagementType: string | null = null): void {
  const state = getState(city);

  maybeResetDaily(state);

  state.lastPostTime = Date.now();
  state.lastPostType = postType;
  state.lastEngagementType = engagementType;
  state.postsToday += 1;
  state.postsByType[postType] += 1;

  if (engagementType) {
    state.engagementPostsByType[engagementType] = (state.engagementPostsByType[engagementType] || 0) + 1;
  }
}

/**
 * Force reset cooldown for a city (for testing)
 */
export function resetCooldown(city: string): void {
  const normalized = city.toLowerCase();
  cooldownStates.delete(normalized);
}

/**
 * Get cooldown status for a city (for debugging)
 */
export function getCooldownStatus(city: string): {
  postsToday: number;
  lastPostTime: Date | null;
  lastPostType: PostType | null;
  lastEngagementType: string | null;
  canPostIn: number;
} {
  const state = getState(city);
  const now = Date.now();

  maybeResetDaily(state);

  const timeSinceLastPost = now - state.lastPostTime;
  const canPostIn = Math.max(0, COOLDOWN_CONFIG.minTimeBetweenPosts - timeSinceLastPost);

  return {
    postsToday: state.postsToday,
    lastPostTime: state.lastPostTime ? new Date(state.lastPostTime) : null,
    lastPostType: state.lastPostType,
    lastEngagementType: state.lastEngagementType,
    canPostIn,
  };
}

/**
 * Check if cold-start seeding is allowed (more permissive than regular posting)
 * Allows initial 3 posts for empty cities
 */
export function checkColdStartAllowed(city: string): CooldownCheck {
  const state = getState(city);

  maybeResetDaily(state);

  // Allow cold-start if no posts today
  if (state.postsToday === 0) {
    return { allowed: true, reason: "Cold-start allowed", waitTimeMs: 0 };
  }

  // Otherwise use regular cooldown rules
  return checkCooldown(city, "General", 5);
}

/**
 * Record multiple cold-start posts
 */
export function recordColdStart(city: string, posts: { tag: PostType; engagementType?: string }[]): void {
  const state = getState(city);

  maybeResetDaily(state);

  for (const post of posts) {
    state.postsToday += 1;
    state.postsByType[post.tag] += 1;
    if (post.engagementType) {
      state.engagementPostsByType[post.engagementType] = (state.engagementPostsByType[post.engagementType] || 0) + 1;
    }
  }

  state.lastPostTime = Date.now();
  state.lastPostType = posts[posts.length - 1]?.tag || null;
  state.lastEngagementType = posts[posts.length - 1]?.engagementType || null;
}
