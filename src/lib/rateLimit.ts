/**
 * Rate Limiting Module
 *
 * Provides rate limiting for API endpoints to prevent spam and abuse.
 * Uses in-memory storage with LRU eviction for edge/serverless environments.
 *
 * For production with multiple instances, consider upgrading to Redis.
 * This implementation is sufficient for moderate traffic and provides
 * good protection against basic spam attacks.
 *
 * Rate Limit Configurations:
 * - PULSE_CREATE: 5 per hour per user (authenticated)
 * - PULSE_CREATE_ANON: 2 per hour per IP (fallback)
 * - REPORT: 10 per day per user
 * - VENUE_VIBE: 5 per hour per user
 * - GLOBAL: 100 per minute per IP
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

// In-memory store with LRU-like behavior (oldest entries evicted when full)
const store = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 10000; // Prevent unbounded memory growth

/**
 * Rate limit configuration
 */
export type RateLimitConfig = {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Optional custom key prefix */
  keyPrefix?: string;
};

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Pulse creation: relaxed for testing
  // TODO: GA - Reduce back to 5 per hour before production launch
  PULSE_CREATE: {
    limit: 50,
    windowSeconds: 3600, // 1 hour
    keyPrefix: "pulse",
  },
  // Pulse creation for anonymous (IP-based): 2 per hour
  PULSE_CREATE_ANON: {
    limit: 2,
    windowSeconds: 3600,
    keyPrefix: "pulse-anon",
  },
  // Reporting: 10 per day
  REPORT: {
    limit: 10,
    windowSeconds: 86400, // 24 hours
    keyPrefix: "report",
  },
  // Venue vibe logging: 5 per hour
  VENUE_VIBE: {
    limit: 5,
    windowSeconds: 3600,
    keyPrefix: "vibe",
  },
  // Global rate limit: 100 per minute per IP
  GLOBAL: {
    limit: 100,
    windowSeconds: 60,
    keyPrefix: "global",
  },
  // Auth attempts: 5 per 15 minutes
  AUTH: {
    limit: 5,
    windowSeconds: 900,
    keyPrefix: "auth",
  },
} as const;

/**
 * Result of a rate limit check
 */
export type RateLimitResult = {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current count in the window */
  current: number;
  /** Maximum allowed in the window */
  limit: number;
  /** Seconds until the window resets */
  resetInSeconds: number;
  /** Remaining requests in the window */
  remaining: number;
};

/**
 * Generate a rate limit key
 */
function generateKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}

/**
 * Evict oldest entries if store is full
 */
function evictIfNeeded(): void {
  if (store.size >= MAX_STORE_SIZE) {
    // Delete first 10% of entries (oldest in insertion order)
    const toDelete = Math.floor(MAX_STORE_SIZE * 0.1);
    let deleted = 0;
    for (const key of store.keys()) {
      if (deleted >= toDelete) break;
      store.delete(key);
      deleted++;
    }
  }
}

/**
 * Check and update rate limit for an identifier
 *
 * @param identifier - User ID, IP address, or other unique identifier
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and metadata
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = generateKey(config.keyPrefix || "default", identifier);
  const windowMs = config.windowSeconds * 1000;

  // Get or create entry
  let entry = store.get(key);

  // If entry doesn't exist or window has expired, create new entry
  if (!entry || now >= entry.resetAt) {
    evictIfNeeded();
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);

    return {
      allowed: true,
      current: 1,
      limit: config.limit,
      resetInSeconds: config.windowSeconds,
      remaining: config.limit - 1,
    };
  }

  // Window is still active
  const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      current: entry.count,
      limit: config.limit,
      resetInSeconds,
      remaining: 0,
    };
  }

  // Increment and allow
  entry.count++;
  store.set(key, entry);

  return {
    allowed: true,
    current: entry.count,
    limit: config.limit,
    resetInSeconds,
    remaining: config.limit - entry.count,
  };
}

/**
 * Get rate limit status without incrementing
 *
 * @param identifier - User ID, IP address, or other unique identifier
 * @param config - Rate limit configuration
 * @returns Current rate limit status
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = generateKey(config.keyPrefix || "default", identifier);

  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    return {
      allowed: true,
      current: 0,
      limit: config.limit,
      resetInSeconds: config.windowSeconds,
      remaining: config.limit,
    };
  }

  const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

  return {
    allowed: entry.count < config.limit,
    current: entry.count,
    limit: config.limit,
    resetInSeconds,
    remaining: Math.max(0, config.limit - entry.count),
  };
}

/**
 * Reset rate limit for an identifier
 * Useful for testing or admin overrides
 */
export function resetRateLimit(
  identifier: string,
  config: RateLimitConfig
): void {
  const key = generateKey(config.keyPrefix || "default", identifier);
  store.delete(key);
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIP(headers: Headers): string {
  // Check various headers in order of preference
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  const cfIP = headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP.trim();
  }

  return "unknown";
}

/**
 * Build rate limit headers for response
 */
export function buildRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetInSeconds),
  };
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearAllRateLimits(): void {
  store.clear();
}

/**
 * Get store size (for monitoring)
 */
export function getRateLimitStoreSize(): number {
  return store.size;
}
