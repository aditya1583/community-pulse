/**
 * Cooldown System - Prevents bot spam
 *
 * Rules:
 * - Minimum 30 minutes between any bot posts
 * - Minimum 2 hours between posts of the same type
 * - Maximum 6 posts per day per city
 * - Major incidents can bypass cooldown
 */

import type { PostType, CooldownState } from "./types";

// In-memory cooldown state (per city)
const cooldownStates = new Map<string, CooldownState>();

const COOLDOWN_CONFIG = {
  // Minimum time between any posts (30 minutes)
  minTimeBetweenPosts: 30 * 60 * 1000,

  // Minimum time between same-type posts (2 hours)
  minTimeBetweenSameType: 2 * 60 * 60 * 1000,

  // Maximum posts per day per city
  maxPostsPerDay: 6,

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
      postsToday: 0,
      postsByType: {
        Traffic: 0,
        Weather: 0,
        Events: 0,
        General: 0,
      },
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
  priority: number = 5
): CooldownCheck {
  const state = getState(city);
  const now = Date.now();

  maybeResetDaily(state);

  // High priority posts can bypass cooldown
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
  const timeSinceLastPost = now - state.lastPostTime;
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

  return { allowed: true, reason: "Cooldown passed", waitTimeMs: 0 };
}

/**
 * Record that a post was made (updates cooldown state)
 */
export function recordPost(city: string, postType: PostType): void {
  const state = getState(city);

  maybeResetDaily(state);

  state.lastPostTime = Date.now();
  state.lastPostType = postType;
  state.postsToday += 1;
  state.postsByType[postType] += 1;
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
export function recordColdStart(city: string, posts: { tag: PostType }[]): void {
  const state = getState(city);

  maybeResetDaily(state);

  for (const post of posts) {
    state.postsToday += 1;
    state.postsByType[post.tag] += 1;
  }

  state.lastPostTime = Date.now();
  state.lastPostType = posts[posts.length - 1]?.tag || null;
}
