/**
 * API route for pulse creation with server-side moderation
 * This endpoint enforces content moderation and ownership rules
 *
 * SECURITY: Server-Authoritative Design
 * - Users CANNOT insert directly into pulses table (RLS denies all user writes)
 * - This API is the ONLY path to create pulses
 * - Uses SERVICE ROLE key to bypass RLS for writes
 * - Still authenticates users via bearer token to set user_id
 *
 * FAIL-CLOSED GUARANTEE (NON-NEGOTIABLE):
 * - If deterministic checks fail (PII/spam) -> reject 400, NO INSERT
 * - If deterministic checks pass -> AI moderation MUST still run before insert
 * - If AI moderation blocks -> reject 400, NO INSERT
 * - If AI moderation errors/times out/misconfigured/missing key -> reject 503, NO INSERT
 * - Production ALWAYS fails closed, regardless of MODERATION_FAIL_OPEN env var
 *
 * Safety Pipeline (Three-Layer Architecture):
 *
 * Layer 0 (PII Detection - First Pass):
 * - Detects personally identifiable information
 * - Blocks emails, phones, SSNs, credit cards, addresses, social handles
 * - Blocks spam/nonsense content
 * - Runs BEFORE content moderation to prevent PII from reaching AI services
 *
 * Layer A (Fast, Local):
 * 1. Dynamic blocklist - catches known problematic terms from database
 * 2. Local heuristics - catches obvious English profanity/obfuscations
 *
 * Layer B (Authoritative, AI):
 * 3. OpenAI Moderation API - catches multilingual, context, obfuscation
 * 4. Google Perspective API (optional) - supplementary toxicity signal
 *
 * Environment Variables:
 * - SUPABASE_SERVICE_ROLE_KEY: REQUIRED for server-side writes
 * - OPENAI_API_KEY: REQUIRED for AI moderation (posting fails without it)
 * - MODERATION_FAIL_OPEN: Optional, default "false" - IGNORED in production (always fail-closed)
 * - MODERATION_TIMEOUT_MS: Optional, default 2000
 * - MODERATION_HARASSMENT_SCORE_THRESHOLD: Optional, default 0.01
 * - PERSPECTIVE_API_KEY: Optional, enables Perspective API
 * - PII_FAIL_OPEN: Optional, default "false" (fail closed for PII)
 * - PII_BLOCK_SOCIAL_HANDLES: Optional, default "true"
 * - PII_ALLOW_NAMES: Optional, default "false"
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runModerationPipeline, quickModerateContent } from "@/lib/moderationPipeline";
import { detectPII, hashContentForLogging, logPIIDetection } from "@/lib/piiDetection";
import { checkRateLimit, RATE_LIMITS, buildRateLimitHeaders } from "@/lib/rateLimit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Create service role client for server-side writes (bypasses RLS)
// Reads env vars at call time to support testing
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[/api/pulses] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Server cannot write to database. All pulse creation will fail."
    );
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Create user client with token for auth verification
function getUserClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

type PulseCreatePayload = {
  city: string;
  mood: string;
  tag: string;
  message: string;
  author: string;
  user_id: string;
  neighborhood?: string;
};

/**
 * POST /api/pulses - Create a new pulse with server-side moderation
 *
 * SECURITY: This is the ONLY way to create pulses.
 * Direct database inserts are blocked by RLS.
 */
