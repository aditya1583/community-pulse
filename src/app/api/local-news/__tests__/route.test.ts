import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, parseCityString } from "../route";

// Mock the AI module
vi.mock("@/lib/ai", () => ({
  generateNewsSummary: vi.fn().mockResolvedValue({
    paragraph: "Test summary paragraph about local news.",
    bulletPoints: ["Point 1", "Point 2", "Point 3"],
  }),
}));

// Mock the OpenAI module
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  paragraph: "Test summary",
                  bulletPoints: ["Test point"],
                }),
              },
            },
          ],
        }),
      },
    },
  })),
}));

describe("/api/local-news route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns error when city parameter is missing", async () => {
    const request = new NextRequest("http://localhost/api/local-news");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("City parameter is required");
  });

  it("returns notConfigured when NEWS_API_KEY is not set", async () => {
    delete process.env.NEWS_API_KEY;

    const request = new NextRequest(
      "http://localhost/api/local-news?city=Austin,%20TX"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notConfigured).toBe(true);
    expect(data.articles).toEqual([]);
    expect(data.city).toBe("Austin, TX");
  });

  it("returns correct response shape when API key is configured", async () => {
    // Set up mock environment
    process.env.NEWS_API_KEY = "test-api-key";
    process.env.OPENAI_API_KEY = "test-openai-key";

    // Mock fetch for NewsAPI
    const mockArticles = [
      {
        title: "Local Business Opens Downtown",
        description: "A new restaurant opens in downtown Austin.",
        url: "https://example.com/article1",
        urlToImage: "https://example.com/image1.jpg",
        publishedAt: "2024-01-15T10:00:00Z",
        source: { name: "Austin Chronicle" },
      },
      {
        title: "City Council Meeting Results",
        description: "Council approves new park development.",
        url: "https://example.com/article2",
        urlToImage: null,
        publishedAt: "2024-01-14T15:00:00Z",
        source: { name: "KVUE" },
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ articles: mockArticles }),
    });

    const request = new NextRequest(
      "http://localhost/api/local-news?city=Austin,%20TX"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("articles");
    expect(data).toHaveProperty("aiSummary");
    expect(data).toHaveProperty("city");
    expect(data).toHaveProperty("sourceCity");
    expect(data).toHaveProperty("isNearbyFallback");
    expect(data).toHaveProperty("fetchedAt");
    expect(typeof data.fetchedAt).toBe("string");
  });

  it("handles NewsAPI errors gracefully", async () => {
    process.env.NEWS_API_KEY = "test-api-key";
    process.env.OPENAI_API_KEY = "test-openai-key";

    // Mock fetch to return error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ status: "error", code: "apiKeyInvalid" }),
    });

    const request = new NextRequest(
      "http://localhost/api/local-news?city=Austin,%20TX"
    );
    const response = await GET(request);
    const data = await response.json();

    // Should return empty articles but not fail
    expect(response.status).toBe(200);
    expect(data.articles).toEqual([]);
  });

  it("includes fetchedAt timestamp in ISO format", async () => {
    delete process.env.NEWS_API_KEY;

    const request = new NextRequest(
      "http://localhost/api/local-news?city=Test%20City"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(data.fetchedAt).toBeDefined();
    // Check that it's a valid ISO date string
    const date = new Date(data.fetchedAt);
    expect(date.toISOString()).toBe(data.fetchedAt);
  });

  it("parses comma-separated city string and returns correct response shape", async () => {
    process.env.NEWS_API_KEY = "test-api-key";
    process.env.OPENAI_API_KEY = "test-openai-key";

    // Mock fetch for NewsAPI with Austin, TX specific articles
    // Articles must mention the city name to pass geographic relevance filter
    const mockArticles = [
      {
        title: "Austin City Council Approves New Development",
        description: "New development project approved in downtown Austin, Texas.",
        url: "https://example.com/austin-article1",
        urlToImage: "https://example.com/image1.jpg",
        publishedAt: "2024-01-15T10:00:00Z",
        source: { name: "Austin American-Statesman" },
      },
      {
        title: "Traffic Updates for Austin Area",
        description: "Major road closures planned in Austin this weekend.",
        url: "https://example.com/austin-article2",
        urlToImage: null,
        publishedAt: "2024-01-14T15:00:00Z",
        source: { name: "KVUE" },
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ articles: mockArticles }),
    });

    // Test with comma-separated format: "Austin, TX, US"
    const request = new NextRequest(
      "http://localhost/api/local-news?city=Austin,%20TX,%20US"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("articles");
    expect(data).toHaveProperty("aiSummary");
    expect(data).toHaveProperty("city");
    expect(data).toHaveProperty("sourceCity");
    expect(data).toHaveProperty("isNearbyFallback");
    expect(data).toHaveProperty("fetchedAt");
    // City should contain "Austin" (may or may not be normalized to displayName depending on city lookup)
    expect(data.city).toContain("Austin");
  });
});

describe("parseCityString", () => {
  it("parses 'Austin, TX, US' correctly", () => {
    const result = parseCityString("Austin, TX, US");
    expect(result).toEqual({
      cityName: "Austin",
      region: "TX",
      country: "US",
    });
  });

  it("parses 'Austin, Texas, US' correctly", () => {
    const result = parseCityString("Austin, Texas, US");
    expect(result).toEqual({
      cityName: "Austin",
      region: "Texas",
      country: "US",
    });
  });

  it("parses 'Austin, TX' correctly", () => {
    const result = parseCityString("Austin, TX");
    expect(result).toEqual({
      cityName: "Austin",
      region: "TX",
    });
  });

  it("parses 'Austin' correctly", () => {
    const result = parseCityString("Austin");
    expect(result).toEqual({
      cityName: "Austin",
    });
  });

  it("handles extra whitespace", () => {
    const result = parseCityString("  Austin ,  TX ,  US  ");
    expect(result).toEqual({
      cityName: "Austin",
      region: "TX",
      country: "US",
    });
  });

  it("handles empty string", () => {
    const result = parseCityString("");
    expect(result).toEqual({
      cityName: "",
    });
  });
});
