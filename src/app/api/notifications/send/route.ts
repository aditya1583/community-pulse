/**
 * Send Push Notification API
 *
 * POST /api/notifications/send
 * Body: { userId, title, body, data, type }
 *
 * Sends native push notifications via APNs using HTTP/2 with token-based auth.
 * Also stores the notification in the notifications table.
 *
 * Rate limiting: max 5 notifications per user per hour.
 * Batching: groups similar notifications within 5-minute windows.
 *
 * APNs Auth Requirements (env vars):
 *   APNS_KEY_ID      - Key ID from Apple Developer portal
 *   APNS_TEAM_ID     - Team ID from Apple Developer portal
 *   APNS_KEY_BASE64  - Base64-encoded .p8 key file contents
 *   APNS_BUNDLE_ID   - App bundle ID (default: app.voxlo)
 *   APNS_ENVIRONMENT  - 'production' or 'development' (default: production)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RATE_LIMIT_MAX = 5; // per user per hour
const BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getServiceClient() {
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
  const environment = process.env.APNS_ENVIRONMENT || "production";

  if (!keyId || !teamId || !keyBase64) {
    return null;
  }

  return { keyId, teamId, keyBase64, bundleId, environment };
}

function generateAPNsJWT(keyId: string, teamId: string, keyBase64: string): string {
  // Check cache (tokens valid for 1 hour, refresh at 50 min)
  const now = Math.floor(Date.now() / 1000);
  if (cachedJWT && cachedJWT.expiresAt > now) {
    return cachedJWT.token;
  }

  // Decode the .p8 key
  const key = Buffer.from(keyBase64, "base64").toString("utf-8");

  // Create JWT header and payload
  const header = Buffer.from(JSON.stringify({
    alg: "ES256",
    kid: keyId,
  })).toString("base64url");

  const payload = Buffer.from(JSON.stringify({
    iss: teamId,
    iat: now,
  })).toString("base64url");

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
  r.copy(rPad, 32 - r.length > 0 ? 32 - r.length : 0, r.length > 32 ? r.length - 32 : 0);
  s.copy(sPad, 32 - s.length > 0 ? 32 - s.length : 0, s.length > 32 ? s.length - 32 : 0);

  return Buffer.concat([rPad, sPad]);
}

// ============================================================================
// APNs SENDING
// ============================================================================

async function sendAPNs(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  config: NonNullable<ReturnType<typeof getAPNsConfig>>
): Promise<{ success: boolean; error?: string }> {
  const jwt = generateAPNsJWT(config.keyId, config.teamId, config.keyBase64);

  const host =
    config.environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

  const apnsPayload = {
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 1,
      "mutable-content": 1,
    },
    ...data,
  };

  try {
    const res = await fetch(`${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": config.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "content-type": "application/json",
      },
      body: JSON.stringify(apnsPayload),
    });

    if (res.ok) {
      return { success: true };
    }

    const errBody = await res.text();
    console.error(`[APNs] Failed (${res.status}):`, errBody);

    return { success: false, error: `APNs ${res.status}: ${errBody}` };
  } catch (err) {
    console.error("[APNs] Fetch error:", err);
    return { success: false, error: String(err) };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, title, body: notifBody, data = {}, type } = body as {
      userId?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
      type?: string;
    };

    if (!userId || !title || !notifBody || !type) {
      return NextResponse.json(
        { error: "userId, title, body, and type are required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // --- Rate limit check: max 5 per user per hour ---
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Rate limit: max 5 notifications per hour", rateLimited: true },
        { status: 429 }
      );
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
      // Add to existing batch (don't send yet)
      await supabase.from("notification_batch_queue").insert({
        user_id: userId,
        type,
        title,
        body: notifBody,
        data,
        batch_key: batchKey,
        sent: false,
      });

      // Count pending in this batch
      const { count: batchCount } = await supabase
        .from("notification_batch_queue")
        .select("id", { count: "exact", head: true })
        .eq("batch_key", batchKey)
        .eq("sent", false)
        .gte("created_at", fiveMinAgo);

      // After batch window, this would be flushed by a cron.
      // For now, return that it's batched.
      return NextResponse.json({
        success: true,
        batched: true,
        batchCount,
        message: `Notification batched (${batchCount} pending)`,
      });
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
        return NextResponse.json({ success: true, skipped: true, reason: "User preference disabled" });
      }
    }

    // --- Store notification in inbox ---
    await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body: notifBody,
      data,
    });

    // --- Send via APNs (async, don't block response) ---
    const apnsConfig = getAPNsConfig();
    if (apnsConfig) {
      // Get user's iOS push tokens
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", userId)
        .eq("platform", "ios");

      if (tokens && tokens.length > 0) {
        // Fire and forget - don't await
        Promise.all(
          tokens.map((t) =>
            sendAPNs(t.token, title, notifBody, data, apnsConfig).then((result) => {
              if (!result.success && result.error?.includes("BadDeviceToken")) {
                // Clean up invalid tokens
                supabase.from("push_tokens").delete().eq("token", t.token).then(() => {});
              }
            })
          )
        ).catch((err) => console.error("[notifications/send] APNs batch error:", err));
      }
    } else {
      console.warn("[notifications/send] APNs not configured - notification stored but not pushed");
    }

    // Mark batch entry as sent
    await supabase.from("notification_batch_queue").insert({
      user_id: userId,
      type,
      title,
      body: notifBody,
      data,
      batch_key: batchKey,
      sent: true,
    });

    return NextResponse.json({ success: true, sent: true });
  } catch (err) {
    console.error("[notifications/send] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
