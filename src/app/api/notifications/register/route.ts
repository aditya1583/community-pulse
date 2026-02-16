/**
 * Push Token Registration API
 *
 * POST - Register a device push token
 * DELETE - Remove a device push token (on sign-out)
 *
 * Requires authentication via Bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getUserClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const userClient = getUserClient(token);
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

/**
 * POST /api/notifications/register
 * Body: { token: string, platform: 'ios' | 'android' | 'web' }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token, platform } = body as { token?: string; platform?: string };

    if (!token || !platform) {
      return NextResponse.json({ error: "token and platform required" }, { status: 400 });
    }

    if (!["ios", "android", "web"].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Upsert token
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: user.id,
          token,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" }
      );

    if (error) {
      console.error("[notifications/register] Upsert error:", error);
      return NextResponse.json({ error: "Failed to register token" }, { status: 500 });
    }

    // Also ensure default notification preferences exist
    await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id },
        { onConflict: "user_id" }
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notifications/register] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications/register
 * Body: { token: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const body = await req.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Delete by token (works even without auth for cleanup)
    const query = supabase.from("push_tokens").delete().eq("token", token);
    if (user) {
      query.eq("user_id", user.id);
    }
    await query;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notifications/register] DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
