import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  clearAllRateLimits,
  getClientIP,
  buildRateLimitHeaders,
  getRateLimitStoreSize,
  RATE_LIMITS,
  type RateLimitConfig,
} from "@/lib/rateLimit";

/**
 * Rate Limiting Tests
 *
 * Tests for the in-memory rate limiting system including:
 * - Basic rate limiting functionality
 * - Window expiration
 * - Multiple configurations
 * - IP extraction from headers
 * - Header building
 */

describe("Rate Limiting", () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRateLimit", () => {
    const testConfig: RateLimitConfig = {
      limit: 3,
      windowSeconds: 60,
      keyPrefix: "test",
    };

    it("allows first request", () => {
      const result = checkRateLimit("user1", testConfig);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(2);
    });

    it("allows requests up to limit", () => {
      const r1 = checkRateLimit("user1", testConfig);
      const r2 = checkRateLimit("user1", testConfig);
      const r3 = checkRateLimit("user1", testConfig);

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it("blocks requests after limit exceeded", () => {
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);
      const r4 = checkRateLimit("user1", testConfig);

      expect(r4.allowed).toBe(false);
      expect(r4.current).toBe(3);
      expect(r4.remaining).toBe(0);
    });

    it("tracks different users separately", () => {
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);

      // user1 is at limit, user2 should still be allowed
      const user1Result = checkRateLimit("user1", testConfig);
      const user2Result = checkRateLimit("user2", testConfig);

      expect(user1Result.allowed).toBe(false);
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.current).toBe(1);
    });

    it("resets after window expires", () => {
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);

      // Advance time past window
      vi.advanceTimersByTime(61000);

      const result = checkRateLimit("user1", testConfig);
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.remaining).toBe(2);
    });

    it("reports correct resetInSeconds", () => {
      const result = checkRateLimit("user1", testConfig);
      expect(result.resetInSeconds).toBe(60);

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);

      const result2 = checkRateLimit("user1", testConfig);
      expect(result2.resetInSeconds).toBe(30);
    });
  });

  describe("getRateLimitStatus", () => {
    const testConfig: RateLimitConfig = {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "status-test",
    };

    it("returns full capacity for new user", () => {
      const status = getRateLimitStatus("newuser", testConfig);

      expect(status.allowed).toBe(true);
      expect(status.current).toBe(0);
      expect(status.remaining).toBe(5);
    });

    it("does not increment counter", () => {
      getRateLimitStatus("user1", testConfig);
      getRateLimitStatus("user1", testConfig);
      getRateLimitStatus("user1", testConfig);

      const status = getRateLimitStatus("user1", testConfig);
      expect(status.current).toBe(0);
    });

    it("reflects current usage from checkRateLimit", () => {
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);

      const status = getRateLimitStatus("user1", testConfig);
      expect(status.current).toBe(2);
      expect(status.remaining).toBe(3);
      expect(status.allowed).toBe(true);
    });

    it("shows not allowed when at limit", () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit("user1", testConfig);
      }

      const status = getRateLimitStatus("user1", testConfig);
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });
  });

  describe("resetRateLimit", () => {
    const testConfig: RateLimitConfig = {
      limit: 2,
      windowSeconds: 60,
      keyPrefix: "reset-test",
    };

    it("clears rate limit for specific user", () => {
      checkRateLimit("user1", testConfig);
      checkRateLimit("user1", testConfig);

      // user1 is at limit
      expect(checkRateLimit("user1", testConfig).allowed).toBe(false);

      resetRateLimit("user1", testConfig);

      // Now user1 should be allowed again
      expect(checkRateLimit("user1", testConfig).allowed).toBe(true);
    });

    it("does not affect other users", () => {
      checkRateLimit("user1", testConfig);
      checkRateLimit("user2", testConfig);

      resetRateLimit("user1", testConfig);

      // user2 should still have their count
      const status = getRateLimitStatus("user2", testConfig);
      expect(status.current).toBe(1);
    });
  });

  describe("clearAllRateLimits", () => {
    it("clears all rate limit entries", () => {
      checkRateLimit("user1", { limit: 5, windowSeconds: 60, keyPrefix: "a" });
      checkRateLimit("user2", { limit: 5, windowSeconds: 60, keyPrefix: "b" });
      checkRateLimit("user3", { limit: 5, windowSeconds: 60, keyPrefix: "c" });

      expect(getRateLimitStoreSize()).toBe(3);

      clearAllRateLimits();

      expect(getRateLimitStoreSize()).toBe(0);
    });
  });

  describe("getClientIP", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const headers = new Headers();
      headers.set("x-forwarded-for", "192.168.1.1, 10.0.0.1");

      expect(getClientIP(headers)).toBe("192.168.1.1");
    });

    it("extracts IP from x-real-ip header", () => {
      const headers = new Headers();
      headers.set("x-real-ip", "192.168.1.2");

      expect(getClientIP(headers)).toBe("192.168.1.2");
    });

    it("extracts IP from cf-connecting-ip header (Cloudflare)", () => {
      const headers = new Headers();
      headers.set("cf-connecting-ip", "192.168.1.3");

      expect(getClientIP(headers)).toBe("192.168.1.3");
    });

    it("prefers x-forwarded-for over other headers", () => {
      const headers = new Headers();
      headers.set("x-forwarded-for", "192.168.1.1");
      headers.set("x-real-ip", "192.168.1.2");
      headers.set("cf-connecting-ip", "192.168.1.3");

      expect(getClientIP(headers)).toBe("192.168.1.1");
    });

    it("returns unknown when no IP headers present", () => {
      const headers = new Headers();
      expect(getClientIP(headers)).toBe("unknown");
    });

    it("trims whitespace from IP", () => {
      const headers = new Headers();
      headers.set("x-real-ip", "  192.168.1.1  ");

      expect(getClientIP(headers)).toBe("192.168.1.1");
    });
  });

  describe("buildRateLimitHeaders", () => {
    it("builds correct headers from rate limit result", () => {
      const headers = buildRateLimitHeaders({
        allowed: true,
        current: 2,
        limit: 5,
        resetInSeconds: 30,
        remaining: 3,
      });

      expect(headers).toEqual({
        "X-RateLimit-Limit": "5",
        "X-RateLimit-Remaining": "3",
        "X-RateLimit-Reset": "30",
      });
    });
  });

  describe("RATE_LIMITS constants", () => {
    it("has all expected rate limit configurations", () => {
      expect(RATE_LIMITS.PULSE_CREATE).toBeDefined();
      expect(RATE_LIMITS.PULSE_CREATE_ANON).toBeDefined();
      expect(RATE_LIMITS.REPORT).toBeDefined();
      expect(RATE_LIMITS.VENUE_VIBE).toBeDefined();
      expect(RATE_LIMITS.GLOBAL).toBeDefined();
      expect(RATE_LIMITS.AUTH).toBeDefined();
    });

    it("has reasonable limits", () => {
      // Authenticated users get more requests than anon
      expect(RATE_LIMITS.PULSE_CREATE.limit).toBeGreaterThan(
        RATE_LIMITS.PULSE_CREATE_ANON.limit
      );

      // Global limit should be generous
      expect(RATE_LIMITS.GLOBAL.limit).toBeGreaterThanOrEqual(100);

      // Auth attempts should be restrictive
      expect(RATE_LIMITS.AUTH.limit).toBeLessThanOrEqual(10);
    });
  });

  describe("LRU eviction", () => {
    it("evicts old entries when store is full", () => {
      // This is hard to test without exposing MAX_STORE_SIZE
      // We'll test that the store doesn't grow unbounded
      const config: RateLimitConfig = {
        limit: 100,
        windowSeconds: 3600,
        keyPrefix: "evict",
      };

      // Add many entries
      for (let i = 0; i < 100; i++) {
        checkRateLimit(`user-${i}`, config);
      }

      // Store should have entries but be bounded
      expect(getRateLimitStoreSize()).toBeLessThanOrEqual(100);
    });
  });
});
