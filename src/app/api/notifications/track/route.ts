/**
 * POST /api/notifications/track
 *
 * Track notification interactions (clicks, dismissals)
 * Called from the service worker when users interact with notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type TrackBody = {
  notificationId?: string;
  action: "clicked" | "dismissed" | "delivered";
  timestamp?: string;
};

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    logger.error("Service client not available for notification tracking", {
      service: "supabase",
    });
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const body: TrackBody = await req.json().catch(() => ({}));

    if (!body.action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    const { notificationId, action, timestamp } = body;

    // If we have a notification ID, update the log
    if (notificationId) {
      const updateData: Record<string, unknown> = {
        status: action,
      };

      if (action === "clicked") {
        updateData.clicked_at = timestamp || new Date().toISOString();
      } else if (action === "delivered") {
        updateData.delivered_at = timestamp || new Date().toISOString();
      }

      const { error } = await supabase
        .from("notification_log")
        .update(updateData)
        .eq("id", notificationId);

      if (error) {
        logger.warn("Failed to update notification log", {
          service: "supabase",
          action: "notification_track",
          notificationId,
          error: error.message,
        });
        // Don't fail the request - tracking is best-effort
      }
    }

    // Log the interaction for analytics
    logger.info("Notification interaction tracked", {
      action: "notification_track",
      notificationId: notificationId || "unknown",
      interactionType: action,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Unexpected error in notification tracking", {
      action: "notification_track",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    // Return success anyway - tracking failures shouldn't break the app
    return NextResponse.json({ ok: true });
  }
}
