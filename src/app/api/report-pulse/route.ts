import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RATE_LIMITS, buildRateLimitHeaders } from "@/lib/rateLimit";

/**
 * Report Pulse API Route
 *
 * Allows users to report pulses for moderation
 * Validates reason, prevents duplicate reports, and returns report count
 */

const VALID_REASONS = ["spam", "harassment", "inappropriate", "misinformation", "other"] as const;
type ReportReason = typeof VALID_REASONS[number];

type ReportRequest = {
  pulseId: number;
  reporterId: string;
  reason: ReportReason;
  details?: string;
};

type ReportResponse = {
  success: boolean;
  reportCount: number;
  message: string;
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Rate limiting - 10 reports per day per user
    const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.REPORT);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: `You've reached the daily report limit. Try again tomorrow.`,
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const body = (await req.json()) as ReportRequest;
    const { pulseId, reporterId, reason, details } = body;

    // Validate required fields
    if (!pulseId || typeof pulseId !== "number") {
      return NextResponse.json(
        { error: "Invalid or missing pulseId" },
        { status: 400 }
      );
    }

    // reporterId comes from the client, but we enforce it from auth to prevent spoofing.
    if (reporterId && reporterId !== user.id) {
      return NextResponse.json(
        { error: "Reporter mismatch" },
        { status: 403 }
      );
    }

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if pulse exists and is not already hidden
    const { data: pulse, error: pulseError } = await supabase
      .from("pulses")
      .select("id, hidden")
      .eq("id", pulseId)
      .single();

    if (pulseError || !pulse) {
      return NextResponse.json(
        { error: "Pulse not found" },
        { status: 404 }
      );
    }

    if (pulse.hidden) {
      return NextResponse.json(
        { error: "This pulse has already been hidden" },
        { status: 400 }
      );
    }

    // Check if user already reported this pulse
    const { data: existingReport, error: existingError } = await supabase
      .from("pulse_reports")
      .select("id")
      .eq("pulse_id", pulseId)
      .eq("reporter_id", user.id)
      .single();

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this pulse" },
        { status: 409 }
      );
    }

    // PGRST116 = no rows returned (expected when the report doesn't exist)
    if (existingError && existingError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to check existing report" },
        { status: 500 }
      );
    }

    // Insert the report
    const { error: insertError } = await supabase
      .from("pulse_reports")
      .insert({
        pulse_id: pulseId,
        reporter_id: user.id,
        reason,
        details: details || null,
      });

    if (insertError) {
      console.error("Error inserting report:", insertError);

      // Handle unique constraint violation (duplicate report)
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "You have already reported this pulse" },
          { status: 409 }
        );
      }

      const safeMessage =
        process.env.NODE_ENV === "production"
          ? "Failed to submit report"
          : insertError.message;

      return NextResponse.json({ error: safeMessage }, { status: 500 });
    }

    // Get updated report count
    const { count } = await supabase
      .from("pulse_reports")
      .select("*", { count: "exact", head: true })
      .eq("pulse_id", pulseId);

    const reportCount = count || 1;

    const response: ReportResponse = {
      success: true,
      reportCount,
      message: reportCount >= 3
        ? "Report submitted. This pulse has been hidden due to multiple reports."
        : "Report submitted. Thank you for helping keep the community safe.",
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in /api/report-pulse:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
