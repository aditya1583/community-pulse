import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

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
    const body = await req.json() as ReportRequest;
    const { pulseId, reporterId, reason, details } = body;

    // Validate required fields
    if (!pulseId || typeof pulseId !== "number") {
      return NextResponse.json(
        { error: "Invalid or missing pulseId" },
        { status: 400 }
      );
    }

    if (!reporterId || typeof reporterId !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing reporterId" },
        { status: 400 }
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
    const { data: existingReport } = await supabase
      .from("pulse_reports")
      .select("id")
      .eq("pulse_id", pulseId)
      .eq("reporter_id", reporterId)
      .single();

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this pulse" },
        { status: 409 }
      );
    }

    // Insert the report
    const { error: insertError } = await supabase
      .from("pulse_reports")
      .insert({
        pulse_id: pulseId,
        reporter_id: reporterId,
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

      return NextResponse.json(
        { error: "Failed to submit report" },
        { status: 500 }
      );
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
