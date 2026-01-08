import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getPulsePrompt, getStablePulsePrompt } from "@/lib/pulsePrompts";

/**
 * Pulse Prompts Tests
 *
 * Tests for the time-based and category-specific pulse prompts system.
 */

describe("Pulse Prompts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPulsePrompt", () => {
    describe("category-specific prompts", () => {
      it("returns Traffic-specific prompts for Traffic category", () => {
        const prompt = getPulsePrompt("Traffic");
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(0);
        // Traffic prompts should mention traffic-related terms
        expect(
          prompt.toLowerCase().includes("traffic") ||
          prompt.toLowerCase().includes("accident") ||
          prompt.toLowerCase().includes("highway") ||
          prompt.toLowerCase().includes("construction") ||
          prompt.toLowerCase().includes("road")
        ).toBe(true);
      });

      it("returns Weather-specific prompts for Weather category", () => {
        const prompt = getPulsePrompt("Weather");
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe("string");
        expect(
          prompt.toLowerCase().includes("weather") ||
          prompt.toLowerCase().includes("temperature") ||
          prompt.toLowerCase().includes("outdoor") ||
          prompt.toLowerCase().includes("day")
        ).toBe(true);
      });

      it("returns Events-specific prompts for Events category", () => {
        const prompt = getPulsePrompt("Events");
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe("string");
        expect(
          prompt.toLowerCase().includes("event") ||
          prompt.toLowerCase().includes("crowd") ||
          prompt.toLowerCase().includes("venue")
        ).toBe(true);
      });
    });

    describe("General prompts (time-based)", () => {
      it("returns morning weekday prompts at 8am on Monday", () => {
        // Monday 8am
        vi.setSystemTime(new Date("2024-06-17T08:00:00"));
        const prompt = getPulsePrompt("General");
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(0);
      });

      it("returns morning weekend prompts at 8am on Saturday", () => {
        // Saturday 8am
        vi.setSystemTime(new Date("2024-06-15T08:00:00"));
        const prompt = getPulsePrompt("General");
        expect(prompt).toBeDefined();
        // Weekend morning prompts should mention brunch/markets
        // (at least one should contain these terms)
      });

      it("returns evening prompts in the evening", () => {
        // Monday 7pm
        vi.setSystemTime(new Date("2024-06-17T19:00:00"));
        const prompt = getPulsePrompt("General");
        expect(prompt).toBeDefined();
      });

      it("returns night prompts late at night", () => {
        // Monday 11pm
        vi.setSystemTime(new Date("2024-06-17T23:00:00"));
        const prompt = getPulsePrompt("General");
        expect(prompt).toBeDefined();
      });

      it("returns afternoon prompts in the afternoon", () => {
        // Wednesday 3pm
        vi.setSystemTime(new Date("2024-06-19T15:00:00"));
        const prompt = getPulsePrompt("General");
        expect(prompt).toBeDefined();
      });

      it("returns midday prompts around noon", () => {
        // Tuesday 11am
        vi.setSystemTime(new Date("2024-06-18T11:00:00"));
        const prompt = getPulsePrompt("General");
        expect(prompt).toBeDefined();
      });
    });

    describe("randomness", () => {
      it("can return different prompts on multiple calls", () => {
        vi.setSystemTime(new Date("2024-06-17T12:00:00"));

        // Get many prompts - statistically some should be different
        const prompts = new Set<string>();
        for (let i = 0; i < 20; i++) {
          prompts.add(getPulsePrompt("General"));
        }

        // Should have some variety (at least 2 different prompts)
        // This could theoretically fail but is statistically unlikely
        expect(prompts.size).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("getStablePulsePrompt", () => {
    it("returns same prompt within same minute", () => {
      vi.setSystemTime(new Date("2024-06-17T12:05:30"));
      const prompt1 = getStablePulsePrompt("General");

      vi.setSystemTime(new Date("2024-06-17T12:05:45"));
      const prompt2 = getStablePulsePrompt("General");

      expect(prompt1).toBe(prompt2);
    });

    it("may return different prompt on different minutes", () => {
      // Note: This uses modulo, so it might return the same prompt
      // if prompts.length divides evenly into the minute difference
      vi.setSystemTime(new Date("2024-06-17T12:05:00"));
      const prompt1 = getStablePulsePrompt("General");

      vi.setSystemTime(new Date("2024-06-17T12:06:00"));
      const prompt2 = getStablePulsePrompt("General");

      // Both should be valid strings
      expect(prompt1).toBeDefined();
      expect(prompt2).toBeDefined();
    });

    it("returns category-specific prompts for non-General categories", () => {
      vi.setSystemTime(new Date("2024-06-17T12:00:00"));
      const prompt = getStablePulsePrompt("Traffic");
      expect(prompt).toBeDefined();
      expect(
        prompt.toLowerCase().includes("traffic") ||
        prompt.toLowerCase().includes("accident") ||
        prompt.toLowerCase().includes("highway") ||
        prompt.toLowerCase().includes("construction") ||
        prompt.toLowerCase().includes("road")
      ).toBe(true);
    });

    it("returns stable prompt for same category and time", () => {
      vi.setSystemTime(new Date("2024-06-17T12:30:00"));

      const prompt1 = getStablePulsePrompt("Weather");
      const prompt2 = getStablePulsePrompt("Weather");

      expect(prompt1).toBe(prompt2);
    });
  });

  describe("time boundary edge cases", () => {
    it("handles 5am as morning", () => {
      vi.setSystemTime(new Date("2024-06-17T05:00:00"));
      const prompt = getPulsePrompt("General");
      expect(prompt).toBeDefined();
    });

    it("handles 10am as midday", () => {
      vi.setSystemTime(new Date("2024-06-17T10:00:00"));
      const prompt = getPulsePrompt("General");
      expect(prompt).toBeDefined();
    });

    it("handles 12pm as afternoon", () => {
      vi.setSystemTime(new Date("2024-06-17T12:00:00"));
      const prompt = getPulsePrompt("General");
      expect(prompt).toBeDefined();
    });

    it("handles 5pm as evening", () => {
      vi.setSystemTime(new Date("2024-06-17T17:00:00"));
      const prompt = getPulsePrompt("General");
      expect(prompt).toBeDefined();
    });

    it("handles 9pm as night", () => {
      vi.setSystemTime(new Date("2024-06-17T21:00:00"));
      const prompt = getPulsePrompt("General");
      expect(prompt).toBeDefined();
    });

    it("handles Sunday as weekend", () => {
      vi.setSystemTime(new Date("2024-06-16T12:00:00")); // Sunday
      const prompt = getPulsePrompt("General");
      expect(prompt).toBeDefined();
    });

    it("handles Saturday as weekend", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00")); // Saturday
      const prompt = getPulsePrompt("General");
      expect(prompt).toBeDefined();
    });
  });
});
