/**
 * Test script for Engagement Posts
 *
 * Run with: npx tsx scripts/test-engagement-posts.ts
 */

import {
  generatePollPost,
  generateRecommendationPost,
  generateVenueCheckinPost,
  generateSchoolAlertPost,
  generateLocalSpotlightPost,
  generateThisOrThatPost,
  generateFomoAlertPost,
  generateWeeklyRoundupPost,
  generateEngagementSeedPosts,
  LEANDER_CONFIG,
  buildSituationContext,
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
    startTime: new Date(Date.now() + 45 * 60 * 1000), // 45 min from now
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

  // Test This or That (NEW!)
  console.log("\n⚔️ THIS OR THAT POST:");
  const thisOrThatPost = await generateThisOrThatPost(ctx);
  if (thisOrThatPost) {
    console.log(`  Author: ${thisOrThatPost.author}`);
    console.log(`  Message: ${thisOrThatPost.message}`);
    console.log(`  Options: ${thisOrThatPost.options?.join(" vs ")}`);
    console.log(`  Mood: ${thisOrThatPost.mood}`);
  } else {
    console.log("  (No This or That generated)");
  }

  // Test FOMO Alert (NEW!)
  console.log("\n⚡ FOMO ALERT POST:");
  // Create a context for happy hour time (4 PM on weekday)
  const fomoCtx = {
    ...ctx,
    time: {
      ...ctx.time,
      hour: 16,
      isWeekday: true,
    },
  };
  const fomoPost = await generateFomoAlertPost(fomoCtx);
  if (fomoPost) {
    console.log(`  Author: ${fomoPost.author}`);
    console.log(`  Message: ${fomoPost.message}`);
    console.log(`  Mood: ${fomoPost.mood}`);
  } else {
    console.log("  (No FOMO alert generated - conditions not met)");
  }

  // Test Weekly Roundup (NEW!)
  console.log("\n📰 WEEKLY ROUNDUP POST:");
  // Create a weekend context
  const weekendCtx = {
    ...ctx,
    time: {
      ...ctx.time,
      dayOfWeek: 6, // Saturday
      isWeekend: true,
    },
  };
  const roundupPost = await generateWeeklyRoundupPost(weekendCtx);
  if (roundupPost) {
    console.log(`  Author: ${roundupPost.author}`);
    console.log(`  Message:\n${roundupPost.message.split('\n').map(l => `    ${l}`).join('\n')}`);
    console.log(`  Mood: ${roundupPost.mood}`);
  } else {
    console.log("  (No Weekly Roundup generated - not weekend)");
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
  const seedPosts = await generateEngagementSeedPosts(weekendCtx, 4);
  seedPosts.forEach((post, i) => {
    console.log(`\n  [${i + 1}] ${post.engagementType.toUpperCase()}:`);
    console.log(`      Author: ${post.author}`);
    console.log(`      Message: ${post.message.split('\n')[0]}${post.message.includes('\n') ? '...' : ''}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ All engagement post types tested!\n");
}

testEngagementPosts().catch(console.error);
