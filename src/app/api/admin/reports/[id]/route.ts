import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin Report Action API
 *
 * POST /api/admin/reports/[id] - Take action on a report
 *   Body: { action: "approve" | "dismiss" | "ban_user" }
 *
 *   Actions:
 *   - approve: Keep pulse hidden, mark report as reviewed
 *   - dismiss: Unhide pulse, mark report as reviewed
 *   - ban_user: Keep pulse hidden, mark for user ban (requires separate ban system)
 *
 * Security: Requires ADMIN_API_KEY header
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function validateAdminKey(req: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.error("[admin/reports] ADMIN_API_KEY not configured");
    return false;
  }

  const providedKey = req.headers.get("x-admin-key");
  return providedKey === adminKey;
}

const VALID_ACTIONS = ["approve", "dismiss", "ban_user"] as const;
type ReportAction = typeof VALID_ACTIONS[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  // Validate admin access
  if (!validateAdminKey(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const { id: reportId } = await context.params;

  if (!reportId) {
    return NextResponse.json(
      { error: "Report ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { action } = body as { action: ReportAction };

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Get the report and associated pulse
    const { data: report, error: fetchError } = await supabase
      .from("pulse_reports")
      .select("*, pulses!inner(id, hidden, user_id)")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    if (report.reviewed) {
      return NextResponse.json(
        { error: "This report has already been reviewed" },
        { status: 400 }
      );
    }

    const pulseId = report.pulse_id;
    const pulse = report.pulses as unknown as { id: number; hidden: boolean; user_id: string };

    // Execute action
    switch (action) {
      case "approve": {
        // Keep pulse hidden, mark report as reviewed
        await supabase
          .from("pulses")
          .update({ hidden: true })
          .eq("id", pulseId);

        await supabase
          .from("pulse_reports")
          .update({
            reviewed: true,
            reviewed_at: new Date().toISOString(),
            action_taken: "approved",
          })
          .eq("id", reportId);

        // Mark all other reports for this pulse as reviewed too
        await supabase
          .from("pulse_reports")
          .update({
            reviewed: true,
            reviewed_at: new Date().toISOString(),
            action_taken: "approved_batch",
          })
          .eq("pulse_id", pulseId)
          .eq("reviewed", false);

        return NextResponse.json({
          success: true,
          message: "Report approved. Pulse remains hidden.",
          action: "approved",
        });
      }

      case "dismiss": {
        // Unhide pulse (false positive), mark report as reviewed
        await supabase
          .from("pulses")
          .update({ hidden: false })
          .eq("id", pulseId);

        await supabase
          .from("pulse_reports")
          .update({
            reviewed: true,
            reviewed_at: new Date().toISOString(),
            action_taken: "dismissed",
          })
          .eq("id", reportId);

        // Mark all other reports for this pulse as dismissed too
        await supabase
          .from("pulse_reports")
          .update({
            reviewed: true,
            reviewed_at: new Date().toISOString(),
            action_taken: "dismissed_batch",
          })
          .eq("pulse_id", pulseId)
          .eq("reviewed", false);

        return NextResponse.json({
          success: true,
          message: "Report dismissed. Pulse has been unhidden.",
          action: "dismissed",
        });
      }

      case "ban_user": {
        // Keep pulse hidden
        await supabase
          .from("pulses")
          .update({ hidden: true })
          .eq("id", pulseId);

        // Mark report as reviewed with ban action
        await supabase
          .from("pulse_reports")
          .update({
            reviewed: true,
            reviewed_at: new Date().toISOString(),
            action_taken: "user_banned",
          })
          .eq("id", reportId);

        // Note: Actual user banning requires a separate banned_users table
        // For now, we just log the intent
        console.log(`[admin] User ${pulse.user_id} flagged for ban (pulse ${pulseId})`);

        return NextResponse.json({
          success: true,
          message: "Report approved and user flagged for ban. Implement banned_users table for full ban support.",
          action: "user_banned",
          userId: pulse.user_id,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[admin/reports] Error processing action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/reports/[id] - Get a single report with details
 */
export async function GET(req: NextRequest, context: RouteContext) {
  if (!validateAdminKey(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const { id: reportId } = await context.params;

  try {
    const { data: report, error } = await supabase
      .from("pulse_reports")
      .select(`
        *,
        pulses!inner (
          id,
          message,
          author,
          city,
          mood,
          tag,
          hidden,
          created_at,
          user_id
        )
      `)
      .eq("id", reportId)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Get all reports for this pulse
    const { data: allReports } = await supabase
      .from("pulse_reports")
      .select("id, reason, details, created_at, reviewed, action_taken")
      .eq("pulse_id", report.pulse_id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      report,
      allReportsForPulse: allReports || [],
      totalReportCount: allReports?.length || 1,
    });
  } catch (error) {
    console.error("[admin/reports] Error fetching report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
