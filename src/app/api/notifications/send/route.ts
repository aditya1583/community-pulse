/**
 * Send Push Notification API
 *
 * POST /api/notifications/send
 * Body: { userId, title, body, data, type }
 *
 * Sends native push notifications via APNs using HTTP/2 with token-based auth.
 * Also stores the notification in the notifications table.
 *
 * Rate limiting: max 5 notifications per user per hour.
 * Batching: groups similar notifications within 5-minute windows.
 *
 * Core logic lives in lib/sendNotificationDirect.ts — this handler is a
 * thin HTTP wrapper so external callers (cron jobs, etc.) still work.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendNotificationDirect } from "@/lib/sendNotificationDirect";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, title, body: notifBody, data = {}, type } = body as {
      userId?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
      type?: string;
    };

    if (!userId || !title || !notifBody || !type) {
      return NextResponse.json(
        { error: "userId, title, body, and type are required" },
        { status: 400 }
      );
    }

    const result = await sendNotificationDirect(userId, title, notifBody, type, data);

    if (!result.success) {
      if ("rateLimited" in result) {
        return NextResponse.json(
          { error: "Rate limit: max 5 notifications per hour", rateLimited: true },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: result.error ?? "Internal error" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[notifications/send] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
