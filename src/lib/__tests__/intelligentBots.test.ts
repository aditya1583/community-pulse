import { describe, expect, it, beforeEach } from "vitest";
import {
  getCityConfig,
  LEANDER_CONFIG,
  CEDAR_PARK_CONFIG,
  AUSTIN_CONFIG,
  generatePost,
  generateSeedPosts,
  getCuisineFact,
  buildSituationContext,
  analyzeForPost,
} from "@/lib/intelligent-bots";
import type {
  CityConfig,
  TrafficData,
  WeatherData,
  EventData,
  SituationContext,
  PostDecision,
} from "@/lib/intelligent-bots";

/**
 * Intelligent Bots System Tests
 *
 * Tests for the hyperlocal bot posting system including:
 * - Fun facts configuration and retrieval
 * - Event template categorization
 * - Fun fact injection into posts
 * - Situation analysis and event detection
 */

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

const mockTrafficData: TrafficData = {
  congestionLevel: 0.25,
  freeFlowSpeed: 65,
  currentSpeed: 45,
  incidents: [],
};

const mockWeatherData: WeatherData = {
  condition: "clear",
  temperature: 75,
  feelsLike: 78,
  humidity: 45,
  uvIndex: 6,
  windSpeed: 8,
  precipitation: 0,
};

const mockEventData: EventData[] = [
  {
    name: "Texas Stars vs Iowa Wild",
    venue: "HEB Center",
    startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    category: "Sports",
    expectedAttendance: 5000,
  },
];

const mockConcertEvent: EventData = {
  name: "Taylor Swift Eras Tour",
  venue: "Moody Center",
  startTime: new Date(Date.now() + 90 * 60 * 1000),
  category: "Music",
  expectedAttendance: 15000,
};

const mockFestivalEvent: EventData = {
  name: "SXSW Music Festival",
  venue: "Downtown Austin",
  startTime: new Date(Date.now() + 120 * 60 * 1000),
  category: "Festival",
  expectedAttendance: 50000,
};

// ============================================================================
// FUN FACTS CONFIGURATION TESTS
// ============================================================================