export async function POST(req: NextRequest) {
  try {
    // Get auth token from request header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Create Supabase client with user's token to verify authentication
    const userClient = getUserClient(token);

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Rate limiting - 5 pulses per hour per user
    const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.PULSE_CREATE);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. You can post ${rateLimitResult.limit} pulses per hour. Try again in ${Math.ceil(rateLimitResult.resetInSeconds / 60)} minutes.`,
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Get service role client for database writes
    const serviceClient = getServiceRoleClient();
    if (!serviceClient) {
      console.error("[/api/pulses] Service role client not available");
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { city, mood, tag, message, author, neighborhood } = body as Partial<PulseCreatePayload>;

    // Validate required fields
    if (!city || typeof city !== "string" || !city.trim()) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    if (!mood || typeof mood !== "string" || !mood.trim()) {
      return NextResponse.json(
        { error: "Mood is required" },
        { status: 400 }
      );
    }

    if (!tag || typeof tag !== "string" || !tag.trim()) {
      return NextResponse.json(
        { error: "Tag is required" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!author || typeof author !== "string" || !author.trim()) {
      return NextResponse.json(
        { error: "Author is required" },
        { status: 400 }
      );
    }

    // Validate message length
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 240) {
      return NextResponse.json(
        { error: "Message exceeds 240 character limit" },
        { status: 400 }
      );
    }

    // Generate request ID for telemetry
    const requestId = crypto.randomBytes(8).toString("hex");
    const contentHash = hashContentForLogging(trimmedMessage);

    // =========================================================================
    // PII DETECTION - Runs FIRST, before any AI moderation
    // This prevents PII from ever reaching external services
    // =========================================================================
    const piiResult = detectPII(trimmedMessage);

    if (piiResult.blocked) {
      // Log the PII detection (privacy-safe: no raw text, only categories and hash)
      logPIIDetection(requestId, piiResult, contentHash);

      return NextResponse.json(
        {
          error: piiResult.reason,
          code: "PII_DETECTED",
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // SERVER-SIDE MODERATION - This is the authoritative check
    // Uses the full moderation pipeline: blocklist -> local -> AI -> (optional) Perspective
    //
    // FAIL-CLOSED GUARANTEE:
    // - If moderation blocks content -> 400 (content rejected)
    // - If moderation service errors/times out/misconfigured -> 503 (service unavailable)
    // - Production NEVER fails open, regardless of MODERATION_FAIL_OPEN env var
    // =========================================================================
    const moderationResult = await runModerationPipeline(trimmedMessage);

    if (!moderationResult.allowed) {
      // Check if this was a service error (API timeout, missing key, etc.)
      // vs actual content being blocked by moderation rules
      if (moderationResult.serviceError) {
        // Service unavailable - return 503 with generic message
        // Do NOT reveal the specific error to prevent information disclosure
        console.error(
          "[/api/pulses] Moderation service unavailable - failing closed"
        );
        return NextResponse.json(
          {
            error: "Posting is temporarily unavailable. Please try again.",
            code: "SERVICE_UNAVAILABLE"
          },
          { status: 503 }
        );
      }

      // Content was actively blocked by moderation rules - return 400
      return NextResponse.json(
        {
          error: moderationResult.reason || "Message violates content guidelines",
          code: "MODERATION_FAILED"
        },
        { status: 400 }
      );
    }

    // Also moderate the author name (quick local check only for performance)
    const authorModeration = quickModerateContent(author.trim());
    if (!authorModeration.allowed) {
      return NextResponse.json(
        {
          error: "Author name violates content guidelines",
          code: "MODERATION_FAILED"
        },
        { status: 400 }
      );
    }

    // Validate tag is from allowed list
    const ALLOWED_TAGS = ["Traffic", "Weather", "Events", "General"];
    if (!ALLOWED_TAGS.includes(tag)) {
      return NextResponse.json(
        { error: "Invalid tag" },
        { status: 400 }
      );
    }

    // =========================================================================
    // INSERT PULSE using SERVICE ROLE (bypasses RLS)
    // The user_id is explicitly set from the verified auth context
    // =========================================================================
      console.error("[/api/pulses] ABOUT TO INSERT", {
        trimmedMessage,
        city,
        mood,
        tag,
        author,
        user_id: user?.id,
      });

    const { data, error: insertError } = await serviceClient
      .from("pulses")
      .insert([
        {
          city: city.trim(),
          mood: mood.trim(),
          tag: tag.trim(),
          message: trimmedMessage,
          author: author.trim(),
          user_id: user.id, // From verified auth, not from request body
          neighborhood: neighborhood?.trim() || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error(
        "[/api/pulses] Insert error:",
        JSON.stringify(insertError, null, 2)
      );
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ pulse: data });
  } catch (err) {
    console.error("[/api/pulses] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pulses - Delete a pulse (owner only)
 *
 * Uses the user's token directly since RLS allows owner deletes.
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get auth token from request header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Create Supabase client with user's token
    const supabase = getUserClient(token);

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Get pulse ID from URL
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    console.log("Attempting to delete pulse with ID:", id, "Type:", typeof id);

    const numericId = id ? parseInt(id, 10) : NaN;

    if (!id) {
      return NextResponse.json(
        { error: "Pulse ID is required" },
        { status: 400 }
      );
    }

    if (Number.isNaN(numericId)) {
      return NextResponse.json(
        { error: "Pulse ID must be a number" },
        { status: 400 }
      );
    }

    // First, verify ownership
    const { data: pulse, error: fetchError } = await supabase
      .from("pulses")
      .select("id, user_id")
      .eq("id", numericId)
      .single();

    if (fetchError) {
      console.error(
        "[/api/pulses] Fetch pulse for delete error:",
        JSON.stringify(fetchError, null, 2)
      );
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Pulse not found" }, { status: 404 });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pulse) {
      return NextResponse.json({ error: "Pulse not found" }, { status: 404 });
    }

    if (pulse.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own pulses" },
        { status: 403 }
      );
    }

    // Delete the pulse (RLS allows owner delete)
    const { error: deleteError } = await supabase
      .from("pulses")
      .delete()
      .eq("id", numericId);

    if (deleteError) {
      console.error(
        "[/api/pulses] Supabase delete error:",
        JSON.stringify(deleteError, null, 2)
      );
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/pulses] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
