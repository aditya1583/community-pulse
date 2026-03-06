import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Accept Terms API
 *
 * Records that a user has accepted the Terms of Service / EULA.
 * Apple Review requirement: users must agree to terms before posting UGC.
 */

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Verify user with their token
    const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // Update profile with terms acceptance timestamp
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      console.error("[accept-terms] Update error:", updateError);
      return NextResponse.json({ error: "Failed to record acceptance" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      acceptedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[accept-terms] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
