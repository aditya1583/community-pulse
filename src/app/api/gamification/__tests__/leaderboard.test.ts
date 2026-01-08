import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Gamification Leaderboard API Route Tests
 *
 * Tests for the /api/gamification/leaderboard endpoint
 * Focus on parameter validation and configuration errors
 */

// Mock Supabase client - simplified for validation tests
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockImplementation(() => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    return {
      from: vi.fn().mockReturnValue(mockChain),
    };
  }),
}));

// Import after mocks
import { GET } from "../leaderboard/route";

describe("/api/gamification/leaderboard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createRequest(params: Record<string, string> = {}): NextRequest {
    const url = new URL("http://localhost/api/gamification/leaderboard");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  }

  describe("parameter validation", () => {
    it("returns 400 for invalid period", async () => {
      const request = createRequest({ period: "invalid" });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid period. Must be weekly, monthly, or alltime.");
    });

    it("accepts weekly period", async () => {
      const request = createRequest({ period: "weekly" });
      const response = await GET(request);

      // Should not return 400 for valid period
      expect(response.status).not.toBe(400);
    });

    it("accepts monthly period", async () => {
      const request = createRequest({ period: "monthly" });
      const response = await GET(request);

      expect(response.status).not.toBe(400);
    });

    it("accepts alltime period", async () => {
      const request = createRequest({ period: "alltime" });
      const response = await GET(request);

      expect(response.status).not.toBe(400);
    });
  });

  describe("database configuration", () => {
    it("returns 500 when Supabase URL is not configured", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const request = createRequest({});
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database configuration error");
    });

    it("returns 500 when Supabase key is not configured", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const request = createRequest({});
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database configuration error");
    });
  });

  describe("query parameters", () => {
    it("accepts city filter parameter", async () => {
      const request = createRequest({ city: "Austin" });
      const response = await GET(request);

      // Should process without 400 error
      expect(response.status).not.toBe(400);
    });

    it("accepts userId parameter", async () => {
      const request = createRequest({ userId: "test-user-id" });
      const response = await GET(request);

      expect(response.status).not.toBe(400);
    });

    it("accepts limit parameter", async () => {
      const request = createRequest({ limit: "50" });
      const response = await GET(request);

      expect(response.status).not.toBe(400);
    });

    it("handles invalid limit gracefully", async () => {
      const request = createRequest({ limit: "not-a-number" });
      const response = await GET(request);

      // Should use default limit, not error
      expect(response.status).not.toBe(400);
    });
  });
});
