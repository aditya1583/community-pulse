import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/apple
 *
 * Exchanges an Apple identity token (id_token) for a Supabase session.
 * Used by the native iOS Sign in with Apple flow via Capacitor.
 *
 * Body: { id_token: string, nonce?: string, full_name?: string }
 * Returns: { user, access_token, refresh_token, expires_at }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_token, nonce, full_name } = body;

    if (!id_token) {
      return NextResponse.json({ error: "Missing id_token" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Exchange Apple id_token with Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: id_token,
      nonce: nonce || undefined,
    });

    if (error) {
      console.error("[Apple Auth] Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ error: "No user/session returned" }, { status: 401 });
    }

    // If we got a full name from Apple (only sent on first sign-in), update the profile
    if (full_name) {
      await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          display_name: full_name,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .select()
        .single();
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (err) {
    console.error("[Apple Auth] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
