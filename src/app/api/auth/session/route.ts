/**
 * POST /api/auth/session — Server-side auth for Capacitor/WKWebView
 *
 * Supabase JS auth hangs in WKWebView. This endpoint handles:
 *   1. Sign in (email + password → access_token + refresh_token)
 *   2. Token refresh (refresh_token → new access_token)
 *   3. Get user (access_token → user object)
 *
 * The client stores tokens in localStorage and uses this endpoint
 * instead of supabase.auth.* methods.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    const { action } = body;

    // ─── SIGN IN ───
    if (action === "signIn") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: "email and password required" }, { status: 400 });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    }

    // ─── SIGN UP ───
    if (action === "signUp") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: "email and password required" }, { status: 400 });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://voxlo-theta.vercel.app";
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
        // If email confirmation required, session will be null
        needsConfirmation: !data.session,
      });
    }

    // ─── REFRESH TOKEN ───
    if (action === "refresh") {
      const { refresh_token } = body;
      if (!refresh_token) {
        return NextResponse.json({ error: "refresh_token required" }, { status: 400 });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.refreshSession({ refresh_token });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    }

    // ─── GET USER (verify token) ───
    if (action === "getUser") {
      const { access_token } = body;
      if (!access_token) {
        return NextResponse.json({ error: "access_token required" }, { status: 400 });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase.auth.getUser(access_token);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json({
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    }

    // ─── RESET PASSWORD ───
    if (action === "resetPassword") {
      const { email } = body;
      if (!email) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[Auth API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
