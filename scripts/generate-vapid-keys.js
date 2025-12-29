#!/usr/bin/env node

/**
 * Generate VAPID Keys for Web Push Notifications
 *
 * Run this script once to generate the keys, then add them to your environment:
 *
 * VAPID_PUBLIC_KEY=...
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY=...  (same as above, for client)
 * VAPID_PRIVATE_KEY=...
 * VAPID_SUBJECT=mailto:your-email@example.com
 *
 * Usage:
 *   node scripts/generate-vapid-keys.js
 *
 * Or using npx directly:
 *   npx web-push generate-vapid-keys
 */

const webpush = require("web-push");

const vapidKeys = webpush.generateVAPIDKeys();

console.log("\n=== VAPID Keys Generated ===\n");
console.log("Add these to your .env.local file:\n");
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:hello@communitypulse.app`);
console.log("\n=============================\n");
console.log("IMPORTANT: Keep VAPID_PRIVATE_KEY secret! Never commit it to git.");
console.log("The NEXT_PUBLIC_VAPID_PUBLIC_KEY is safe to expose to clients.\n");
