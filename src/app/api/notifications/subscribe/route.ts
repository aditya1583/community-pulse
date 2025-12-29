/**
 * POST /api/notifications/subscribe
 *
 * Subscribe to push notifications for a city.
 * Creates or updates both the push subscription and notification preferences.
 *
 * Request body:
 * {
 *   subscription: PushSubscriptionJSON,  // From browser's pushManager.subscribe()
 *   city: string,                         // City to receive alerts for
 *   preferences?: {                       // Optional preference overrides
 *     vibe_shifts_enabled?: boolean,
 *     spike_alerts_enabled?: boolean,
 *     keyword_alerts_enabled?: boolean,
 *     alert_keywords?: string[],
 *     quiet_hours_start?: string,
 *     quiet_hours_end?: string,
 *     timezone?: string,
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getUserClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SubscribeBody = {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  city: string;
  deviceName?: string;
  preferences?: {
    vibe_shifts_enabled?: boolean;
    spike_alerts_enabled?: boolean;
    keyword_alerts_enabled?: boolean;
    alert_keywords?: string[];
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
    timezone?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
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

    // Get service client for writes
    const serviceClient = getServiceClient();
    if (!serviceClient) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Parse request body
    const body: SubscribeBody = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { subscription, city, deviceName, preferences } = body;

    // Validate subscription
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: "Invalid push subscription" },
        { status: 400 }
      );
    }

    // Validate city
    if (!city || typeof city !== "string" || !city.trim()) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    const trimmedCity = city.trim();
    const userAgent = req.headers.get("user-agent") || undefined;

    // Upsert push subscription
    const { error: subError } = await serviceClient
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          subscription,
          device_name: deviceName,
          user_agent: userAgent,
          is_active: true,
          consecutive_failures: 0,
          last_failure_at: null,
          last_failure_reason: null,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (subError) {
      console.error("[subscribe] Push subscription error:", subError);
      return NextResponse.json(
        { error: "Failed to save push subscription" },
        { status: 500 }
      );
    }

    // Upsert notification preferences
    const prefsToSave = {
      user_id: user.id,
      city: trimmedCity,
      vibe_shifts_enabled: preferences?.vibe_shifts_enabled ?? true,
      spike_alerts_enabled: preferences?.spike_alerts_enabled ?? true,
      keyword_alerts_enabled: preferences?.keyword_alerts_enabled ?? false,
      alert_keywords: preferences?.alert_keywords ?? [],
      quiet_hours_start: preferences?.quiet_hours_start ?? null,
      quiet_hours_end: preferences?.quiet_hours_end ?? null,
      timezone: preferences?.timezone ?? "America/Chicago",
    };

    const { error: prefsError } = await serviceClient
      .from("notification_preferences")
      .upsert(prefsToSave, {
        onConflict: "user_id,city",
      });

    if (prefsError) {
      console.error("[subscribe] Preferences error:", prefsError);
      return NextResponse.json(
        { error: "Failed to save notification preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Subscribed to notifications for ${trimmedCity}`,
    });
  } catch (err) {
    console.error("[subscribe] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/subscribe
 *
 * Unsubscribe from push notifications.
 *
 * Query params:
 * - endpoint: The push subscription endpoint to remove
 * - city?: Optional city to remove preferences for (if not provided, just removes subscription)
 */
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint");
    const city = searchParams.get("city");

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint is required" },
        { status: 400 }
      );
    }

    // Delete push subscription
    const { error: subError } = await serviceClient
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (subError) {
      console.error("[unsubscribe] Error:", subError);
      return NextResponse.json(
        { error: "Failed to unsubscribe" },
        { status: 500 }
      );
    }

    // Optionally delete preferences for a specific city
    if (city) {
      await serviceClient
        .from("notification_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("city", city);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[unsubscribe] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
