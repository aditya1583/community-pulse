/**
 * sendNotificationDirect
 *
 * Shared core notification logic — called directly (no internal HTTP fetch).
 * Used by:
 *   - lib/notificationTriggers.ts  (server-side triggers)
 *   - app/api/notifications/send/route.ts  (external HTTP callers)
 *
 * Extracted from app/api/notifications/send/route.ts to avoid internal
 * fetch() calls on Vercel serverless (which silently fail).
 */

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RATE_LIMIT_MAX = 5; // per user per hour
const BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================================
// APNs JWT TOKEN GENERATION
// ============================================================================

let cachedJWT: { token: string; expiresAt: number } | null = null;

function getAPNsConfig() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyBase64 = process.env.APNS_KEY_BASE64;
  const bundleId = process.env.APNS_BUNDLE_ID || "app.voxlo";
  // TestFlight and App Store builds ALWAYS use production APNs.
  // Only use sandbox for local dev builds installed via Xcode.
  const environment =
    process.env.APNS_ENVIRONMENT === "development" ? "development" : "production";

  if (!keyId || !teamId || !keyBase64) {
    return null;
  }

  return { keyId, teamId, keyBase64, bundleId, environment };
}

function generateAPNsJWT(
  keyId: string,
  teamId: string,
  keyBase64: string
): string {
  // Check cache (tokens valid for 1 hour, refresh at 50 min)
  const now = Math.floor(Date.now() / 1000);
  if (cachedJWT && cachedJWT.expiresAt > now) {
    return cachedJWT.token;
  }

  // Decode the .p8 key
  const key = Buffer.from(keyBase64, "base64").toString("utf-8");

  // Create JWT header and payload
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: keyId })
  ).toString("base64url");

  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: now })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;

  // Sign with ES256 (ECDSA P-256 + SHA-256)
  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  const derSignature = sign.sign(key);

  // Convert DER signature to raw r||s format for JWT
  const rawSig = derToRaw(derSignature);
  const signature = rawSig.toString("base64url");

  const token = `${signingInput}.${signature}`;

  // Cache for 50 minutes (APNs tokens valid for 1 hour)
  cachedJWT = { token, expiresAt: now + 3000 };

  return token;
}

/** Convert DER-encoded ECDSA signature to raw r||s format */
function derToRaw(der: Buffer): Buffer {
  // DER: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
  let offset = 2; // skip 0x30 and total length
  offset += 1; // skip 0x02 for r

  const rLen = der[offset++];
  const r = der.subarray(offset, offset + rLen);
  offset += rLen;

  offset += 1; // skip 0x02 for s
  const sLen = der[offset++];
  const s = der.subarray(offset, offset + sLen);

  // Pad/trim to 32 bytes each
  const rPad = Buffer.alloc(32);
  const sPad = Buffer.alloc(32);
  r.copy(
    rPad,
    32 - r.length > 0 ? 32 - r.length : 0,
    r.length > 32 ? r.length - 32 : 0
  );
  s.copy(
    sPad,
    32 - s.length > 0 ? 32 - s.length : 0,
    s.length > 32 ? s.length - 32 : 0
  );

  return Buffer.concat([rPad, sPad]);
}

// ============================================================================
// APNs SENDING
// ============================================================================

export async function sendAPNs(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  config: NonNullable<ReturnType<typeof getAPNsConfig>>
): Promise<{ success: boolean; error?: string }> {
  const jwtToken = generateAPNsJWT(
    config.keyId,
    config.teamId,
    config.keyBase64
  );

  const host =
    config.environment === "production"
      ? "api.push.apple.com"
      : "api.sandbox.push.apple.com";

  const apnsPayload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 1,
      "mutable-content": 1,
    },
    ...data,
  });

  // APNs REQUIRES HTTP/2 — Node.js fetch may not negotiate it.
  // Use the native http2 module for guaranteed HTTP/2 support.
  const http2 = await import("http2");

  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);

    client.on("error", (err) => {
      console.error("[APNs] HTTP/2 connection error:", err);
      client.close();
      resolve({ success: false, error: `Connection error: ${String(err)}` });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwtToken}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(apnsPayload),
    });

    let responseData = "";
    let statusCode = 0;

    req.on("response", (headers) => {
      statusCode = headers[":status"] as number;
    });

    req.on("data", (chunk: Buffer) => {
      responseData += chunk.toString();
    });

    req.on("end", () => {
      client.close();
      if (statusCode === 200) {
        console.log(
          "[APNs] ✅ Push delivered to",
          deviceToken.substring(0, 10) + "..."
        );
        resolve({ success: true });
      } else {
        console.error(`[APNs] ❌ Failed (${statusCode}):`, responseData);
        resolve({
          success: false,
          error: `APNs ${statusCode}: ${responseData}`,
        });
      }
    });

    req.on("error", (err) => {
      client.close();
      console.error("[APNs] Request error:", err);
      resolve({ success: false, error: String(err) });
    });

    // Set timeout
    req.setTimeout(10000, () => {
      req.close();
      client.close();
      resolve({ success: false, error: "APNs request timeout (10s)" });
    });

    req.write(apnsPayload);
    req.end();
  });
}

