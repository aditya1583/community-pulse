/**
 * Poll Voting API
 *
 * POST /api/pulses/[id]/vote - Cast or change vote
 * GET /api/pulses/[id]/vote - Get vote counts and user's vote
 *
 * Security:
 * - Rate limited (10 votes per minute per IP)
 * - Validates option index bounds
 * - Checks pulse expiry
 * - Sanitizes userIdentifier
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface VoteRequestBody {
  userIdentifier: string;
  optionIndex: number;
}

interface VoteResponse {
  success: boolean;
  votes: Record<string, number>;  // { "0": 12, "1": 8 }
  totalVotes: number;
  userVote: number | null;        // Which option user voted for
}

// ============================================================================
// RATE LIMITING (In-memory, resets on server restart)
// For production, use Redis or similar
// ============================================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 votes per minute per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetIn: entry.resetAt - now };
}

function getClientIP(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         request.headers.get("x-real-ip") ||
         "unknown";
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function sanitizeUserIdentifier(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  // Only allow alphanumeric, spaces, and common characters
  if (!/^[\w\s\-_.@]+$/i.test(trimmed)) return null;
  return trimmed;
}

function isPulseExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ============================================================================
// GET - Get poll vote counts and user's vote
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pulseId = parseInt(id, 10);

  if (isNaN(pulseId) || pulseId <= 0) {
    return NextResponse.json({ error: "Invalid pulse ID" }, { status: 400 });
  }

  // Get userIdentifier from header (more private than query param)
  // Fall back to query param for backwards compatibility
  const { searchParams } = new URL(request.url);
  const rawUserIdentifier = request.headers.get("x-user-identifier") || searchParams.get("userIdentifier");
  const userIdentifier = sanitizeUserIdentifier(rawUserIdentifier);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all votes for this pulse using a count query for efficiency
    const { data: votes, error: votesError } = await supabase
      .from("poll_votes")
      .select("option_index, user_identifier")
      .eq("pulse_id", pulseId);

    if (votesError) {
      console.error("[VoteAPI] Error fetching votes:", votesError);
      return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
    }

    // Count votes per option
    const voteCounts: Record<string, number> = {};
    let userVote: number | null = null;

    for (const vote of votes || []) {
      const key = String(vote.option_index);
      voteCounts[key] = (voteCounts[key] || 0) + 1;

      if (userIdentifier && vote.user_identifier === userIdentifier) {
        userVote = vote.option_index;
      }
    }

    const totalVotes = votes?.length || 0;

    return NextResponse.json({
      success: true,
      votes: voteCounts,
      totalVotes,
      userVote,
    } satisfies VoteResponse);
  } catch (error) {
    console.error("[VoteAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// POST - Cast or change vote
// ============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many votes. Please wait before voting again.", resetIn: Math.ceil(rateLimit.resetIn / 1000) },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const { id } = await params;
  const pulseId = parseInt(id, 10);

  if (isNaN(pulseId) || pulseId <= 0) {
    return NextResponse.json({ error: "Invalid pulse ID" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: VoteRequestBody = await request.json();
    const userIdentifier = sanitizeUserIdentifier(body.userIdentifier);
    const { optionIndex } = body;

    if (!userIdentifier) {
      return NextResponse.json({ error: "Valid user identifier required" }, { status: 400 });
    }

    if (typeof optionIndex !== "number" || optionIndex < 0 || !Number.isInteger(optionIndex)) {
      return NextResponse.json({ error: "Valid option index required" }, { status: 400 });
    }

    // Check if pulse exists, has poll options, and is not expired
    const { data: pulse, error: pulseError } = await supabase
      .from("pulses")
      .select("id, poll_options, expires_at")
      .eq("id", pulseId)
      .single();

    if (pulseError || !pulse) {
      return NextResponse.json({ error: "Pulse not found" }, { status: 404 });
    }

    // Check if pulse is expired
    if (isPulseExpired(pulse.expires_at)) {
      return NextResponse.json({ error: "This poll has expired" }, { status: 410 });
    }

    // Validate option index against poll options (check upper bound!)
    const pollOptions = pulse.poll_options as string[] | null;
    if (!pollOptions || !Array.isArray(pollOptions) || pollOptions.length < 2) {
      return NextResponse.json({ error: "This pulse is not a poll" }, { status: 400 });
    }

    if (optionIndex >= pollOptions.length) {
      return NextResponse.json({ error: "Invalid option index" }, { status: 400 });
    }

    // Check if user already voted - use upsert for atomic operation
    const { error: upsertError } = await supabase
      .from("poll_votes")
      .upsert(
        {
          pulse_id: pulseId,
          user_identifier: userIdentifier,
          option_index: optionIndex,
        },
        {
          onConflict: "pulse_id,user_identifier",
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      console.error("[VoteAPI] Upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
    }

    // Get updated vote counts efficiently using aggregation
    const { data: votes, error: countError } = await supabase
      .from("poll_votes")
      .select("option_index")
      .eq("pulse_id", pulseId);

    if (countError) {
      console.error("[VoteAPI] Count error:", countError);
      // Vote was cast, just return what we know
      return NextResponse.json({
        success: true,
        votes: { [String(optionIndex)]: 1 },
        totalVotes: 1,
        userVote: optionIndex,
      } satisfies VoteResponse);
    }

    const voteCounts: Record<string, number> = {};
    for (const vote of votes || []) {
      const key = String(vote.option_index);
      voteCounts[key] = (voteCounts[key] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      votes: voteCounts,
      totalVotes: votes?.length || 0,
      userVote: optionIndex,
    } satisfies VoteResponse, {
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    console.error("[VoteAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
