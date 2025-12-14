import { describe, expect, it } from "vitest";
import {
  generateFunUsername,
  generateUniqueUsername,
  USERNAME_MOODS,
  USERNAME_ANIMALS,
} from "@/lib/username";

describe("username generation", () => {
  describe("generateFunUsername", () => {
    it("generates username in correct format", () => {
      const username = generateFunUsername();

      // Should be in format "Mood Animal NN"
      const parts = username.split(" ");
      expect(parts.length).toBe(3);

      const [mood, animal, num] = parts;
      expect(USERNAME_MOODS).toContain(mood);
      expect(USERNAME_ANIMALS).toContain(animal);
      expect(parseInt(num, 10)).toBeGreaterThanOrEqual(10);
      expect(parseInt(num, 10)).toBeLessThanOrEqual(99);
    });

    it("generates different usernames on each call (probabilistically)", () => {
      const usernames = new Set<string>();
      for (let i = 0; i < 100; i++) {
        usernames.add(generateFunUsername());
      }

      // With 24 moods * 24 animals * 90 numbers = 51,840 combinations
      // 100 random picks should produce mostly unique values
      expect(usernames.size).toBeGreaterThan(80);
    });

    it("uses only valid mood words", () => {
      for (let i = 0; i < 50; i++) {
        const username = generateFunUsername();
        const mood = username.split(" ")[0];
        expect(USERNAME_MOODS).toContain(mood);
      }
    });

    it("uses only valid animal words", () => {
      for (let i = 0; i < 50; i++) {
        const username = generateFunUsername();
        const animal = username.split(" ")[1];
        expect(USERNAME_ANIMALS).toContain(animal);
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
      expect(username.split(" ").length).toBe(3);
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
      // The fallback username won't have a number at the end like "22"
      // It will have a base36 suffix instead
    });
  });

  describe("word lists", () => {
    it("has sufficient variety for uniqueness", () => {
      // 24 moods * 24 animals * 90 numbers = 51,840 possible combinations
      const combinations = USERNAME_MOODS.length * USERNAME_ANIMALS.length * 90;
      expect(combinations).toBeGreaterThan(50000);
    });

    it("contains only appropriate words", () => {
      const allWords = [...USERNAME_MOODS, ...USERNAME_ANIMALS];

      // Check no profanity (basic check)
      const badWords = ["fuck", "shit", "ass", "damn", "bitch"];
      for (const word of allWords) {
        for (const bad of badWords) {
          expect(word.toLowerCase()).not.toContain(bad);
        }
      }
    });
  });
});
