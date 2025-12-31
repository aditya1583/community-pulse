import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin Reports API - Moderation Queue
 *
 * GET /api/admin/reports - List all reports
 *   Query params:
 *   - status: "pending" | "reviewed" | "all" (default: "pending")
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
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

/**
 * Validate admin API key
 */
function validateAdminKey(req: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.error("[admin/reports] ADMIN_API_KEY not configured");
    return false;
  }

  const providedKey = req.headers.get("x-admin-key");
  return providedKey === adminKey;
}

export async function GET(req: NextRequest) {
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

  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    // Build query
    let query = supabase
      .from("pulse_reports")
      .select(`
        id,
        pulse_id,
        reporter_id,
        reason,
        details,
        created_at,
        reviewed,
        reviewed_at,
        action_taken,
        pulses!inner (
          id,
          message,
          author,
          city,
          mood,
          tag,
          hidden,
          created_at
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status === "pending") {
      query = query.eq("reviewed", false);
    } else if (status === "reviewed") {
      query = query.eq("reviewed", true);
    }
    // status === "all" - no filter

    const { data, error, count } = await query;

    if (error) {
      console.error("[admin/reports] Error fetching reports:", error);
      return NextResponse.json(
        { error: "Failed to fetch reports" },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("pulse_reports")
      .select("*", { count: "exact", head: true });

    if (status === "pending") {
      countQuery = countQuery.eq("reviewed", false);
    } else if (status === "reviewed") {
      countQuery = countQuery.eq("reviewed", true);
    }

    const { count: totalCount } = await countQuery;

    // Group reports by pulse for easier review
    const reportsByPulse = new Map<number, {
      pulse: {
        id: number;
        message: string;
        author: string;
        city: string;
        mood: string;
        tag: string;
        hidden: boolean;
        created_at: string;
      };
      reports: Array<{
        id: string;
        reporter_id: string;
        reason: string;
        details: string | null;
        created_at: string;
        reviewed: boolean;
        reviewed_at: string | null;
        action_taken: string | null;
      }>;
      reportCount: number;
    }>();

    for (const report of data || []) {
      const pulseId = report.pulse_id;
      const pulse = report.pulses as unknown as {
        id: number;
        message: string;
        author: string;
        city: string;
        mood: string;
        tag: string;
        hidden: boolean;
        created_at: string;
      };

      if (!reportsByPulse.has(pulseId)) {
        reportsByPulse.set(pulseId, {
          pulse,
          reports: [],
          reportCount: 0,
        });
      }

      const entry = reportsByPulse.get(pulseId)!;
      entry.reports.push({
        id: report.id,
        reporter_id: report.reporter_id,
        reason: report.reason,
        details: report.details,
        created_at: report.created_at,
        reviewed: report.reviewed,
        reviewed_at: report.reviewed_at,
        action_taken: report.action_taken,
      });
      entry.reportCount++;
    }

    return NextResponse.json({
      reports: Array.from(reportsByPulse.values()),
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: (totalCount || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("[admin/reports] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
