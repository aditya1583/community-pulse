import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Admin user IDs — only these users can access admin endpoints
const ADMIN_USER_IDS = [
  "3e06ceda-57d8-42c5-965c-236a486efe71", // Ady (UrbanAxolotl43)
];

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

/**
 * GET /api/admin/reports — List all reported pulses with details
 * POST /api/admin/reports — Take action (hide, dismiss, delete)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAdmin(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role to fetch all reports with pulse details
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Get all reports grouped by pulse
    const { data: reports, error } = await admin
      .from("pulse_reports")
      .select("id, pulse_id, reporter_id, reason, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[Admin] Error fetching reports:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    // Get unique pulse IDs and fetch the pulses
    const pulseIds = [...new Set((reports || []).map(r => r.pulse_id))];
    
    let pulses: Record<number, { id: number; author: string; message: string; tag: string; hidden: boolean; city: string; is_bot: boolean; created_at: string }> = {};
    
    if (pulseIds.length > 0) {
      const { data: pulseData } = await admin
        .from("pulses")
        .select("id, author, message, tag, hidden, city, is_bot, created_at")
        .in("id", pulseIds);

      if (pulseData) {
        for (const p of pulseData) {
          pulses[p.id] = p;
        }
      }
    }

    // Group reports by pulse
    const grouped: Record<number, {
      pulse: typeof pulses[number] | null;
      reports: typeof reports;
      reportCount: number;
    }> = {};

    for (const r of (reports || [])) {
      if (!grouped[r.pulse_id]) {
        grouped[r.pulse_id] = {
          pulse: pulses[r.pulse_id] || null,
          reports: [],
          reportCount: 0,
        };
      }
      grouped[r.pulse_id].reports.push(r);
      grouped[r.pulse_id].reportCount++;
    }

    // Sort by report count (most reported first)
    const sortedPulses = Object.values(grouped).sort((a, b) => b.reportCount - a.reportCount);

    // Also get total stats
    const { count: totalReports } = await admin
      .from("pulse_reports")
      .select("*", { count: "exact", head: true });

    const { count: hiddenPulses } = await admin
      .from("pulses")
      .select("*", { count: "exact", head: true })
      .eq("hidden", true);

    return NextResponse.json({
      reportedPulses: sortedPulses,
      stats: {
        totalReports: totalReports || 0,
        hiddenPulses: hiddenPulses || 0,
        activeFlagged: sortedPulses.filter(p => p.pulse && !p.pulse.hidden).length,
      },
    });
  } catch (err) {
    console.error("[Admin] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !isAdmin(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { pulseId, action } = await req.json();
    
    if (!pulseId || !["hide", "dismiss", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "hide") {
      await admin.from("pulses")
        .update({ hidden: true, hidden_reason: "admin-hidden" })
        .eq("id", pulseId);
    } else if (action === "delete") {
      await admin.from("pulse_reports").delete().eq("pulse_id", pulseId);
      await admin.from("pulses").delete().eq("id", pulseId);
    } else if (action === "dismiss") {
      // Remove all reports for this pulse (false reports)
      await admin.from("pulse_reports").delete().eq("pulse_id", pulseId);
    }

    return NextResponse.json({ success: true, action, pulseId });
  } catch (err) {
    console.error("[Admin] Action error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
