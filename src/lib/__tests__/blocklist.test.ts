import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeForBlocklist,
  checkBlocklist,
  clearBlocklistCache,
  getBlocklistCacheStatus,
} from "@/lib/blocklist";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  })),
}));

describe("Blocklist - normalizeForBlocklist", () => {
  it("converts to lowercase", () => {
    expect(normalizeForBlocklist("HELLO")).toBe("hello");
    expect(normalizeForBlocklist("HeLLo WoRLD")).toBe("hello world");
  });

  it("strips diacritics", () => {
    expect(normalizeForBlocklist("cafe")).toBe("cafe");
    expect(normalizeForBlocklist("nino")).toBe("nino");
    expect(normalizeForBlocklist("resume")).toBe("resume");
  });

  it("replaces common obfuscation characters", () => {
    expect(normalizeForBlocklist("h3ll0")).toBe("hello");
    expect(normalizeForBlocklist("@ss")).toBe("ass");
    expect(normalizeForBlocklist("$h1t")).toBe("shit");
    expect(normalizeForBlocklist("b8tch")).toBe("bbtch");
  });

  it("removes non-alphanumeric characters except spaces", () => {
    expect(normalizeForBlocklist("f*ck")).toBe("fck");
    expect(normalizeForBlocklist("a$$hole")).toBe("asshole");
    expect(normalizeForBlocklist("sh!t")).toBe("shit");
  });

  it("collapses repeated characters (3+ -> 1)", () => {
    expect(normalizeForBlocklist("fuuuck")).toBe("fuck");
    expect(normalizeForBlocklist("shiiit")).toBe("shit");
    expect(normalizeForBlocklist("aaassss")).toBe("as");
  });

  it("preserves legitimate doubles", () => {
    // Note: blocklist only collapses 3+ repeated chars, not doubles
    expect(normalizeForBlocklist("hello")).toBe("hello");
    expect(normalizeForBlocklist("off")).toBe("off");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeForBlocklist("hello    world")).toBe("hello world");
    expect(normalizeForBlocklist("  hello  ")).toBe("hello");
  });
});

describe("Blocklist - checkBlocklist", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    clearBlocklistCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("with JSON env var blocklist", () => {
    it("allows content when blocklist is empty", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = "[]";

      const result = await checkBlocklist("Hello world");
      expect(result.allowed).toBe(true);
    });

    it("blocks content matching blocklist phrase", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "badword", severity: "block" },
      ]);

      // Clear cache to pick up new env
      clearBlocklistCache();

      const result = await checkBlocklist("This contains badword here");
      expect(result.allowed).toBe(false);
      expect(result.severity).toBe("block");
    });

    it("blocks normalized variations", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "badword", severity: "block" },
      ]);
      clearBlocklistCache();

      // Should match "B4DW0RD" after normalization
      const result = await checkBlocklist("This contains B4DW0RD here");
      expect(result.allowed).toBe(false);
    });

    it("warns but allows content with warn severity", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "questionable", severity: "warn" },
      ]);
      clearBlocklistCache();

      const result = await checkBlocklist("This is questionable content");
      expect(result.allowed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.matchedPhrase).toBe("questionable");
    });

    it("does not false positive on substrings for short words", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "ass", severity: "block" },
      ]);
      clearBlocklistCache();

      // "grass" contains "ass" but should not match due to word boundary check
      const result = await checkBlocklist("The grass is green");
      expect(result.allowed).toBe(true);
    });

    it("matches longer words at token boundaries", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "badword", severity: "block" },
      ]);
      clearBlocklistCache();

      // Should match "badword123" since it starts with the phrase
      const result = await checkBlocklist("This is badword123");
      expect(result.allowed).toBe(false);
    });

    it("handles multi-word phrases", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "bad phrase here", severity: "block" },
      ]);
      clearBlocklistCache();

      const result = await checkBlocklist("This is a bad phrase here in text");
      expect(result.allowed).toBe(false);
    });
  });

  describe("caching behavior", () => {
    it("returns cached entries on subsequent calls", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "test", severity: "block" },
      ]);
      clearBlocklistCache();

      // First call populates cache
      await checkBlocklist("Hello");
      const status1 = getBlocklistCacheStatus();
      expect(status1.cached).toBe(true);
      expect(status1.entryCount).toBe(1);

      // Second call uses cache
      await checkBlocklist("World");
      const status2 = getBlocklistCacheStatus();
      expect(status2.cached).toBe(true);
    });

    it("clearBlocklistCache resets the cache", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
        { phrase: "test", severity: "block" },
      ]);

      await checkBlocklist("Hello");
      expect(getBlocklistCacheStatus().cached).toBe(true);

      clearBlocklistCache();
      expect(getBlocklistCacheStatus().cached).toBe(false);
    });
  });

  describe("error handling", () => {
    it("allows content when blocklist JSON is invalid", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = "not valid json";
      clearBlocklistCache();

      const result = await checkBlocklist("Hello world");
      expect(result.allowed).toBe(true);
    });

    it("allows content when blocklist JSON is not an array", async () => {
      process.env.MODERATION_BLOCKLIST_JSON = '{"phrase": "test"}';
      clearBlocklistCache();

      const result = await checkBlocklist("Hello world");
      expect(result.allowed).toBe(true);
    });
  });
});

describe("Blocklist - specific test cases", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    clearBlocklistCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("blocks Telugu transliterated profanity when added to blocklist", async () => {
    // Example: "dengudu" is Telugu profanity (transliterated)
    process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
      { phrase: "dengudu", severity: "block" },
    ]);
    clearBlocklistCache();

    const result = await checkBlocklist("test dengudu test");
    expect(result.allowed).toBe(false);
  });

  it("blocks obfuscated blocklist entries", async () => {
    process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
      { phrase: "slur", severity: "block" },
    ]);
    clearBlocklistCache();

    // Test obfuscation: "5lur" should normalize to "slur"
    const result = await checkBlocklist("test 5lur test");
    expect(result.allowed).toBe(false);
  });

  it("handles empty content", async () => {
    process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
      { phrase: "test", severity: "block" },
    ]);
    clearBlocklistCache();

    const result = await checkBlocklist("");
    expect(result.allowed).toBe(true);
  });

  it("handles content with only spaces", async () => {
    process.env.MODERATION_BLOCKLIST_JSON = JSON.stringify([
      { phrase: "test", severity: "block" },
    ]);
    clearBlocklistCache();

    const result = await checkBlocklist("     ");
    expect(result.allowed).toBe(true);
  });
});
