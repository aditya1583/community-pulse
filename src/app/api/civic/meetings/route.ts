/**
 * API Route: Civic Meetings
 *
 * GET /api/civic/meetings?city=Leander&days=7
 *   Returns upcoming civic meetings for a city
 *
 * POST /api/civic/meetings
 *   Creates a new civic meeting (admin/service role only)
 *
 * Philosophy: Civic data should be accessible but creation should be controlled.
 * This is a manual entry system - no scraping, just humans adding meetings.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAnon, getSupabaseService } from "../../../../../lib/supabaseServer";
import type {
  CivicMeeting,
  CivicTopic,
  CivicEntityType,
  CivicMeetingType,
} from "@/lib/intelligent-bots/types";

// ============================================================================
// TYPES
// ============================================================================

interface CivicMeetingRow {
  id: string;
  city: string;
  entity: string;
  entity_type: string;
  meeting_type: string;
  title: string | null;
  meeting_date: string;
  topics: CivicTopic[];
  livestream_url: string | null;
  agenda_url: string | null;
  location: string | null;
  status: string;
  high_stakes_count?: number;
  pulse_id: number | null;
}

interface CreateMeetingBody {
  city: string;
  entity: string;
  entityType: CivicEntityType;
  meetingType: CivicMeetingType;
  title?: string;
  meetingDate: string; // ISO string
  topics: CivicTopic[];
  livestreamUrl?: string;
  agendaUrl?: string;
  location?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_ENTITY_TYPES: CivicEntityType[] = [
  'school_district', 'city_council', 'committee', 'county', 'utility'
];

const VALID_MEETING_TYPES: CivicMeetingType[] = [
  'board', 'council', 'special', 'workshop', 'hearing', 'budget'
];

function validateCreateBody(body: unknown): { valid: true; data: CreateMeetingBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const b = body as Record<string, unknown>;

  // Required fields
  if (!b.city || typeof b.city !== 'string') {
    return { valid: false, error: 'city is required' };
  }
  if (!b.entity || typeof b.entity !== 'string') {
    return { valid: false, error: 'entity is required' };
  }
  if (!b.entityType || !VALID_ENTITY_TYPES.includes(b.entityType as CivicEntityType)) {
    return { valid: false, error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}` };
  }
  if (!b.meetingType || !VALID_MEETING_TYPES.includes(b.meetingType as CivicMeetingType)) {
    return { valid: false, error: `meetingType must be one of: ${VALID_MEETING_TYPES.join(', ')}` };
  }
  if (!b.meetingDate || typeof b.meetingDate !== 'string') {
    return { valid: false, error: 'meetingDate is required (ISO string)' };
  }

  // Validate date format
  const date = new Date(b.meetingDate);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'meetingDate must be a valid date' };
  }

  // Topics validation
  if (!Array.isArray(b.topics)) {
    return { valid: false, error: 'topics must be an array' };
  }

  for (const topic of b.topics) {
    if (!topic.title || typeof topic.title !== 'string') {
      return { valid: false, error: 'Each topic must have a title' };
    }
    if (!topic.summary || typeof topic.summary !== 'string') {
      return { valid: false, error: 'Each topic must have a summary' };
    }
    if (!['high', 'medium', 'low'].includes(topic.stakes)) {
      return { valid: false, error: 'Each topic must have stakes: high, medium, or low' };
    }
  }

  return {
    valid: true,
    data: {
      city: b.city as string,
      entity: b.entity as string,
      entityType: b.entityType as CivicEntityType,
      meetingType: b.meetingType as CivicMeetingType,
      title: b.title as string | undefined,
      meetingDate: b.meetingDate as string,
      topics: b.topics as CivicTopic[],
      livestreamUrl: b.livestreamUrl as string | undefined,
      agendaUrl: b.agendaUrl as string | undefined,
      location: b.location as string | undefined,
    },
  };
}

// ============================================================================
// GET: Fetch upcoming civic meetings
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city");
  const daysAhead = parseInt(searchParams.get("days") || "7", 10);
  const includeToday = searchParams.get("today") === "true";

  // City is required
  if (!city) {
    return NextResponse.json(
      { error: "City parameter is required", meetings: [] },
      { status: 400 }
    );
  }

  // Validate days parameter
  const days = Math.min(Math.max(daysAhead, 1), 30);

  try {
    if (includeToday) {
      // Use the today's meetings function
      const { data, error } = await getSupabaseAnon().rpc("get_todays_civic_meetings", {
        p_city: city,
      });

      if (error) {
        console.error("[civic/meetings] Database error:", error);
        return NextResponse.json(
          { error: "Failed to fetch meetings", meetings: [] },
          { status: 500 }
        );
      }

      const meetings: CivicMeeting[] = (data as CivicMeetingRow[] || []).map(transformRow);

      console.log(`[civic/meetings] Fetched ${meetings.length} meetings for today in ${city}`);

      return NextResponse.json({
        city,
        filter: "today",
        meetings,
        count: meetings.length,
      });
    }

    // Use the upcoming meetings function
    const { data, error } = await getSupabaseAnon().rpc("get_upcoming_civic_meetings", {
      p_city: city,
      p_days_ahead: days,
    });

    if (error) {
      console.error("[civic/meetings] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch meetings", meetings: [] },
        { status: 500 }
      );
    }

    const meetings: CivicMeeting[] = (data as CivicMeetingRow[] || []).map(transformRow);

    console.log(`[civic/meetings] Fetched ${meetings.length} upcoming meetings for ${city} (${days} days)`);

    return NextResponse.json({
      city,
      daysAhead: days,
      meetings,
      count: meetings.length,
    });

  } catch (err) {
    console.error("[civic/meetings] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch meetings", meetings: [] },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create a new civic meeting (admin only)
// ============================================================================

export async function POST(request: NextRequest) {
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

    // Insert the meeting
    const { data: inserted, error } = await serviceClient
      .from("civic_meetings")
      .insert({
        city: data.city,
        entity: data.entity,
        entity_type: data.entityType,
        meeting_type: data.meetingType,
        title: data.title || null,
        meeting_date: data.meetingDate,
        topics: data.topics,
        livestream_url: data.livestreamUrl || null,
        agenda_url: data.agendaUrl || null,
        location: data.location || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[civic/meetings] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to create meeting" },
        { status: 500 }
      );
    }

    const meeting = transformRow(inserted as CivicMeetingRow);

    console.log(`[civic/meetings] Created meeting: ${meeting.entity} on ${meeting.meetingDate}`);

    return NextResponse.json({
      success: true,
      meeting,
    }, { status: 201 });

  } catch (err) {
    console.error("[civic/meetings] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function transformRow(row: CivicMeetingRow): CivicMeeting {
  return {
    id: row.id,
    city: row.city,
    entity: row.entity,
    entityType: row.entity_type as CivicEntityType,
    meetingType: row.meeting_type as CivicMeetingType,
    title: row.title || undefined,
    meetingDate: new Date(row.meeting_date),
    topics: row.topics || [],
    livestreamUrl: row.livestream_url || undefined,
    agendaUrl: row.agenda_url || undefined,
    location: row.location || undefined,
  };
}