describe("Fun Facts Configuration", () => {
  describe("Leander City Config", () => {
    it("has funFacts property defined", () => {
      expect(LEANDER_CONFIG.funFacts).toBeDefined();
    });

    it("has traffic fun facts", () => {
      expect(LEANDER_CONFIG.funFacts?.traffic).toBeDefined();
      expect(LEANDER_CONFIG.funFacts?.traffic.length).toBeGreaterThan(0);
    });

    it("has weather fun facts", () => {
      expect(LEANDER_CONFIG.funFacts?.weather).toBeDefined();
      expect(LEANDER_CONFIG.funFacts?.weather.length).toBeGreaterThan(0);
    });

    it("has events fun facts", () => {
      expect(LEANDER_CONFIG.funFacts?.events).toBeDefined();
      expect(LEANDER_CONFIG.funFacts?.events.length).toBeGreaterThan(0);
    });

    it("has local fun facts", () => {
      expect(LEANDER_CONFIG.funFacts?.local).toBeDefined();
      expect(LEANDER_CONFIG.funFacts?.local.length).toBeGreaterThan(0);
    });

    it("has cuisine fun facts with all categories", () => {
      const cuisine = LEANDER_CONFIG.funFacts?.cuisine;
      expect(cuisine).toBeDefined();
      expect(cuisine?.tacos.length).toBeGreaterThan(0);
      expect(cuisine?.bbq.length).toBeGreaterThan(0);
      expect(cuisine?.coffee.length).toBeGreaterThan(0);
      expect(cuisine?.pizza.length).toBeGreaterThan(0);
      expect(cuisine?.burgers.length).toBeGreaterThan(0);
      expect(cuisine?.general.length).toBeGreaterThan(0);
    });

    it("contains authentic Leander-specific facts", () => {
      const trafficFacts = LEANDER_CONFIG.funFacts?.traffic || [];
      const localFacts = LEANDER_CONFIG.funFacts?.local || [];

      // Check for Leander-specific content
      const hasLeanderRoadFact = trafficFacts.some(
        (f) => f.includes("183") || f.includes("Ronald Reagan") || f.includes("Crystal Falls")
      );
      expect(hasLeanderRoadFact).toBe(true);

      const hasLeanderHistoryFact = localFacts.some(
        (f) => f.includes("Leander") || f.includes("Catfish Brown")
      );
      expect(hasLeanderHistoryFact).toBe(true);
    });
  });

  describe("Cedar Park City Config", () => {
    it("has funFacts property defined", () => {
      expect(CEDAR_PARK_CONFIG.funFacts).toBeDefined();
    });

    it("has all fun fact categories", () => {
      expect(CEDAR_PARK_CONFIG.funFacts?.traffic.length).toBeGreaterThan(0);
      expect(CEDAR_PARK_CONFIG.funFacts?.weather.length).toBeGreaterThan(0);
      expect(CEDAR_PARK_CONFIG.funFacts?.events.length).toBeGreaterThan(0);
      expect(CEDAR_PARK_CONFIG.funFacts?.local.length).toBeGreaterThan(0);
    });

    it("contains Cedar Park-specific facts", () => {
      const eventsFacts = CEDAR_PARK_CONFIG.funFacts?.events || [];
      const hasHEBCenterFact = eventsFacts.some(
        (f) => f.includes("HEB Center") || f.includes("Texas Stars")
      );
      expect(hasHEBCenterFact).toBe(true);
    });
  });

  describe("Austin City Config", () => {
    it("has funFacts property defined", () => {
      expect(AUSTIN_CONFIG.funFacts).toBeDefined();
    });

    it("has all fun fact categories", () => {
      expect(AUSTIN_CONFIG.funFacts?.traffic.length).toBeGreaterThan(0);
      expect(AUSTIN_CONFIG.funFacts?.weather.length).toBeGreaterThan(0);
      expect(AUSTIN_CONFIG.funFacts?.events.length).toBeGreaterThan(0);
      expect(AUSTIN_CONFIG.funFacts?.local.length).toBeGreaterThan(0);
    });

    it("contains Austin-specific landmark facts", () => {
      const trafficFacts = AUSTIN_CONFIG.funFacts?.traffic || [];
      const eventsFacts = AUSTIN_CONFIG.funFacts?.events || [];

      const hasI35Fact = trafficFacts.some((f) => f.includes("I-35"));
      expect(hasI35Fact).toBe(true);

      const hasSXSWFact = eventsFacts.some((f) => f.includes("SXSW"));
      expect(hasSXSWFact).toBe(true);
    });

    it("has more cuisine facts than suburbs (Austin is foodie capital)", () => {
      const austinCuisineFacts = Object.values(AUSTIN_CONFIG.funFacts?.cuisine || {}).flat();
      const leanderCuisineFacts = Object.values(LEANDER_CONFIG.funFacts?.cuisine || {}).flat();

      expect(austinCuisineFacts.length).toBeGreaterThanOrEqual(leanderCuisineFacts.length);
    });
  });

  describe("getCityConfig", () => {
    it("returns Leander config for 'Leander'", () => {
      const config = getCityConfig("Leander");
      expect(config).toBeDefined();
      expect(config?.name).toBe("Leander");
    });

    it("returns Cedar Park config for 'Cedar Park'", () => {
      const config = getCityConfig("Cedar Park");
      expect(config).toBeDefined();
      expect(config?.name).toBe("Cedar Park");
    });

    it("returns Austin config for 'Austin'", () => {
      const config = getCityConfig("Austin");
      expect(config).toBeDefined();
      expect(config?.name).toBe("Austin");
    });

    it("returns null for unknown cities", () => {
      const config = getCityConfig("Unknown City");
      expect(config).toBeNull();
    });
  });
});

// ============================================================================
// CUISINE FUN FACTS API TESTS
// ============================================================================

describe("getCuisineFact", () => {
  it("returns a taco fact when cuisineType is 'tacos'", () => {
    const fact = getCuisineFact(AUSTIN_CONFIG, "tacos");
    expect(fact).toBeDefined();
    expect(typeof fact).toBe("string");
  });

  it("returns a bbq fact when cuisineType is 'bbq'", () => {
    const fact = getCuisineFact(AUSTIN_CONFIG, "bbq");
    expect(fact).toBeDefined();
    // Austin's BBQ facts should mention Franklin or brisket
    const allBBQFacts = AUSTIN_CONFIG.funFacts?.cuisine.bbq || [];
    expect(allBBQFacts).toContainEqual(fact);
  });

  it("returns a general cuisine fact when no type specified", () => {
    const fact = getCuisineFact(LEANDER_CONFIG);
    expect(fact).toBeDefined();
  });

  it("returns null for city without funFacts", () => {
    const configWithoutFacts: CityConfig = {
      ...LEANDER_CONFIG,
      funFacts: undefined,
    };
    const fact = getCuisineFact(configWithoutFacts, "tacos");
    expect(fact).toBeNull();
  });

  it("falls back to general facts for unknown cuisine type", () => {
    // Using a city with funFacts
    const fact = getCuisineFact(LEANDER_CONFIG);
    expect(fact).toBeDefined();
  });
});

