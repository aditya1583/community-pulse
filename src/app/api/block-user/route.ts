import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RATE_LIMITS, buildRateLimitHeaders } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Block/Unblock User API
 *
 * POST: Block a user (hides their content from your feed)
 * DELETE: Unblock a user
 *
 * Apple Review requirement: blocking must also notify the developer
 * and remove blocked user's content from the blocker's feed instantly.
 */

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Authentication required", status: 401 };
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: "Server configuration error", status: 500 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { user: null, error: "Invalid or expired session", status: 401 };
  }

  return { user, supabase, error: null, status: 200 };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Rate limit: 20 blocks per day
    const rateLimitResult = checkRateLimit(auth.user.id, RATE_LIMITS.REPORT);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: buildRateLimitHeaders(rateLimitResult) }
      );
    }

    const { blockedUserId, reason } = await req.json();

    if (!blockedUserId || typeof blockedUserId !== "string") {
      return NextResponse.json({ error: "Invalid blockedUserId" }, { status: 400 });
    }

    // Can't block yourself
    if (blockedUserId === auth.user.id) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
    }

    // Use service role to insert (bypasses RLS for the notification log)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    );

    // Insert block record
    const { error: blockError } = await adminClient
      .from("blocked_users")
      .insert({
        blocker_id: auth.user.id,
        blocked_id: blockedUserId,
        reason: reason || null,
      });

    if (blockError) {
      if (blockError.code === "23505") {
        return NextResponse.json({ error: "User already blocked" }, { status: 409 });
      }
      console.error("[block-user] Insert error:", blockError);
      return NextResponse.json({ error: "Failed to block user" }, { status: 500 });
    }

    // Log for developer notification (Apple requirement: blocking notifies developer)
    console.log(`[MODERATION] User ${auth.user.id} blocked user ${blockedUserId}. Reason: ${reason || "none"}`);

    // Also insert into ops_moderation_log for developer review
    await adminClient.from("ops_moderation_log").insert({
      action: "user_blocked",
      details: JSON.stringify({
        blocker_id: auth.user.id,
        blocked_id: blockedUserId,
        reason: reason || null,
      }),
    }).catch(() => {}); // Best effort

    return NextResponse.json({
      success: true,
      message: "User blocked. Their content will no longer appear in your feed.",
    });
  } catch (error) {
    console.error("[block-user] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { blockedUserId } = await req.json();

    if (!blockedUserId || typeof blockedUserId !== "string") {
      return NextResponse.json({ error: "Invalid blockedUserId" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", auth.user.id)
      .eq("blocked_id", blockedUserId);

    if (error) {
      console.error("[block-user] Delete error:", error);
      return NextResponse.json({ error: "Failed to unblock user" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "User unblocked.",
    });
  } catch (error) {
    console.error("[block-user] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET: List blocked users for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await auth.supabase
      .from("blocked_users")
      .select("blocked_id, reason, created_at")
      .eq("blocker_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[block-user] List error:", error);
      return NextResponse.json({ error: "Failed to list blocked users" }, { status: 500 });
    }

    return NextResponse.json({ blockedUsers: data || [] });
  } catch (error) {
    console.error("[block-user] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
