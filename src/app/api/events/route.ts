import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient"; // ✅ path: app/api/events/route -> ../../../lib

// GET /api/events?city=Austin
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { error: "Missing city parameter", events: [] },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, location, category, starts_at, ends_at")
      .eq("city", city)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("Supabase events GET error:", error);
      return NextResponse.json({ error: "db_error", events: [] }, { status: 200 });
    }

    return NextResponse.json({ events: data || [] }, { status: 200 });
  } catch (e) {
    console.error("Unexpected /api/events GET error:", e);
    return NextResponse.json({ error: "unexpected_error", events: [] }, { status: 200 });
  }
}


// POST /api/events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { city, title, description, location, category, starts_at } = body;

    if (!city || !title || !starts_at) {
      return NextResponse.json(
        { error: "city, title, and starts_at are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("events")
      .insert([
        {
          city,
          title,
          description,
          location,
          category,
          starts_at, // datetime-local string is fine for timestamptz
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase events POST error:", error);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (e) {
    console.error("Unexpected /api/events POST error:", e);
    return NextResponse.json(
      { error: "Unexpected error while creating event" },
      { status: 500 }
    );
  }
}
