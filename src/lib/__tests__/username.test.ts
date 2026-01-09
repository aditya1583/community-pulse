import { describe, expect, it } from "vitest";
import {
  generateFunUsername,
  generateUniqueUsername,
  containsProfanity,
  sanitizeForUsername,
  USERNAME_ADJECTIVES,
  USERNAME_NOUNS,
} from "@/lib/username";

describe("username generation", () => {
  describe("generateFunUsername", () => {
    it("generates username in PascalCase format without spaces", () => {
      const username = generateFunUsername();

      // Should be PascalCase with no spaces (e.g., "ChillOtter42")
      expect(username).not.toContain(" ");
      expect(username).toMatch(/^[A-Z][a-zA-Z]+[A-Z][a-zA-Z]+\d{2}$/);
    });

    it("generates different usernames on each call (probabilistically)", () => {
      const usernames = new Set<string>();
      for (let i = 0; i < 100; i++) {
        usernames.add(generateFunUsername());
      }

      // With expanded word lists, should produce mostly unique values
      expect(usernames.size).toBeGreaterThan(80);
    });

    it("ends with a 2-digit number", () => {
      for (let i = 0; i < 50; i++) {
        const username = generateFunUsername();
        const num = parseInt(username.slice(-2), 10);
        expect(num).toBeGreaterThanOrEqual(10);
        expect(num).toBeLessThanOrEqual(99);
      }
    });
  });

  describe("generateUniqueUsername", () => {
    it("returns unique username when first attempt succeeds", async () => {
      // Mock supabase that always returns "not found" (username is unique)
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        }),
      };

      const username = await generateUniqueUsername(mockSupabase);
      expect(username).toBeTruthy();
      expect(username).not.toContain(" ");
    });

    it("retries on collision and eventually finds unique name", async () => {
      let callCount = 0;

      // Mock supabase that returns "found" first 3 times, then "not found"
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => {
                callCount++;
                if (callCount <= 3) {
                  // Username exists
                  return Promise.resolve({ data: { id: "existing" }, error: null });
                }
                // Username is unique
                return Promise.resolve({ data: null, error: { code: "PGRST116" } });
              },
            }),
          }),
        }),
      };

      const username = await generateUniqueUsername(mockSupabase);
      expect(username).toBeTruthy();
      expect(callCount).toBe(4);
    });

    it("falls back to unique suffix after max attempts", async () => {
      // Mock supabase that always returns "found" (all usernames taken)
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "existing" }, error: null }),
            }),
          }),
        }),
      };

      const username = await generateUniqueUsername(mockSupabase, 5);

      // Fallback format removes trailing number and adds unique suffix
      expect(username).toBeTruthy();
      expect(username).not.toContain(" ");
    });
  });

  describe("profanity detection", () => {
    it("detects common profanity", () => {
      expect(containsProfanity("fuck")).toBe(true);
      expect(containsProfanity("FUCK")).toBe(true);
      expect(containsProfanity("FuCk")).toBe(true);
      expect(containsProfanity("shit")).toBe(true);
      expect(containsProfanity("ass")).toBe(true);
    });

    it("detects obfuscated profanity", () => {
      expect(containsProfanity("fuk")).toBe(true);
      expect(containsProfanity("f@ck")).toBe(true);
      expect(containsProfanity("sh1t")).toBe(true);
      expect(containsProfanity("a$$")).toBe(true);
    });

    it("allows clean words", () => {
      expect(containsProfanity("happy")).toBe(false);
      expect(containsProfanity("sunshine")).toBe(false);
      expect(containsProfanity("chill vibes")).toBe(false);
      expect(containsProfanity("coffee lover")).toBe(false);
    });

    it("detects profanity within longer text", () => {
      expect(containsProfanity("what the fuck")).toBe(true);
      expect(containsProfanity("holy shit man")).toBe(true);
    });
  });

  describe("sanitizeForUsername", () => {
    it("removes profane words from input", () => {
      const result = sanitizeForUsername("fucking fucker mama");
      expect(result).not.toContain("fucking");
      expect(result).not.toContain("fucker");
      expect(result).toContain("mama");
    });

    it("keeps clean words", () => {
      const result = sanitizeForUsername("happy coffee lover");
      expect(result).toEqual(["happy", "coffee", "lover"]);
    });

    it("returns empty array for all-profane input", () => {
      const result = sanitizeForUsername("fuck shit damn");
      expect(result).toEqual([]);
    });

    it("removes special characters but keeps word structure", () => {
      const result = sanitizeForUsername("hello! world? test123");
      expect(result.length).toBe(3);
    });
  });

  describe("word lists", () => {
    it("has sufficient variety for uniqueness", () => {
      // Expanded: more adjectives * more nouns * 90 numbers
      const combinations = USERNAME_ADJECTIVES.length * USERNAME_NOUNS.length * 90;
      expect(combinations).toBeGreaterThan(100000);
    });

    it("contains only appropriate words", () => {
      const allWords = [...USERNAME_ADJECTIVES, ...USERNAME_NOUNS];

      // Check no profanity using the actual profanity filter
      // This is better than substring matching which would flag "Sassy" for containing "ass"
      for (const word of allWords) {
        expect(containsProfanity(word)).toBe(false);
      }
    });

    it("has expanded adjective list", () => {
      expect(USERNAME_ADJECTIVES.length).toBeGreaterThan(24);
      expect(USERNAME_ADJECTIVES).toContain("Caffeinated");
      expect(USERNAME_ADJECTIVES).toContain("Cosmic");
    });

    it("has expanded noun list", () => {
      expect(USERNAME_NOUNS.length).toBeGreaterThan(24);
      expect(USERNAME_NOUNS).toContain("Narwhal");
      expect(USERNAME_NOUNS).toContain("Phoenix");
      expect(USERNAME_NOUNS).toContain("Wizard");
    });
  });
});
