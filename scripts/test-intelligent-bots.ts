#!/usr/bin/env npx tsx
/**
 * Manual Test Script for Intelligent Bots System
 *
 * Run with: npx tsx scripts/test-intelligent-bots.ts
 *
 * This script tests the bot posting system with real API calls.
 * You'll see console output showing what posts would be generated.
 *
 * Setup: Add your API keys to .env.local file:
 *   OPENAI_API_KEY=sk-...
 *   TOMTOM_API_KEY=...
 *   TICKETMASTER_API_KEY=...
 */

// Load environment variables BEFORE any imports (use require to avoid hoisting)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

import {
  generateIntelligentPost,
  generateColdStartPosts,
  getCityConfig,
  buildSituationContext,
  analyzeForPost,
  fetchTrafficData,
  fetchWeatherData,
  fetchEventData,
  generateEventFunFact,
  generateWeatherFunFact,
  generateTrafficFunFact,
  generatePost,
} from "../src/lib/intelligent-bots";

// ANSI color codes for pretty console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(60));
  log(` ${title} `, "bright");
  console.log("=".repeat(60) + "\n");
}

function logPost(post: { message: string; tag: string; author: string; mood: string }) {
  console.log(`┌${"─".repeat(58)}┐`);
  log(`│ ${post.tag.padEnd(10)} | ${post.author.padEnd(30)} │`, "cyan");
  console.log(`├${"─".repeat(58)}┤`);
  // Wrap message to fit
  const lines = post.message.match(/.{1,54}/g) || [post.message];
  for (const line of lines) {
    console.log(`│ ${line.padEnd(56)} │`);
  }
  console.log(`└${"─".repeat(58)}┘`);
  console.log();
}

async function testAIFunFacts() {
  logSection("TEST 1: AI-Generated Fun Facts");

  const cities = ["Leander", "Cedar Park", "Austin"];

  for (const cityName of cities) {
    log(`\n📍 Testing fun facts for ${cityName}:`, "yellow");

    // Traffic fact
    log("\n  🚗 Traffic Fun Fact:", "blue");
    const trafficFact = await generateTrafficFunFact("I-35", cityName);
    if (trafficFact) {
      log(`     "${trafficFact.fact}"`, "green");
    } else {
      log("     (No API key or failed)", "red");
    }

    // Weather fact
    log("\n  🌤️ Weather Fun Fact:", "blue");
    const weatherFact = await generateWeatherFunFact("clear", 85, cityName);
    if (weatherFact) {
      log(`     "${weatherFact.fact}"`, "green");
    } else {
      log("     (No API key or failed)", "red");
    }

    // Event fact
    log("\n  🎸 Event Fun Fact:", "blue");
    const eventFact = await generateEventFunFact(
      {
        name: "Texas Stars vs Iowa Wild",
        venue: "HEB Center",
        startTime: new Date(),
        category: "Sports",
      },
      cityName
    );
    if (eventFact) {
      log(`     "${eventFact.fact}"`, "green");
    } else {
      log("     (No API key or failed)", "red");
    }
  }
}

async function testSinglePost() {
  logSection("TEST 2: Generate Single Intelligent Post");

  const cities = ["Leander", "Cedar Park", "Austin"];

  for (const cityName of cities) {
    log(`\n📍 Generating post for ${cityName}...`, "yellow");

    const result = await generateIntelligentPost(cityName, { force: true });

    if (result.success && result.posted && result.post) {
      log(`✅ Post generated!`, "green");
      log(`   Situation: ${result.situationSummary}`, "cyan");
      logPost(result.post);
    } else {
      log(`⏸️ No post: ${result.reason}`, "yellow");
      if (result.situationSummary) {
        log(`   Situation: ${result.situationSummary}`, "cyan");
      }
    }
  }
}

async function testColdStart() {
  logSection("TEST 3: Cold Start Seed Posts");

  const cityName = "Leander";
  log(`\n📍 Generating 3 seed posts for ${cityName}...`, "yellow");

  const result = await generateColdStartPosts(cityName, { count: 3 });

  if (result.success && result.posts.length > 0) {
    log(`✅ Generated ${result.posts.length} posts!`, "green");
    log(`   Situation: ${result.situationSummary}`, "cyan");

    for (const post of result.posts) {
      logPost(post);
    }
  } else {
    log(`❌ Failed: ${result.reason}`, "red");
  }
}

