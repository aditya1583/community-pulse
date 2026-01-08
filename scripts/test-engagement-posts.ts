/**
 * Test script for Engagement Posts
 *
 * Run with: npx ts-node scripts/test-engagement-posts.ts
 */

import {
  generatePollPost,
  generateRecommendationPost,
  generateVenueCheckinPost,
  generateSchoolAlertPost,
  generateLocalSpotlightPost,
  generateEngagementSeedPosts,
  LEANDER_CONFIG,
  buildSituationContext,
  buildTimeContext,
} from "../src/lib/intelligent-bots";

// Mock data for testing
const mockTraffic = {
  congestionLevel: 0.3,
  freeFlowSpeed: 45,
  currentSpeed: 35,
  incidents: [],
};

const mockWeather = {
  condition: "clear" as const,
  temperature: 75,
  feelsLike: 78,
  humidity: 45,
  uvIndex: 6,
  windSpeed: 8,
  precipitation: 0,
};

const mockEvents = [
  {
    name: "Live Music at Old Settlers Park",
    venue: "Old Settlers Park",
    startTime: new Date(),
    category: "music",
  },
];

async function testEngagementPosts() {
  console.log("\n🧪 Testing Engagement Post Generation\n");
  console.log("=".repeat(60));

  // Build context
  const ctx = buildSituationContext(
    LEANDER_CONFIG,
    mockTraffic,
    mockWeather,
    mockEvents
  );

  // Test Poll Post
  console.log("\n📊 POLL POST:");
  const pollPost = await generatePollPost(ctx);
  if (pollPost) {
    console.log(`  Author: ${pollPost.author}`);
    console.log(`  Message: ${pollPost.message}`);
    console.log(`  Mood: ${pollPost.mood}`);
  } else {
    console.log("  (No poll generated)");
  }

  // Test Recommendation Post
  console.log("\n🤔 RECOMMENDATION POST:");
  const recPost = await generateRecommendationPost(ctx);
  if (recPost) {
    console.log(`  Author: ${recPost.author}`);
    console.log(`  Message: ${recPost.message}`);
    console.log(`  Mood: ${recPost.mood}`);
  } else {
    console.log("  (No recommendation generated)");
  }

  // Test Venue Check-in
  console.log("\n📍 VENUE CHECK-IN POST:");
  const venuePost = await generateVenueCheckinPost(ctx);
  if (venuePost) {
    console.log(`  Author: ${venuePost.author}`);
    console.log(`  Message: ${venuePost.message}`);
    console.log(`  Mood: ${venuePost.mood}`);
  } else {
    console.log("  (No venue check-in generated - might be wrong time)");
  }

  // Test Local Spotlight (Munching Bot!)
  console.log("\n🍔 LOCAL SPOTLIGHT (MUNCHING BOT):");
  const spotlightPost = await generateLocalSpotlightPost(ctx);
  if (spotlightPost) {
    console.log(`  Author: ${spotlightPost.author}`);
    console.log(`  Message: ${spotlightPost.message}`);
    console.log(`  Mood: ${spotlightPost.mood}`);
  } else {
    console.log("  (No spotlight generated)");
  }

  // Test School Alert (mock school dismissal time)
  console.log("\n🏫 SCHOOL ALERT:");
  // Create a context where it's near school dismissal (2:45 PM)
  const schoolCtx = {
    ...ctx,
    time: {
      ...ctx.time,
      hour: 14, // 2 PM
      isWeekday: true,
    },
  };
  const schoolPost = await generateSchoolAlertPost(schoolCtx);
  if (schoolPost) {
    console.log(`  Author: ${schoolPost.author}`);
    console.log(`  Message: ${schoolPost.message}`);
    console.log(`  Mood: ${schoolPost.mood}`);
  } else {
    console.log("  (No school alert - not near dismissal time)");
  }

  // Test Seed Posts with Engagement
  console.log("\n🌱 ENGAGEMENT SEED POSTS (Multiple):");
  const seedPosts = await generateEngagementSeedPosts(ctx, 3);
  seedPosts.forEach((post, i) => {
    console.log(`\n  [${i + 1}] ${post.engagementType.toUpperCase()}:`);
    console.log(`      Author: ${post.author}`);
    console.log(`      Message: ${post.message}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ Engagement post testing complete!\n");
}

testEngagementPosts().catch(console.error);
