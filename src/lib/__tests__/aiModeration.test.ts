import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Create a persistent mock for the Anthropic SDK
const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Import after mocks
import {
  moderateWithAI,
  moderateContentWithAI,
  clearModerationCache,
  getModerationCacheStats,
} from "@/lib/aiModeration";

describe("AI Moderation - moderateWithAI", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    process.env.MODERATION_FAIL_OPEN = "false";
    mockCreate.mockReset();
    clearModerationCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * Helper to create a mock Haiku moderation response
   */
  function createHaikuResponse(
    decision: "ALLOW" | "BLOCK",
    category: string,
    confidence: number,
    reason?: string
  ) {
    const response: { decision: string; category: string; confidence: number; reason?: string } = {
      decision,
      category,
      confidence,
    };
    if (reason) {
      response.reason = reason;
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response),
        },
      ],
    };
  }

  function mockSuccessfulResponse(
    decision: "ALLOW" | "BLOCK",
    category: string,
    confidence: number,
    reason?: string
  ) {
    mockCreate.mockResolvedValueOnce(
      createHaikuResponse(decision, category, confidence, reason)
    );
  }

  describe("blocks obfuscated profanity", () => {
    it("blocks 'ASSOHLE' (transposition)", async () => {
      mockSuccessfulResponse("BLOCK", "profanity", 0.95, "Transposed profanity detected");

      const result = await moderateWithAI("ASSOHLE");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Please keep your message friendly and respectful.");
    });

    it("blocks 'sister f#*er' (obfuscated insult)", async () => {
      mockSuccessfulResponse("BLOCK", "harassment", 0.9, "Obfuscated insult");

      const result = await moderateWithAI("sister f#*er");
      expect(result.allowed).toBe(false);
    });
  });

  describe("blocks sexual solicitation", () => {
    it("blocks 'body rub massage parlor'", async () => {
      mockSuccessfulResponse("BLOCK", "sexual_solicitation", 0.95, "Adult services ad");

      const result = await moderateWithAI("body rub massage parlor on hwy 183. Enjoy!");
      expect(result.allowed).toBe(false);
      expect(result._debug?.category).toBe("sexual_solicitation");
    });

    it("blocks 'Stacy is hot and sexy'", async () => {
      mockSuccessfulResponse("BLOCK", "sexual_solicitation", 0.9, "Objectifying comment");

      const result = await moderateWithAI("Stacy is hot and sexy");
      expect(result.allowed).toBe(false);
    });

    it("blocks 'car date ayone?' (typo-tolerant)", async () => {
      mockSuccessfulResponse("BLOCK", "sexual_solicitation", 0.92, "Solicitation with typo");

      const result = await moderateWithAI("car date ayone?");
      expect(result.allowed).toBe(false);
    });

    it("blocks 'looking for fun tonight'", async () => {
      mockSuccessfulResponse("BLOCK", "sexual_solicitation", 0.88, "Escort-style language");

      const result = await moderateWithAI("looking for fun tonight");
      expect(result.allowed).toBe(false);
    });
  });

  describe("blocks spam and nonsense", () => {
    it("blocks symbol spam '&*&^^%*&% Steve!'", async () => {
      mockSuccessfulResponse("BLOCK", "spam", 0.95, "Symbol spam detected");

      const result = await moderateWithAI("&*&^^%*&% Steve!");
      expect(result.allowed).toBe(false);
      expect(result._debug?.category).toBe("spam");
    });

    it("blocks keyboard mashing", async () => {
      mockSuccessfulResponse("BLOCK", "spam", 0.98, "Nonsense text");

      const result = await moderateWithAI("asdfjkl;qwerty");
      expect(result.allowed).toBe(false);
    });
  });

  describe("blocks multilingual profanity", () => {
    it("blocks Spanish profanity 'Mierda'", async () => {
      mockSuccessfulResponse("BLOCK", "profanity", 0.85, "Spanish profanity");

      const result = await moderateWithAI("Mierda");
      expect(result.allowed).toBe(false);
    });

    it("blocks 'go f your mother' (harassment)", async () => {
      mockSuccessfulResponse("BLOCK", "harassment", 0.95);

      const result = await moderateWithAI("go f your mother");
      expect(result.allowed).toBe(false);
    });

    it("blocks non-Latin script profanity sample", async () => {
      mockSuccessfulResponse("BLOCK", "harassment", 0.82, "Non-Latin profanity");

      const result = await moderateWithAI("Test non-Latin profanity");
      expect(result.allowed).toBe(false);
    });
  });

  describe("allows friendly messages", () => {
    it("allows 'How is it going?'", async () => {
      mockSuccessfulResponse("ALLOW", "clean", 0.98);

      const result = await moderateWithAI("How is it going?");
      expect(result.allowed).toBe(true);
    });

    it("allows 'Traffic is heavy on 183'", async () => {
      mockSuccessfulResponse("ALLOW", "clean", 0.99);

      const result = await moderateWithAI("Traffic is heavy on 183");
      expect(result.allowed).toBe(true);
    });

    it("allows normal community messages", async () => {
      mockSuccessfulResponse("ALLOW", "clean", 0.97);

      const result = await moderateWithAI("Beautiful weather today in Austin!");
      expect(result.allowed).toBe(true);
    });

    it("allows 'Anyone know if the farmer's market is open today?'", async () => {
      mockSuccessfulResponse("ALLOW", "clean", 0.96);

      const result = await moderateWithAI("Anyone know if the farmer's market is open today?");
      expect(result.allowed).toBe(true);
    });

    it("allows 'Beautiful sunset over downtown!'", async () => {
      mockSuccessfulResponse("ALLOW", "clean", 0.99);

      const result = await moderateWithAI("Beautiful sunset over downtown!");
      expect(result.allowed).toBe(true);
    });
  });

  describe("category-based blocking", () => {
    it("blocks hate speech", async () => {
      mockSuccessfulResponse("BLOCK", "hate", 0.92);

      const result = await moderateWithAI("Hate speech content");
      expect(result.allowed).toBe(false);
      expect(result._debug?.category).toBe("hate");
    });

    it("blocks dangerous content", async () => {
      mockSuccessfulResponse("BLOCK", "dangerous", 0.95, "Threat detected");

      const result = await moderateWithAI("Dangerous content");
      expect(result.allowed).toBe(false);
    });

    it("blocks contact solicitation", async () => {
      mockSuccessfulResponse("BLOCK", "contact_solicitation", 0.88, "Off-platform contact request");

      const result = await moderateWithAI("DM me for a good time");
      expect(result.allowed).toBe(false);
    });
  });

  describe("fail-safe behavior", () => {
    it("fails closed when Haiku API throws (default)", async () => {
      mockCreate.mockRejectedValueOnce(new Error("API error"));

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Please keep your message friendly and respectful.");
      // Should indicate this is a service error for route to return 503
      expect(result.serviceError).toBe(true);
    });

    it("fails closed when ANTHROPIC_API_KEY is missing (default)", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      clearModerationCache();

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(false);
      expect(result.serviceError).toBe(true);
    });

    it("fails open when MODERATION_FAIL_OPEN=true and API throws (non-production)", async () => {
      process.env.MODERATION_FAIL_OPEN = "true";
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      clearModerationCache();
      mockCreate.mockRejectedValueOnce(new Error("Network error"));

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(true);
    });

    it("fails open when MODERATION_FAIL_OPEN=true and no API key (non-production)", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.MODERATION_FAIL_OPEN = "true";
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      clearModerationCache();

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(true);
    });

    it("handles invalid response format gracefully", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "This is not valid JSON",
          },
        ],
      });

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(false); // Fail closed on unexpected response
      expect(result.serviceError).toBe(true);
    });

    it("handles empty response gracefully", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [],
      });

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(false); // Fail closed on unexpected response
      expect(result.serviceError).toBe(true);
    });

    /**
     * PRODUCTION SAFETY LOCK TEST
     * This is the NON-NEGOTIABLE principle: Production ALWAYS fails closed
     * regardless of MODERATION_FAIL_OPEN env var setting.
     */
    it("PRODUCTION: always fails closed even when MODERATION_FAIL_OPEN=true", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.MODERATION_FAIL_OPEN = "true"; // Should be IGNORED in production
      clearModerationCache();
      mockCreate.mockRejectedValueOnce(new Error("API timeout"));

      const result = await moderateWithAI("Test message");

      // CRITICAL: Must fail closed in production, ignoring MODERATION_FAIL_OPEN
      expect(result.allowed).toBe(false);
      expect(result.serviceError).toBe(true);
    });

    it("PRODUCTION: fails closed when API key is missing despite MODERATION_FAIL_OPEN=true", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.MODERATION_FAIL_OPEN = "true"; // Should be IGNORED in production
      clearModerationCache();

      const result = await moderateWithAI("Test message");

      // CRITICAL: Must fail closed in production
      expect(result.allowed).toBe(false);
      expect(result.serviceError).toBe(true);
    });
  });

  describe("caching behavior", () => {
    it("caches moderation results", async () => {
      mockSuccessfulResponse("ALLOW", "clean", 0.95);

      // First call
      await moderateWithAI("Test content");
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await moderateWithAI("Test content");
      expect(mockCreate).toHaveBeenCalledTimes(1); // No additional API call
      expect(result.allowed).toBe(true);
      expect(result._debug?.cacheHit).toBe(true);
    });

    it("clearModerationCache clears the cache", async () => {
      mockSuccessfulResponse("ALLOW", "clean", 0.95);

      await moderateWithAI("Test content");
      expect(getModerationCacheStats().size).toBe(1);

      clearModerationCache();
      expect(getModerationCacheStats().size).toBe(0);
    });
  });

  describe("timeout and retry", () => {
    it("handles timeout gracefully", async () => {
      // Simulate timeout error
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "APIConnectionTimeoutError";
      mockCreate.mockRejectedValueOnce(timeoutError);

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(false); // Fail closed
      expect(result.serviceError).toBe(true);
    });

    it("retries on non-timeout errors", async () => {
      // First call fails
      mockCreate.mockRejectedValueOnce(new Error("Network error"));
      // Second call (retry) succeeds
      mockSuccessfulResponse("ALLOW", "clean", 0.95);

      const result = await moderateWithAI("Test message");
      expect(result.allowed).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(2); // Original + 1 retry
    });
  });
});

