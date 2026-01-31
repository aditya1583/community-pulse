/**
 * Comment Actions API
 *
 * DELETE /api/pulses/[id]/comments/[commentId] - Hide (soft delete) a comment
 * POST /api/pulses/[id]/comments/[commentId]/report - Report a comment
 *
 * Security:
 * - Only comment author can delete their own comment
 * - Anyone signed in can report a comment
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================================
// DELETE - Soft delete (hide) a comment
// ============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  const pulseId = parseInt(id, 10);

  if (isNaN(pulseId) || !commentId) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get user identifier from request body
    const body = await request.json().catch(() => ({}));
    const userIdentifier = body.userIdentifier?.trim();

    if (!userIdentifier) {
      return NextResponse.json({ error: "User identifier required" }, { status: 400 });
    }

    // Verify the comment exists and belongs to this user
    const { data: comment, error: fetchError } = await supabase
      .from("pulse_comments")
      .select("id, user_identifier, pulse_id")
      .eq("id", commentId)
      .eq("pulse_id", pulseId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check ownership
    if (comment.user_identifier !== userIdentifier) {
      return NextResponse.json({ error: "Cannot delete others' comments" }, { status: 403 });
    }

    // Soft delete by setting hidden = true
    const { error: updateError } = await supabase
      .from("pulse_comments")
      .update({ hidden: true })
      .eq("id", commentId);

    if (updateError) {
      console.error("[CommentAPI] Delete error:", updateError);
      return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    console.error("[CommentAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// POST - Report a comment
// ============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  const pulseId = parseInt(id, 10);

  if (isNaN(pulseId) || !commentId) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { reporterId, reason, details } = body;

    if (!reporterId || !reason) {
      return NextResponse.json({ error: "Reporter ID and reason required" }, { status: 400 });
    }

    // Validate reason
    const validReasons = ["spam", "harassment", "inappropriate", "misinformation", "other"];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: "Invalid report reason" }, { status: 400 });
    }

    // Verify comment exists
    const { data: comment, error: fetchError } = await supabase
      .from("pulse_comments")
      .select("id, pulse_id")
      .eq("id", commentId)
      .eq("pulse_id", pulseId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check for duplicate report
    const { data: existingReport } = await supabase
      .from("comment_reports")
      .select("id")
      .eq("comment_id", commentId)
      .eq("reporter_id", reporterId)
      .single();

    if (existingReport) {
      return NextResponse.json({ error: "You've already reported this comment" }, { status: 400 });
    }

    // Insert report
    const { error: insertError } = await supabase
      .from("comment_reports")
      .insert({
        comment_id: commentId,
        pulse_id: pulseId,
        reporter_id: reporterId,
        reason,
        details: details?.trim() || null,
      });

    if (insertError) {
      // Table might not exist yet - create it or log
      console.error("[CommentAPI] Report insert error:", insertError);

      // Fallback: store in pulse_reports with a flag
      const { error: fallbackError } = await supabase
        .from("pulse_reports")
        .insert({
          pulse_id: pulseId,
          reporter_id: reporterId,
          reason,
          details: `[COMMENT:${commentId}] ${details?.trim() || ""}`,
        });

      if (fallbackError) {
        return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Report submitted" });
  } catch (error) {
    console.error("[CommentAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
