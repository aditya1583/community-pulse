/**
 * GET/POST /api/auth/profile — Server-side profile management
 *
 * GET: Fetch profile by user ID (via access_token in Authorization header)
 * POST: Create profile if it doesn't exist
 *
 * Bypasses Supabase JS client which hangs in WKWebView.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runModerationPipeline } from "@/lib/moderationPipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getUserFromToken(token: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }

  const user = await getUserFromToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: profile || null, user: { id: user.id, email: user.email } });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }

  const user = await getUserFromToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const anonName = body?.anon_name;

  if (!anonName || typeof anonName !== "string") {
    return NextResponse.json({ error: "anon_name required" }, { status: 400 });
  }

  // Moderate the display name
  const modResult = await runModerationPipeline(anonName, {
    endpoint: "/api/auth/profile",
    userId: user.id,
  });
  if (!modResult.allowed) {
    return NextResponse.json(
      { error: modResult.reason || "Display name not allowed" },
      { status: modResult.serviceError ? 503 : 400 }
    );
  }

  const supabase = getServiceClient();

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ profile: existing });
  }

  // Create new profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ id: user.id, anon_name: anonName, name_locked: false })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