describe("AI Moderation - moderateContentWithAI (combined)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    process.env.MODERATION_FAIL_OPEN = "false";
    mockCreate.mockReset();
    clearModerationCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("blocks content that fails local moderation without calling AI", async () => {
    const localModerate = vi.fn().mockReturnValue({
      allowed: false,
      reason: "Local: profanity detected",
    });

    const result = await moderateContentWithAI("explicit word", localModerate);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Local: profanity detected");
    expect(mockCreate).not.toHaveBeenCalled(); // AI not called
  });

  it("calls AI moderation when local moderation passes", async () => {
    const localModerate = vi.fn().mockReturnValue({ allowed: true });
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            decision: "ALLOW",
            category: "clean",
            confidence: 0.95,
          }),
        },
      ],
    });

    const result = await moderateContentWithAI("Friendly message", localModerate);

    expect(result.allowed).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("blocks content that passes local but fails AI moderation", async () => {
    const localModerate = vi.fn().mockReturnValue({ allowed: true });
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            decision: "BLOCK",
            category: "sexual_solicitation",
            confidence: 0.92,
            reason: "Adult services solicitation",
          }),
        },
      ],
    });

    const result = await moderateContentWithAI("body rub massage parlor", localModerate);

    expect(result.allowed).toBe(false);
    expect(localModerate).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
  });
});

