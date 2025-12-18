import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  analyzeWithPerspective,
  isPerspectiveEnabled,
  getPerspectiveScores,
} from "@/lib/perspectiveModeration";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Perspective Moderation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isPerspectiveEnabled", () => {
    it("returns false when API key is not set", () => {
      delete process.env.PERSPECTIVE_API_KEY;
      expect(isPerspectiveEnabled()).toBe(false);
    });

    it("returns true when API key is set", () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";
      expect(isPerspectiveEnabled()).toBe(true);
    });
  });

  describe("analyzeWithPerspective", () => {
    it("allows content when API key is not configured", async () => {
      delete process.env.PERSPECTIVE_API_KEY;

      const result = await analyzeWithPerspective("Test content");
      expect(result.allowed).toBe(true);
      expect(result.error).toBe("Perspective API not configured");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("blocks content with high toxicity score", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.85 } },
              SEVERE_TOXICITY: { summaryScore: { value: 0.3 } },
            },
          }),
      });

      const result = await analyzeWithPerspective("Toxic content");
      expect(result.allowed).toBe(false);
      expect(result.scores?.toxicity).toBe(0.85);
    });

    it("blocks content with high severe toxicity score", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.4 } },
              SEVERE_TOXICITY: { summaryScore: { value: 0.6 } },
            },
          }),
      });

      const result = await analyzeWithPerspective("Severely toxic content");
      expect(result.allowed).toBe(false);
      expect(result.scores?.severeToxicity).toBe(0.6);
    });

    it("allows content with low toxicity scores", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.1 } },
              SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
              IDENTITY_ATTACK: { summaryScore: { value: 0.02 } },
              INSULT: { summaryScore: { value: 0.08 } },
              THREAT: { summaryScore: { value: 0.01 } },
            },
          }),
      });

      const result = await analyzeWithPerspective("Friendly message");
      expect(result.allowed).toBe(true);
      expect(result.scores).toBeDefined();
      expect(result.scores?.toxicity).toBe(0.1);
    });

    it("respects custom toxicity threshold from env", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";
      process.env.PERSPECTIVE_TOXICITY_THRESHOLD = "0.9";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.85 } },
              SEVERE_TOXICITY: { summaryScore: { value: 0.3 } },
            },
          }),
      });

      // 0.85 < 0.9, so should be allowed
      const result = await analyzeWithPerspective("Borderline content");
      expect(result.allowed).toBe(true);
    });

    it("allows content on API error (supplementary, not blocking)", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await analyzeWithPerspective("Test content");
      expect(result.allowed).toBe(true);
      expect(result.error).toBe("Network error");
    });

    it("allows content on non-200 response", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      });

      const result = await analyzeWithPerspective("Test content");
      expect(result.allowed).toBe(true);
      expect(result.error).toContain("500");
    });

    it("handles API error response format", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: {
              message: "Invalid request",
              code: 400,
            },
          }),
      });

      const result = await analyzeWithPerspective("Test content");
      expect(result.allowed).toBe(true);
      expect(result.error).toContain("Invalid request");
    });
  });

  describe("getPerspectiveScores", () => {
    it("returns null when Perspective is disabled", async () => {
      delete process.env.PERSPECTIVE_API_KEY;

      const scores = await getPerspectiveScores("Test content");
      expect(scores).toBeNull();
    });

    it("returns scores when Perspective is enabled", async () => {
      process.env.PERSPECTIVE_API_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.2 } },
              SEVERE_TOXICITY: { summaryScore: { value: 0.1 } },
            },
          }),
      });

      const scores = await getPerspectiveScores("Test content");
      expect(scores).toBeDefined();
      expect(scores?.toxicity).toBe(0.2);
      expect(scores?.severeToxicity).toBe(0.1);
    });
  });
});
