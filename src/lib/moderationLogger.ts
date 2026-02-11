/**
 * Moderation Logger - Logs blocked/held/redacted content to ops_moderation_log
 *
 * Privacy-first: stores content hashes only, never raw content.
 * Uses Supabase service role for writes. Fails silently (logging should never block the pipeline).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export type ModerationLogEntry = {
  userId?: string;       // will be hashed before storage
  content: string;       // will be hashed before storage, never stored raw
  category: string;
  confidenceScore?: number;
  layer: string;         // blocklist | local | pii | ai | perspective
  action: string;        // blocked | held | redacted
  endpoint?: string;     // e.g. /api/pulses, /api/pulses/[id]/comments
};

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Log a moderation event to ops_moderation_log.
 * Fire-and-forget — never throws, never blocks the request.
 */
export async function logModerationEvent(entry: ModerationLogEntry): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;

    await client.from("ops_moderation_log").insert({
      user_id: entry.userId ? hashValue(entry.userId) : null,
      content_hash: hashValue(entry.content),
      category: entry.category,
      confidence_score: entry.confidenceScore ?? null,
      layer: entry.layer,
      action: entry.action,
      endpoint: entry.endpoint ?? null,
    });
  } catch (err) {
    // Silent fail — logging must never break the pipeline
    console.error("[moderationLogger] Failed to log:", err instanceof Error ? err.message : err);
  }
}
