/**
 * API Route: Civic Meeting Decisions
 *
 * GET /api/civic/meetings/[id]/decisions
 *   Returns all decisions for a meeting
 *
 * POST /api/civic/meetings/[id]/decisions
 *   Records a decision after a meeting (admin/service role only)
 *
 * Philosophy: Decisions are the outcomes that matter. Recording them
 * transforms a meeting from "something that happened" into
 * "something that affects you."
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAnon, getSupabaseService } from "../../../../../../lib/supabaseServer";
import type {
  CivicDecision,
  CivicDecisionOutcome,
} from "@/lib/intelligent-bots/types";

// ============================================================================
// TYPES
// ============================================================================

interface CivicDecisionRow {
  id: string;
  meeting_id: string;
  topic_title: string;
  decision: string;
  vote_for: number | null;
  vote_against: number | null;
  vote_abstain: number | null;
  summary: string | null;
  notable_moment: string | null;
  impact_summary: string | null;
  pulse_id: number | null;
  created_at: string;
}

interface CreateDecisionBody {
  topicTitle: string;
  decision: CivicDecisionOutcome;
  voteFor?: number;
  voteAgainst?: number;
  voteAbstain?: number;
  summary?: string;
  notableMoment?: string;
  impactSummary?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_DECISIONS: CivicDecisionOutcome[] = [
  'approved', 'denied', 'tabled', 'amended', 'withdrawn', 'no_action'
];

function validateCreateBody(body: unknown): { valid: true; data: CreateDecisionBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const b = body as Record<string, unknown>;

  // Required fields
  if (!b.topicTitle || typeof b.topicTitle !== 'string') {
    return { valid: false, error: 'topicTitle is required' };
  }
  if (!b.decision || !VALID_DECISIONS.includes(b.decision as CivicDecisionOutcome)) {
    return { valid: false, error: `decision must be one of: ${VALID_DECISIONS.join(', ')}` };
  }

  // Optional vote counts
  if (b.voteFor !== undefined && (typeof b.voteFor !== 'number' || b.voteFor < 0)) {
    return { valid: false, error: 'voteFor must be a non-negative number' };
  }
  if (b.voteAgainst !== undefined && (typeof b.voteAgainst !== 'number' || b.voteAgainst < 0)) {
    return { valid: false, error: 'voteAgainst must be a non-negative number' };
  }
  if (b.voteAbstain !== undefined && (typeof b.voteAbstain !== 'number' || b.voteAbstain < 0)) {
    return { valid: false, error: 'voteAbstain must be a non-negative number' };
  }

  return {
    valid: true,
    data: {
      topicTitle: b.topicTitle as string,
      decision: b.decision as CivicDecisionOutcome,
      voteFor: b.voteFor as number | undefined,
      voteAgainst: b.voteAgainst as number | undefined,
      voteAbstain: b.voteAbstain as number | undefined,
      summary: b.summary as string | undefined,
      notableMoment: b.notableMoment as string | undefined,
      impactSummary: b.impactSummary as string | undefined,
    },
  };
}

function validateMeetingId(id: string): boolean {
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ============================================================================
// ROUTE CONTEXT TYPE
// ============================================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET: Fetch decisions for a meeting
// ============================================================================

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id: meetingId } = await context.params;

  if (!validateMeetingId(meetingId)) {
    return NextResponse.json(
      { error: "Invalid meeting ID format", decisions: [] },
      { status: 400 }
    );
  }

  try {
    // Fetch decisions for this meeting
    const { data, error } = await getSupabaseAnon()
      .from("civic_decisions")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[civic/decisions] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch decisions", decisions: [] },
        { status: 500 }
      );
    }

    const decisions: CivicDecision[] = (data as CivicDecisionRow[] || []).map(transformRow);

    console.log(`[civic/decisions] Fetched ${decisions.length} decisions for meeting ${meetingId.slice(0, 8)}...`);

    return NextResponse.json({
      meetingId,
      decisions,
      count: decisions.length,
    });

  } catch (err) {
    console.error("[civic/decisions] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch decisions", decisions: [] },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Record a decision
// ============================================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id: meetingId } = await context.params;

  if (!validateMeetingId(meetingId)) {
    return NextResponse.json(
      { error: "Invalid meeting ID format" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    // Validate request body
    const validation = validateCreateBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get service client for writes
    let serviceClient;
    try {
      serviceClient = getSupabaseService();
    } catch {
      return NextResponse.json(
        { error: "Server not configured for write operations" },
        { status: 500 }
      );
    }

    // Verify meeting exists
    const { data: meeting, error: meetingError } = await serviceClient
      .from("civic_meetings")
      .select("id, entity, city")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Insert the decision
    const { data: inserted, error } = await serviceClient
      .from("civic_decisions")
      .insert({
        meeting_id: meetingId,
        topic_title: data.topicTitle,
        decision: data.decision,
        vote_for: data.voteFor ?? null,
        vote_against: data.voteAgainst ?? null,
        vote_abstain: data.voteAbstain ?? null,
        summary: data.summary ?? null,
        notable_moment: data.notableMoment ?? null,
        impact_summary: data.impactSummary ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[civic/decisions] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to record decision" },
        { status: 500 }
      );
    }

    // Update meeting status to completed if needed
    await serviceClient
      .from("civic_meetings")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", meetingId);

    const decision = transformRow(inserted as CivicDecisionRow);

    console.log(`[civic/decisions] Recorded decision for ${meeting.entity}: ${data.topicTitle} - ${data.decision}`);

    return NextResponse.json({
      success: true,
      decision,
    }, { status: 201 });

  } catch (err) {
    console.error("[civic/decisions] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to record decision" },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function transformRow(row: CivicDecisionRow): CivicDecision {
  return {
    meetingId: row.meeting_id,
    topicTitle: row.topic_title,
    decision: row.decision as CivicDecisionOutcome,
    voteFor: row.vote_for ?? undefined,
    voteAgainst: row.vote_against ?? undefined,
    voteAbstain: row.vote_abstain ?? undefined,
    summary: row.summary ?? undefined,
    notableMoment: row.notable_moment ?? undefined,
    impactSummary: row.impact_summary ?? undefined,
  };
}
