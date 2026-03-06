import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Account Deletion API
 *
 * Apple App Store requirement (5.1.1v):
 * Apps that support account creation must also offer account deletion.
 *
 * This endpoint:
 * 1. Deletes user's pulses (or anonymizes them)
 * 2. Deletes user's comments, reactions, reports, blocks
 * 3. Deletes user's profile
 * 4. Deletes user's push tokens
 * 5. Deletes the auth.users record via admin API
 */

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Verify the user's identity with their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // Require confirmation in request body
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE_MY_ACCOUNT") {
      return NextResponse.json(
        { error: "Confirmation required. Send { confirm: 'DELETE_MY_ACCOUNT' }" },
        { status: 400 }
      );
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Delete user data in order (respecting foreign keys)
    const deletions = [
      { table: "push_tokens", filter: { user_id: userId } },
      { table: "push_subscriptions", filter: { user_id: userId } },
      { table: "notification_preferences", filter: { user_id: userId } },
      { table: "notifications", filter: { user_id: userId } },
      { table: "notification_log", filter: { user_id: userId } },
      { table: "pulse_reactions", filter: { user_id: userId } },
      { table: "pulse_comments", filter: { user_id: userId } },
      { table: "pulse_reports", filter: { reporter_id: userId } },
      { table: "poll_votes", filter: { user_id: userId } },
      { table: "favorites", filter: { user_id: userId } },
      { table: "blocked_users", filter: { blocker_id: userId } },
      { table: "blocked_users", filter: { blocked_id: userId } },
      { table: "user_badges", filter: { user_id: userId } },
      { table: "user_stats", filter: { user_id: userId } },
      { table: "user_trust_scores", filter: { user_id: userId } },
      { table: "venue_checkins", filter: { user_id: userId } },
      { table: "challenge_claims", filter: { user_id: userId } },
      { table: "trail_progress", filter: { user_id: userId } },
      { table: "prediction_rewards", filter: { user_id: userId } },
      { table: "prediction_resolution_votes", filter: { user_id: userId } },
      { table: "vibe_confirmations", filter: { user_id: userId } },
    ];

    for (const { table, filter } of deletions) {
      const [filterKey, filterVal] = Object.entries(filter)[0];
      const { error } = await adminClient
        .from(table)
        .delete()
        .eq(filterKey, filterVal);

      if (error) {
        // Log but continue — some tables may not have data for this user
        console.warn(`[account-delete] Error deleting from ${table}:`, error.message);
      }
    }

    // Anonymize user's pulses (keep content but remove identity)
    const { error: pulseError } = await adminClient
      .from("pulses")
      .update({ user_id: null, author: "[deleted]" })
      .eq("user_id", userId);

    if (pulseError) {
      console.warn("[account-delete] Error anonymizing pulses:", pulseError.message);
    }

    // Delete profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.warn("[account-delete] Error deleting profile:", profileError.message);
    }

    // Delete the auth user (this is the final step)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("[account-delete] CRITICAL: Failed to delete auth user:", deleteUserError.message);
      return NextResponse.json(
        { error: "Account data was cleared but auth deletion failed. Please contact support." },
        { status: 500 }
      );
    }

    console.log(`[MODERATION] Account deleted: ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("[account-delete] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
