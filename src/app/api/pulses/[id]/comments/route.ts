/**
 * Pulse Comments API
 *
 * GET /api/pulses/[id]/comments - Get comments for a pulse
 * POST /api/pulses/[id]/comments - Add a new comment
 *
 * Security:
 * - Rate limited (5 comments per minute per IP)
 * - Content moderation via quickModerateContent
 * - Validates pulse exists and is not expired
 * - Sanitizes userIdentifier
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runModerationPipeline } from "@/lib/moderationPipeline";

export const dynamic = "force-dynamic";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CommentRequestBody {
  userIdentifier: string;
  message: string;
}

interface Comment {
  id: string;
  pulse_id: number;
  user_identifier: string;
  message: string;
  created_at: string;
}

interface CommentsResponse {
  success: boolean;
  comments: Comment[];
  totalCount: number;
  hasMore: boolean;
}

// ============================================================================
// RATE LIMITING (In-memory, resets on server restart)
// ============================================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 comments per minute per IP

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

function sanitizeMessage(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;
  return trimmed;
}

function isPulseExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// Pagination
const PAGE_SIZE = 20;

// ============================================================================
// GET - Get comments for a pulse
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

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor"); // For pagination
  const limit = Math.min(parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10), 50);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Build query
    let query = supabase
      .from("pulse_comments")
      .select("id, pulse_id, user_identifier, message, created_at", { count: "exact" })
      .eq("pulse_id", pulseId)
      .eq("hidden", false)
      .order("created_at", { ascending: true }) // Oldest first for thread readability
      .limit(limit + 1); // Fetch one extra to check if there's more

    // Cursor-based pagination
    if (cursor) {
      query = query.gt("created_at", cursor);
    }

    const { data: comments, error, count } = await query;

    if (error) {
      console.error("[CommentsAPI] Error fetching comments:", error);
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    const hasMore = comments ? comments.length > limit : false;
    const resultComments = hasMore ? comments.slice(0, limit) : (comments || []);

    return NextResponse.json({
      success: true,
      comments: resultComments,
      totalCount: count || 0,
      hasMore,
    } satisfies CommentsResponse);
  } catch (error) {
    console.error("[CommentsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// POST - Add a new comment
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
      { error: "Too many comments. Please wait before commenting again.", resetIn: Math.ceil(rateLimit.resetIn / 1000) },
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
    const body: CommentRequestBody = await request.json();
    const userIdentifier = sanitizeUserIdentifier(body.userIdentifier);
    const message = sanitizeMessage(body.message);

    if (!userIdentifier) {
      return NextResponse.json({ error: "Valid user identifier required" }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "Comment message required (1-500 characters)" }, { status: 400 });
    }

    // Check if pulse exists and is not expired
    const { data: pulse, error: pulseError } = await supabase
      .from("pulses")
      .select("id, expires_at")
      .eq("id", pulseId)
      .single();

    if (pulseError || !pulse) {
      return NextResponse.json({ error: "Pulse not found" }, { status: 404 });
    }

    // Check if pulse is expired
    if (isPulseExpired(pulse.expires_at)) {
      return NextResponse.json({ error: "Cannot comment on expired pulses" }, { status: 410 });
    }

    // Content moderation (full pipeline with AI for multilingual support)
    const moderationResult = await runModerationPipeline(message);
    if (!moderationResult.allowed) {
      return NextResponse.json(
        { error: moderationResult.reason || "Comment violates content guidelines", code: "MODERATION_FAILED" },
        { status: moderationResult.serviceError ? 503 : 400 }
      );
    }

    // Also moderate the user identifier
    const authorModeration = await runModerationPipeline(userIdentifier);
    if (!authorModeration.allowed) {
      return NextResponse.json(
        { error: "Username violates content guidelines", code: "MODERATION_FAILED" },
        { status: authorModeration.serviceError ? 503 : 400 }
      );
    }

    // Insert the comment
    const { data: newComment, error: insertError } = await supabase
      .from("pulse_comments")
      .insert({
        pulse_id: pulseId,
        user_identifier: userIdentifier,
        message: message,
      })
      .select("id, pulse_id, user_identifier, message, created_at")
      .single();

    if (insertError) {
      console.error("[CommentsAPI] Insert error:", insertError);
      return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
    }

    // Get updated comment count
    const { count } = await supabase
      .from("pulse_comments")
      .select("id", { count: "exact", head: true })
      .eq("pulse_id", pulseId)
      .eq("hidden", false);

    return NextResponse.json({
      success: true,
      comment: newComment,
      totalCount: count || 1,
    }, {
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    console.error("[CommentsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