async function testSituationAnalysis() {
  logSection("TEST 4: Situation Analysis (Real Data)");

  const cityName = "Leander";
  const config = getCityConfig(cityName);

  if (!config) {
    log("❌ City config not found", "red");
    return;
  }

  log(`\n📍 Fetching real-time data for ${cityName}...`, "yellow");

  const [traffic, weather, events] = await Promise.all([
    fetchTrafficData(config.coords),
    fetchWeatherData(config.coords),
    fetchEventData(config.name, config.state),
  ]);

  log("\n📊 Current Conditions:", "cyan");
  log(`   Traffic: ${Math.round(traffic.congestionLevel * 100)}% congestion, ${traffic.currentSpeed} mph`, "reset");
  log(`   Weather: ${weather.temperature}°F, ${weather.condition}`, "reset");
  log(`   Events: ${events.length} upcoming`, "reset");

  if (events.length > 0) {
    log(`\n🎟️ Upcoming Events:`, "magenta");
    for (const event of events.slice(0, 3)) {
      log(`   - ${event.name} at ${event.venue}`, "reset");
    }
  }

  const ctx = buildSituationContext(config, traffic, weather, events);
  const decision = analyzeForPost(ctx);

  log("\n🤖 Bot Decision:", "cyan");
  log(`   Should Post: ${decision.shouldPost ? "Yes" : "No"}`, decision.shouldPost ? "green" : "yellow");
  log(`   Post Type: ${decision.postType || "N/A"}`, "reset");
  log(`   Category: ${decision.templateCategory || "N/A"}`, "reset");
  log(`   Priority: ${decision.priority}/10`, "reset");
  log(`   Reason: ${decision.reason}`, "reset");
}

async function testPostsWithFunFacts() {
  logSection("TEST 5: Posts WITH AI Fun Facts (Forced Injection)");

  const cityName = "Leander";
  const config = getCityConfig(cityName);

  if (!config) {
    log("❌ City config not found", "red");
    return;
  }

  log(`\n📍 Generating posts WITH fun facts for ${cityName}...`, "yellow");

  const [traffic, weather, events] = await Promise.all([
    fetchTrafficData(config.coords),
    fetchWeatherData(config.coords),
    fetchEventData(config.name, config.state),
  ]);

  const ctx = buildSituationContext(config, traffic, weather, events);

  // Generate different post types with forced fun fact injection
  const postTypes = [
    { postType: "Traffic" as const, templateCategory: "general" },
    { postType: "Weather" as const, templateCategory: "perfectWeather" },
    { postType: "General" as const, templateCategory: "goodMorning" },
  ];

  for (const { postType, templateCategory } of postTypes) {
    const decision = {
      shouldPost: true,
      postType,
      templateCategory,
      priority: 5,
      reason: "Test post",
    };

    log(`\n📝 Generating ${postType} post with AI fun fact...`, "blue");

    const post = await generatePost(ctx, decision, { injectFunFact: true, useAIFacts: true });

    if (post) {
      logPost(post);
    } else {
      log(`   ❌ Failed to generate ${postType} post`, "red");
    }
  }
}

async function main() {
  console.clear();
  log("\n🧠 INTELLIGENT BOTS SYSTEM - MANUAL TEST", "bright");
  log("=" .repeat(60), "reset");
  log("\nThis script tests the bot posting system with real API calls.", "reset");
  log("Make sure OPENAI_API_KEY is set for AI fun facts to work.\n", "yellow");

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  log(`OpenAI API Key: ${hasOpenAI ? "✅ Set" : "❌ Not set (AI facts will be skipped)"}`, hasOpenAI ? "green" : "red");

  try {
    // Run all tests
    await testSituationAnalysis();
    await testAIFunFacts();
    await testPostsWithFunFacts(); // NEW: Show what posts look like with fun facts!
    await testSinglePost();
    await testColdStart();

    logSection("✅ ALL TESTS COMPLETE");
    log("Check the output above to see generated posts and fun facts.", "green");
    log("Posts with AI-generated fun facts will have the [FunFactsAI] prefix in logs.\n", "cyan");
  } catch (error) {
    logSection("❌ TEST FAILED");
    console.error(error);
    process.exit(1);
  }
}

main();
