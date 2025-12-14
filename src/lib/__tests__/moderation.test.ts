import { describe, expect, it } from "vitest";
import {
  moderateContent,
  serverModerateContent,
  PROFANITY_LIST_FOR_TESTING,
} from "@/lib/moderation";

describe("content moderation", () => {
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

    it("blocks threatening language", () => {
      expect(moderateContent("I'll kill you").allowed).toBe(false);
      expect(moderateContent("kill yourself").allowed).toBe(false);
      expect(moderateContent("go die").allowed).toBe(false);
      expect(moderateContent("hope you die").allowed).toBe(false);
      expect(moderateContent("kys loser").allowed).toBe(false);
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

    it("blocks most common profanity words", () => {
      // Test the most important words that users might actually type
      const criticalWords = [
        "fuck", "fucking", "shit", "asshole", "bitch",
        "motherfucker", "cunt", "nigger", "faggot"
      ];

      for (const word of criticalWords) {
        const result = moderateContent(`test ${word} test`);
        expect(result.allowed).toBe(false);
      }
    });
  });
});
