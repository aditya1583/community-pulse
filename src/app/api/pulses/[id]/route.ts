import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
// Create user client with token for auth verification and RLS enforcement
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/pulses/:id
 * Delete a pulse (owner only; enforced by RLS)
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = getUserClient(token);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const params = await context.params;
    const id = params?.id;
    console.log("Attempting to delete pulse with ID:", id, "Type:", typeof id);

    const numericId = id ? parseInt(id, 10) : NaN;
    if (!id) {
      return NextResponse.json({ error: "Pulse ID is required" }, { status: 400 });
    }
    if (Number.isNaN(numericId)) {
      return NextResponse.json(
        { error: "Pulse ID must be a number" },
        { status: 400 }
      );
    }

    const { data: pulse, error: fetchError } = await supabase
      .from("pulses")
      .select("id, user_id")
      .eq("id", numericId)
      .single();

    if (fetchError) {
      console.error(
        "[/api/pulses/[id]] Fetch pulse for delete error:",
        JSON.stringify(fetchError, null, 2)
      );
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Pulse not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!pulse) {
      return NextResponse.json({ error: "Pulse not found" }, { status: 404 });
    }

    if (pulse.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own pulses" },
        { status: 403 }
      );
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("pulses")
      .delete()
      .eq("id", numericId)
      .select("id");

    if (deleteError) {
      console.error(
        "[/api/pulses/[id]] Supabase delete error:",
        JSON.stringify(deleteError, null, 2)
      );
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: "Pulse not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[/api/pulses/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
