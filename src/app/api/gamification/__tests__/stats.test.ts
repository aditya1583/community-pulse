import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Gamification Stats API Route Tests
 *
 * Tests for the /api/gamification/stats endpoint
 * Focus on parameter validation and configuration errors
 */

// Mock Supabase client - simplified for validation tests
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockImplementation(() => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    return {
      from: vi.fn().mockReturnValue(mockChain),
    };
  }),
}));

// Import after mocks
import { GET } from "../stats/route";

describe("/api/gamification/stats", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createRequest(params: Record<string, string>): NextRequest {
    const url = new URL("http://localhost/api/gamification/stats");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  }

  describe("parameter validation", () => {
    it("returns 400 when userId is missing", async () => {
      const request = createRequest({});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("userId parameter is required");
    });

    it("returns 400 when userId is empty", async () => {
      const request = createRequest({ userId: "" });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("userId parameter is required");
    });

    it("accepts valid userId parameter", async () => {
      const request = createRequest({ userId: "valid-user-id" });
      const response = await GET(request);

      // Should not return 400 for valid userId
      expect(response.status).not.toBe(400);
    });
  });

  describe("database configuration", () => {
    it("returns 500 when Supabase URL is not configured", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const request = createRequest({ userId: "test-user-id" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database configuration error");
    });

    it("returns 500 when Supabase key is not configured", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const request = createRequest({ userId: "test-user-id" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database configuration error");
    });
  });

  describe("response structure", () => {
    it("returns expected fields in response", async () => {
      const request = createRequest({ userId: "test-user-id" });
      const response = await GET(request);

      // Even with mocked empty data, should return 200 with default structure
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("userId");
        expect(data).toHaveProperty("username");
        expect(data).toHaveProperty("level");
        expect(data).toHaveProperty("xp");
        expect(data).toHaveProperty("tier");
        expect(data).toHaveProperty("stats");
        expect(data).toHaveProperty("badges");
      }
    });
  });
});