describe("AI Moderation - specific bypass attempts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    mockCreate.mockReset();
    clearModerationCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const bypassAttempts = [
    { input: "ASSOHLE", description: "letter transposition" },
    { input: "a s s h o l e", description: "spaced letters" },
    { input: "f u c k", description: "spaced profanity" },
    { input: "Mierda", description: "Spanish profanity" },
    { input: "go f your mother", description: "partial censoring" },
    { input: "sister f#*er", description: "symbol obfuscation" },
    { input: "@$$hole", description: "leetspeak" },
    { input: "fvck", description: "vowel substitution" },
    { input: "sh1t", description: "number substitution" },
    { input: "body rub massage parlor", description: "sexual solicitation" },
    { input: "car date ayone?", description: "typo bypass" },
    { input: "&*&^^%*&% Steve!", description: "symbol spam" },
  ];

  for (const { input, description } of bypassAttempts) {
    it(`processes ${description}: "${input}"`, async () => {
      // Mock Haiku detecting the problematic content
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              decision: "BLOCK",
              category: "harassment",
              confidence: 0.9,
              reason: `Detected ${description}`,
            }),
          },
        ],
      });

      const result = await moderateWithAI(input);
      // The test verifies the function correctly processes the input
      // and returns a result (blocked because we mocked decision=BLOCK)
      expect(result.allowed).toBe(false);
    });
  }
});

describe("AI Moderation - confidence levels", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    mockCreate.mockReset();
    clearModerationCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("includes confidence in debug info for ALLOW decisions", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            decision: "ALLOW",
            category: "clean",
            confidence: 0.97,
          }),
        },
      ],
    });

    const result = await moderateWithAI("Normal message");
    expect(result._debug?.confidence).toBe(0.97);
    expect(result._debug?.decision).toBe("ALLOW");
  });

  it("includes confidence in debug info for BLOCK decisions", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            decision: "BLOCK",
            category: "spam",
            confidence: 0.88,
            reason: "Symbol spam",
          }),
        },
      ],
    });

    const result = await moderateWithAI("&&&&####");
    expect(result._debug?.confidence).toBe(0.88);
    expect(result._debug?.decision).toBe("BLOCK");
    expect(result._debug?.reason).toBe("Symbol spam");
  });
});
