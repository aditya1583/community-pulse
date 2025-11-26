import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("pulses")
    .select("id, mood, tag, message, author, created_at")
    .eq("city", city)
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching pulse of the day:", error);
    return NextResponse.json(
      { error: "Failed to fetch pulse of the day" },
      { status: 500 }
    );
  }

  const pulse = data?.[0];

  if (!pulse) {
    return NextResponse.json({ pulse: null });
  }

  return NextResponse.json({
    pulse: {
      id: pulse.id,
      mood: pulse.mood,
      tag: pulse.tag,
      message: pulse.message,
      author: pulse.author || "Anonymous",
      createdAt: pulse.created_at,
    },
  });
}