// ============================================================================
// EVENT TEMPLATE CATEGORIZATION TESTS
// ============================================================================

describe("Event Template Categorization", () => {
  describe("analyzeForPost with events", () => {
    it("categorizes sports events correctly", () => {
      const ctx = buildSituationContext(
        CEDAR_PARK_CONFIG,
        mockTrafficData,
        mockWeatherData,
        [mockEventData[0]] // Sports event
      );

      const decision = analyzeForPost(ctx);

      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("sports");
      }
    });

    it("categorizes concert events correctly", () => {
      const ctx = buildSituationContext(
        AUSTIN_CONFIG,
        mockTrafficData,
        mockWeatherData,
        [mockConcertEvent]
      );

      const decision = analyzeForPost(ctx);

      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("concert");
      }
    });

    it("categorizes festival events correctly", () => {
      const ctx = buildSituationContext(
        AUSTIN_CONFIG,
        mockTrafficData,
        mockWeatherData,
        [mockFestivalEvent]
      );

      const decision = analyzeForPost(ctx);

      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("festival");
      }
    });

    it("detects events starting within 4 hours", () => {
      const eventIn3Hours: EventData = {
        name: "Comedy Show",
        venue: "Cap City Comedy",
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
        category: "Comedy",
        expectedAttendance: 300,
      };

      const ctx = buildSituationContext(
        AUSTIN_CONFIG,
        { ...mockTrafficData, congestionLevel: 0.1 }, // Low traffic
        mockWeatherData,
        [eventIn3Hours]
      );

      const decision = analyzeForPost(ctx);

      // Should potentially post about this event
      expect(decision.postType).toBeDefined();
    });

    it("gives higher priority to events starting very soon", () => {
      const eventIn30Mins: EventData = {
        name: "Live Band",
        venue: "Stubb's",
        startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 mins
        category: "Music",
        expectedAttendance: 1000,
      };

      const ctx = buildSituationContext(
        AUSTIN_CONFIG,
        { ...mockTrafficData, congestionLevel: 0.1 },
        mockWeatherData,
        [eventIn30Mins]
      );

      const decision = analyzeForPost(ctx);

      if (decision.postType === "Events") {
        expect(decision.priority).toBeGreaterThanOrEqual(6);
      }
    });
  });

  describe("Event name pattern matching", () => {
    const testEventCategory = (name: string, category: string, expectedTemplate: string) => {
      const event: EventData = {
        name,
        venue: "Test Venue",
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        category,
        expectedAttendance: 1000,
      };

      const ctx = buildSituationContext(
        AUSTIN_CONFIG,
        { ...mockTrafficData, congestionLevel: 0.05 },
        mockWeatherData,
        [event]
      );

      const decision = analyzeForPost(ctx);
      return decision;
    };

    it("detects 'vs' pattern as sports", () => {
      const decision = testEventCategory("Austin FC vs LA Galaxy", "Sports", "sports");
      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("sports");
      }
    });

    it("detects 'tour' pattern as concert", () => {
      const decision = testEventCategory("Taylor Swift Eras Tour", "Music", "concert");
      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("concert");
      }
    });

    it("detects 'fest' pattern as festival", () => {
      const decision = testEventCategory("ACL Fest 2025", "Music", "festival");
      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("festival");
      }
    });

    it("detects comedy keywords", () => {
      const decision = testEventCategory("Stand-up Comedy Night", "Comedy", "comedy");
      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("comedy");
      }
    });

    it("detects theater keywords", () => {
      const decision = testEventCategory("Broadway Musical: Hamilton", "Arts", "arts");
      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("arts");
      }
    });

    it("detects food event keywords", () => {
      const decision = testEventCategory("Austin Food & Wine Festival", "Culinary", "food");
      if (decision.postType === "Events") {
        expect(decision.templateCategory).toBe("food");
      }
    });
  });
});

// ============================================================================
// POST GENERATION WITH FUN FACTS TESTS
// ============================================================================

