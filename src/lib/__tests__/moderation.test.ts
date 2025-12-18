import { describe, expect, it } from "vitest";
import {
  moderateContent,
  serverModerateContent,
  PROFANITY_LIST_FOR_TESTING,
} from "@/lib/moderation";

/**
 * Local Moderation Tests
 *
 * These tests verify the LOCAL heuristic moderation layer.
 * This is a fast first-pass that catches obvious explicit English profanity.
 *
 * NOTE: The local moderation is NOT meant to catch everything!
 * Obfuscated content and multilingual profanity are handled by AI moderation.
 * See aiModeration.test.ts for those tests.
 */
describe("content moderation (local heuristics)", () => {
  describe("moderateContent", () => {
    it("allows clean content", () => {
      expect(moderateContent("Hello, great weather today!").allowed).toBe(true);
      expect(moderateContent("Traffic is light on I-35").allowed).toBe(true);
      expect(moderateContent("The sunset is beautiful").allowed).toBe(true);
      expect(moderateContent("Having a good day at work").allowed).toBe(true);
    });

    it("blocks explicit profanity", () => {
      // Test a few key profanity words
      expect(moderateContent("What the fuck").allowed).toBe(false);
      expect(moderateContent("This is bullshit").allowed).toBe(false);
      expect(moderateContent("You're an asshole").allowed).toBe(false);
      expect(moderateContent("That's so damn annoying").allowed).toBe(false);
    });

    it("blocks profanity regardless of case", () => {
      expect(moderateContent("FUCK THIS").allowed).toBe(false);
      expect(moderateContent("Fuck This").allowed).toBe(false);
      expect(moderateContent("fUcK tHiS").allowed).toBe(false);
    });

    it("blocks slurs and hate speech", () => {
      expect(moderateContent("You're a faggot").allowed).toBe(false);
      expect(moderateContent("Those niggers").allowed).toBe(false);
      expect(moderateContent("Stupid retard").allowed).toBe(false);
    });

    it("blocks some threatening language patterns", () => {
      // These patterns are explicitly in ABUSE_PATTERNS
      expect(moderateContent("I'll kill you").allowed).toBe(false);
      expect(moderateContent("kill yourself").allowed).toBe(false);
      expect(moderateContent("go die").allowed).toBe(false);
      expect(moderateContent("kys loser").allowed).toBe(false);
      // Note: Some edge cases like "hope you die" may slip through local checks
      // but will be caught by AI moderation
    });

    it("requires non-empty content", () => {
      expect(moderateContent("").allowed).toBe(false);
      expect(moderateContent("   ").allowed).toBe(false);
    });

    it("handles null/undefined gracefully", () => {
      expect(moderateContent(null as unknown as string).allowed).toBe(false);
      expect(moderateContent(undefined as unknown as string).allowed).toBe(false);
    });

    it("provides friendly error messages", () => {
      const result = moderateContent("fuck this");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(result.reason).not.toContain("fuck"); // Don't echo the bad word
    });

    it("doesn't false-positive on similar words", () => {
      // "grass" should not match "ass"
      expect(moderateContent("The grass is green").allowed).toBe(true);
      // "class" should not match "ass"
      expect(moderateContent("Going to class").allowed).toBe(true);
      // "shellfish" should not match "shit"
      expect(moderateContent("I like shellfish").allowed).toBe(true);
      // "scunthorpe" should match "cunt" (known issue, acceptable trade-off)
      // Note: This is a known problem in profanity filtering
    });
  });

  describe("serverModerateContent", () => {
    it("is the same as moderateContent (server-side authoritative)", () => {
      expect(serverModerateContent("Hello world").allowed).toBe(true);
      expect(serverModerateContent("fuck").allowed).toBe(false);
    });

    it("blocks solicitation / dating / hookup posts (policy rule)", () => {
      const blocked = [
        "car date anyone?",
        "date anyone?",
        "anyone up for a date",
        "looking for a hookup",
        "fwb?",
        "let's have sex",
        "meet me tonight",
        "send nudes",
      ];

      for (const text of blocked) {
        const result = serverModerateContent(text);
        if (result.allowed) {
          throw new Error(`Expected blocked but allowed: "${text}"`);
        }
      }
    });

    it("allows non-solicitation mentions like 'date night at the restaurant was great'", () => {
      expect(serverModerateContent("date night at the restaurant was great").allowed).toBe(true);
    });

    it("blocks harassment even with shorthand profanity", () => {
      expect(serverModerateContent("go f off sucker").allowed).toBe(false);
      expect(serverModerateContent("go f your mother").allowed).toBe(false);
      expect(serverModerateContent("f you").allowed).toBe(false);
    });

    it("blocks spaced profanity attempts", () => {
      // Spaced letters are caught by OBFUSCATED_PROFANITY_PATTERNS
      expect(serverModerateContent("m o t h e r f u c k e r").allowed).toBe(false);
      // Note: Symbol obfuscation like "m*therf*cker" may slip through local
      // checks but will be caught by AI moderation
    });

    it("blocks common misspellings with lightweight fuzzy match", () => {
      expect(serverModerateContent("assole").allowed).toBe(false);
    });

    it("blocks the observed failure strings (harassment sequences)", () => {
      expect(serverModerateContent("go f off sucker").allowed).toBe(false);
      expect(serverModerateContent("go f your mother").allowed).toBe(false);
      expect(serverModerateContent("what got a jack A$$").allowed).toBe(false);
      expect(serverModerateContent("assole").allowed).toBe(false);
    });

    it("allows safe phrases", () => {
      expect(serverModerateContent("Holy guacamole").allowed).toBe(true);
      expect(
        serverModerateContent("Mother of god i was not expecting this").allowed
      ).toBe(true);
      expect(serverModerateContent("Traffic is bad today").allowed).toBe(true);
    });
  });

  describe("profanity list coverage", () => {
    it("has a comprehensive list of explicit words", () => {
      // Ensure the list isn't empty
      expect(PROFANITY_LIST_FOR_TESTING.length).toBeGreaterThan(20);

      // Ensure key profanity is included
      expect(PROFANITY_LIST_FOR_TESTING).toContain("fuck");
      expect(PROFANITY_LIST_FOR_TESTING).toContain("shit");
      expect(PROFANITY_LIST_FOR_TESTING).toContain("motherfucker");
    });

    it("blocks common explicit profanity words (direct usage)", () => {
      // Test direct profanity that local checks SHOULD catch
      // These are the canonical forms without obfuscation
      const directProfanity = [
        "fuck", "fucking", "shit", "asshole", "bitch", "cunt"
      ];

      for (const word of directProfanity) {
        const result = moderateContent(`test ${word} test`);
        expect(result.allowed).toBe(false);
      }
    });

    it("blocks racial slurs (local check)", () => {
      // These should be caught by local checks due to severity
      expect(moderateContent("test nigger test").allowed).toBe(false);
      expect(moderateContent("test faggot test").allowed).toBe(false);
    });
  });
});
