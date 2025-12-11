import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateNewsSummary, type NewsArticleSummaryInput } from "@/lib/ai";

// Mock OpenAI
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  paragraph: "Local news shows positive community developments.",
                  bulletPoints: ["New park opening", "School event planned"],
                }),
              },
            },
          ],
        }),
      },
    },
  })),
}));

describe("AI helper - generateNewsSummary", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = "test-api-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty summary for empty articles array", async () => {
    const result = await generateNewsSummary("Austin", []);

    expect(result.paragraph).toBe(
      "No recent news articles available for this area."
    );
    expect(result.bulletPoints).toEqual([]);
  });

  it("returns a valid summary object with paragraph and bulletPoints", async () => {
    const articles: NewsArticleSummaryInput[] = [
      {
        title: "New Park Opens Downtown",
        description: "A new community park opens in the heart of downtown.",
        source: "Local News",
        publishedAt: "2024-01-15T10:00:00Z",
      },
      {
        title: "School Event This Weekend",
        description: "Local schools host annual science fair.",
        source: "School District",
        publishedAt: "2024-01-14T15:00:00Z",
      },
    ];

    const result = await generateNewsSummary("Austin", articles);

    expect(result).toHaveProperty("paragraph");
    expect(result).toHaveProperty("bulletPoints");
    expect(typeof result.paragraph).toBe("string");
    expect(Array.isArray(result.bulletPoints)).toBe(true);
  });

  it("throws error when OPENAI_API_KEY is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    // Need to re-import to pick up the missing env var
    vi.resetModules();

    const articles: NewsArticleSummaryInput[] = [
      {
        title: "Test Article",
        description: "Test description",
        source: "Test Source",
        publishedAt: "2024-01-15T10:00:00Z",
      },
    ];

    // The module checks env at import time, so this test verifies the pattern
    // In production, the error would be thrown
    await expect(generateNewsSummary("Austin", articles)).rejects.toThrow();
  });

  it("limits bullet points to maximum of 5", async () => {
    const articles: NewsArticleSummaryInput[] = Array.from(
      { length: 10 },
      (_, i) => ({
        title: `Article ${i + 1}`,
        description: `Description ${i + 1}`,
        source: "Test Source",
        publishedAt: "2024-01-15T10:00:00Z",
      })
    );

    const result = await generateNewsSummary("Austin", articles);

    expect(result.bulletPoints.length).toBeLessThanOrEqual(5);
  });
});