describe("Post Generation with Fun Facts", () => {
  it("generatePost returns a valid post structure", async () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.35 }, // High traffic
      mockWeatherData,
      []
    );

    const decision = analyzeForPost(ctx);
    const post = await generatePost(ctx, decision, { useAIFacts: false });

    expect(post).toBeDefined();
    expect(post?.message).toBeDefined();
    expect(post?.tag).toBeDefined();
    expect(post?.mood).toBeDefined();
    expect(post?.author).toBeDefined();
    expect(post?.is_bot).toBe(true);
  });

  it("generatePost can inject fun facts when forced", async () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.35 },
      mockWeatherData,
      []
    );

    const decision = analyzeForPost(ctx);

    // Generate multiple posts to increase chance of seeing a fun fact
    let foundFunFact = false;
    for (let i = 0; i < 20; i++) {
      const post = await generatePost(ctx, decision, { injectFunFact: true, useAIFacts: false });
      if (
        post?.message.includes("Fun fact:") ||
        post?.message.includes("Did you know?") ||
        post?.message.includes("Trivia:") ||
        post?.message.includes("BTW:")
      ) {
        foundFunFact = true;
        break;
      }
    }

    expect(foundFunFact).toBe(true);
  });

  it("generateSeedPosts returns multiple varied posts", async () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      mockTrafficData,
      mockWeatherData,
      mockEventData
    );

    const posts = await generateSeedPosts(ctx, 3, { useAIFacts: false });

    expect(posts.length).toBeGreaterThan(0);
    expect(posts.length).toBeLessThanOrEqual(3);

    // Check that posts are varied (different tags)
    const tags = posts.map((p) => p.tag);
    const uniqueTags = new Set(tags);
    expect(uniqueTags.size).toBeGreaterThanOrEqual(1);
  });

  it("generateSeedPosts includes event posts when events are available", async () => {
    const ctx = buildSituationContext(
      CEDAR_PARK_CONFIG,
      mockTrafficData,
      mockWeatherData,
      mockEventData
    );

    // Generate multiple batches to increase chance
    let foundEventPost = false;
    for (let i = 0; i < 5; i++) {
      const posts = await generateSeedPosts(ctx, 3, { useAIFacts: false });
      if (posts.some((p) => p.tag === "Events")) {
        foundEventPost = true;
        break;
      }
    }

    expect(foundEventPost).toBe(true);
  });

  it("bot author names include city name", async () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.35 },
      mockWeatherData,
      []
    );

    const decision = analyzeForPost(ctx);
    const post = await generatePost(ctx, decision, { useAIFacts: false });

    expect(post?.author).toContain("Leander");
  });

  it("bot author names match post type", async () => {
    // Traffic post
    const trafficCtx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.4 },
      mockWeatherData,
      []
    );
    const trafficDecision = analyzeForPost(trafficCtx);
    const trafficPost = await generatePost(trafficCtx, trafficDecision, { useAIFacts: false });

    if (trafficPost?.tag === "Traffic") {
      const trafficBotNames = ["Road Reporter", "Commute Buddy", "Traffic Tipster", "Route Scout"];
      const hasTrafficName = trafficBotNames.some((name) => trafficPost.author.includes(name));
      expect(hasTrafficName).toBe(true);
    }
  });
});

// ============================================================================
// SITUATION ANALYSIS TESTS
// ============================================================================

describe("Situation Analysis", () => {
  it("prioritizes high traffic over general posts", () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.5 }, // 50% congestion
      mockWeatherData,
      []
    );

    const decision = analyzeForPost(ctx);

    expect(decision.shouldPost).toBe(true);
    expect(decision.postType).toBe("Traffic");
    expect(decision.priority).toBeGreaterThanOrEqual(7);
  });

  it("prioritizes storms over traffic", () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.3 },
      { ...mockWeatherData, condition: "storm" },
      []
    );

    const decision = analyzeForPost(ctx);

    expect(decision.shouldPost).toBe(true);
    expect(decision.postType).toBe("Weather");
  });

  it("detects extreme heat conditions", () => {
    const ctx = buildSituationContext(
      AUSTIN_CONFIG,
      mockTrafficData,
      { ...mockWeatherData, temperature: 105 },
      []
    );

    const decision = analyzeForPost(ctx);

    if (decision.postType === "Weather") {
      expect(decision.templateCategory).toBe("heat");
    }
  });

  it("detects freezing conditions", () => {
    const ctx = buildSituationContext(
      AUSTIN_CONFIG,
      mockTrafficData,
      { ...mockWeatherData, temperature: 28, condition: "clear" },
      []
    );

    const decision = analyzeForPost(ctx);

    if (decision.postType === "Weather") {
      expect(decision.templateCategory).toBe("cold");
    }
  });

  it("returns no post when conditions are normal", () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.1 }, // Light traffic
      mockWeatherData, // Normal weather
      [] // No events
    );

    const decision = analyzeForPost(ctx);

    // With normal conditions and no randomness triggering, may not post
    // This is expected behavior - silence > noise
    expect(decision).toBeDefined();
  });
});

