/**
 * GET/PUT /api/notifications/preferences
 *
 * Manage notification preferences for a user.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getUserClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/notifications/preferences?city=Austin,%20TX
 *
 * Get notification preferences for a city.
 * If no preferences exist, returns default values.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const userClient = getUserClient(token);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");

    // If no city specified, return all preferences for user
    if (!city) {
      const { data, error } = await userClient
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("[preferences] Error fetching all:", error);
        return NextResponse.json(
          { error: "Failed to fetch preferences" },
          { status: 500 }
        );
      }

      return NextResponse.json({ preferences: data || [] });
    }

    // Get preferences for specific city
    const { data, error } = await userClient
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .eq("city", city)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[preferences] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    // Return existing or defaults
    const preferences = data || {
      user_id: user.id,
      city,
      vibe_shifts_enabled: true,
      spike_alerts_enabled: true,
      keyword_alerts_enabled: false,
      alert_keywords: [],
      keyword_radius_miles: 1.0,
      spike_threshold_percent: 200,
      quiet_hours_start: null,
      quiet_hours_end: null,
      timezone: "America/Chicago",
    };

    return NextResponse.json({ preferences });
  } catch (err) {
    console.error("[preferences] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 *
 * Update notification preferences for a city.
 *
 * Request body:
 * {
 *   city: string,
 *   vibe_shifts_enabled?: boolean,
 *   spike_alerts_enabled?: boolean,
 *   keyword_alerts_enabled?: boolean,
 *   alert_keywords?: string[],
 *   keyword_radius_miles?: number,
 *   spike_threshold_percent?: number,
 *   quiet_hours_start?: string | null,
 *   quiet_hours_end?: string | null,
 *   timezone?: string,
 * }
 */
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const userClient = getUserClient(token);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const serviceClient = getServiceClient();
    if (!serviceClient) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !body.city) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      user_id: user.id,
      city: body.city.trim(),
    };

    if (typeof body.vibe_shifts_enabled === "boolean") {
      updates.vibe_shifts_enabled = body.vibe_shifts_enabled;
    }
    if (typeof body.spike_alerts_enabled === "boolean") {
      updates.spike_alerts_enabled = body.spike_alerts_enabled;
    }
    if (typeof body.keyword_alerts_enabled === "boolean") {
      updates.keyword_alerts_enabled = body.keyword_alerts_enabled;
    }
    if (Array.isArray(body.alert_keywords)) {
      updates.alert_keywords = body.alert_keywords.filter(
        (k: unknown) => typeof k === "string" && k.trim()
      );
    }
    if (typeof body.keyword_radius_miles === "number") {
      updates.keyword_radius_miles = Math.max(0.1, Math.min(10, body.keyword_radius_miles));
    }
    if (typeof body.spike_threshold_percent === "number") {
      updates.spike_threshold_percent = Math.max(100, Math.min(500, body.spike_threshold_percent));
    }
    if (body.quiet_hours_start !== undefined) {
      updates.quiet_hours_start = body.quiet_hours_start;
    }
    if (body.quiet_hours_end !== undefined) {
      updates.quiet_hours_end = body.quiet_hours_end;
    }
    if (typeof body.timezone === "string") {
      updates.timezone = body.timezone;
    }

    const { data, error } = await serviceClient
      .from("notification_preferences")
      .upsert(updates, { onConflict: "user_id,city" })
      .select()
      .single();

    if (error) {
      console.error("[preferences] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({ preferences: data });
  } catch (err) {
    console.error("[preferences] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