// ============================================================================
// RESULT TYPE
// ============================================================================

export type SendNotificationResult =
  | { success: true; sent: true }
  | { success: true; batched: true; batchCount: number | null }
  | { success: true; skipped: true; reason: string }
  | { success: false; rateLimited: true }
  | { success: false; error: string };

// ============================================================================
// CORE SEND FUNCTION
// ============================================================================

/**
 * Send a push notification directly (no HTTP roundtrip).
 *
 * Performs:
 *  1. Rate limit check  (5/hr per user)
 *  2. Batch dedup check (5-min window)
 *  3. Notification preference check
 *  4. Store in `notifications` table
 *  5. Send via APNs
 *  6. Mark batch entry as sent
 */
export async function sendNotificationDirect(
  userId: string,
  title: string,
  body: string,
  type: string,
  data: Record<string, unknown> = {}
): Promise<SendNotificationResult> {
  const supabase = getServiceClient();
  if (!supabase) {
    return { success: false, error: "Supabase client unavailable — check env vars" };
  }

  // --- Rate limit check: max 5 per user per hour ---
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    console.warn(
      `[sendNotificationDirect] Rate limited user ${userId} (${recentCount} in last hour)`
    );
    return { success: false, rateLimited: true };
  }

  // --- Batch check: group similar notifications within 5-min window ---
  const batchKey = `${type}:${userId}`;
  const fiveMinAgo = new Date(Date.now() - BATCH_WINDOW_MS).toISOString();
  const { data: pendingBatch } = await supabase
    .from("notification_batch_queue")
    .select("id, created_at")
    .eq("batch_key", batchKey)
    .eq("sent", false)
    .gte("created_at", fiveMinAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  if (pendingBatch && pendingBatch.length > 0) {
    // Add to existing batch (don't send yet — batch window still open)
    await supabase.from("notification_batch_queue").insert({
      user_id: userId,
      type,
      title,
      body,
      data,
      batch_key: batchKey,
      sent: false,
    });

    const { count: batchCount } = await supabase
      .from("notification_batch_queue")
      .select("id", { count: "exact", head: true })
      .eq("batch_key", batchKey)
      .eq("sent", false)
      .gte("created_at", fiveMinAgo);

    console.log(
      `[sendNotificationDirect] Batched ${type} for user ${userId} (${batchCount} pending)`
    );
    return { success: true, batched: true, batchCount };
  }

  // --- Check notification preferences ---
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (prefs) {
    const prefMap: Record<string, boolean> = {
      nearby_post: prefs.nearby_posts,
      reaction: prefs.reactions,
      comment: prefs.comments,
      event: prefs.events,
      traffic_alert: prefs.traffic_alerts,
    };
    if (prefMap[type] === false) {
      console.log(
        `[sendNotificationDirect] Skipped ${type} for user ${userId} — preference disabled`
      );
      return { success: true, skipped: true, reason: "User preference disabled" };
    }
  }

  // --- Store notification in inbox ---
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    data,
  });

  // --- Send via APNs ---
  const apnsConfig = getAPNsConfig();
  if (apnsConfig) {
    console.log(
      "[sendNotificationDirect] APNs configured, environment:",
      apnsConfig.environment,
      "bundleId:",
      apnsConfig.bundleId
    );

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("platform", "ios");

    console.log(
      "[sendNotificationDirect] Found",
      tokens?.length ?? 0,
      "push tokens for user",
      userId
    );

    if (tokens && tokens.length > 0) {
      const results = await Promise.allSettled(
        tokens.map(async (t) => {
          const result = await sendAPNs(t.token, title, body, data, apnsConfig);
          console.log(
            "[sendNotificationDirect] APNs result for token",
            t.token.substring(0, 10) + "...:",
            JSON.stringify(result)
          );
          if (result.error?.includes("BadDeviceToken")) {
            await supabase.from("push_tokens").delete().eq("token", t.token);
            console.log(
              "[sendNotificationDirect] Cleaned up bad token:",
              t.token.substring(0, 10) + "..."
            );
          }
          return result;
        })
      );
      console.log(
        "[sendNotificationDirect] APNs send complete:",
        results.length,
        "tokens processed"
      );
    } else {
      console.log(
        "[sendNotificationDirect] No push tokens found for user — notification stored in DB only"
      );
    }
  } else {
    console.warn(
      "[sendNotificationDirect] APNs NOT configured — missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_KEY_BASE64"
    );
  }

  // --- Mark batch entry as sent ---
  await supabase.from("notification_batch_queue").insert({
    user_id: userId,
    type,
    title,
    body,
    data,
    batch_key: batchKey,
    sent: true,
  });

  return { success: true, sent: true };
}