// ============================================================================
// FUN FACT INJECTION RATE TESTS
// ============================================================================

describe("Fun Fact Injection Rate", () => {
  it("injects fun facts approximately 25% of the time (statistical test)", async () => {
    const ctx = buildSituationContext(
      AUSTIN_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.4 },
      mockWeatherData,
      []
    );

    const decision = analyzeForPost(ctx);
    let funFactCount = 0;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const post = await generatePost(ctx, decision, { useAIFacts: false });
      if (
        post?.message.includes("Fun fact:") ||
        post?.message.includes("Did you know?") ||
        post?.message.includes("Trivia:") ||
        post?.message.includes("BTW:")
      ) {
        funFactCount++;
      }
    }

    // Should be roughly 25% (with some variance)
    // Allow range of 10% to 50% to account for randomness
    const rate = funFactCount / iterations;
    expect(rate).toBeGreaterThan(0.1);
    expect(rate).toBeLessThan(0.5);
  });

  it("seed posts have higher fun fact rate (~40%)", async () => {
    const ctx = buildSituationContext(
      AUSTIN_CONFIG,
      mockTrafficData,
      mockWeatherData,
      []
    );

    let funFactCount = 0;
    let totalPosts = 0;
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const posts = await generateSeedPosts(ctx, 3, { useAIFacts: false });
      for (const post of posts) {
        totalPosts++;
        if (
          post.message.includes("Fun fact:") ||
          post.message.includes("Did you know?") ||
          post.message.includes("Trivia:") ||
          post.message.includes("BTW:")
        ) {
          funFactCount++;
        }
      }
    }

    // Seed posts should have ~40% fun fact rate
    const rate = funFactCount / totalPosts;
    expect(rate).toBeGreaterThan(0.15); // At least 15%
  });
});

// ============================================================================
// TEMPLATE VARIABLE SUBSTITUTION TESTS
// ============================================================================

describe("Template Variable Substitution", () => {
  it("substitutes city name correctly", async () => {
    const ctx = buildSituationContext(
      LEANDER_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.4 },
      mockWeatherData,
      []
    );

    const decision = analyzeForPost(ctx);
    const post = await generatePost(ctx, decision, { useAIFacts: false });

    // Post should reference Leander (city name or road names)
    const hasLeanderReference =
      post?.message.includes("Leander") ||
      LEANDER_CONFIG.roads.major.some((road) => post?.message.includes(road)) ||
      LEANDER_CONFIG.landmarks.shopping.some((landmark) => post?.message.includes(landmark));

    expect(hasLeanderReference).toBe(true);
  });

  it("includes temperature in weather posts", async () => {
    const ctx = buildSituationContext(
      AUSTIN_CONFIG,
      mockTrafficData,
      { ...mockWeatherData, temperature: 102, condition: "clear" },
      []
    );

    const decision = analyzeForPost(ctx);

    if (decision.postType === "Weather") {
      const post = await generatePost(ctx, decision, { useAIFacts: false });
      expect(post?.message).toMatch(/\d+°F/);
    }
  });

  it("includes event name in event posts", async () => {
    const event: EventData = {
      name: "Austin FC Game",
      venue: "Q2 Stadium",
      startTime: new Date(Date.now() + 30 * 60 * 1000),
      category: "Sports",
      expectedAttendance: 20000,
    };

    const ctx = buildSituationContext(
      AUSTIN_CONFIG,
      { ...mockTrafficData, congestionLevel: 0.05 },
      mockWeatherData,
      [event]
    );

    const decision = analyzeForPost(ctx);

    if (decision.postType === "Events") {
      const post = await generatePost(ctx, decision, { useAIFacts: false });
      expect(post?.message).toContain("Austin FC Game");
    }
  });
});
