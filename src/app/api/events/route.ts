import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create user client with token for auth verification
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

// GET /api/events?city=Austin - Public read access
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Server configuration error", events: [] }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

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


// POST /api/events - Requires authentication
export async function POST(req: NextRequest) {
  try {
    // Authentication required
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = getUserClient(token);

    // Verify user is authenticated
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

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
          starts_at,
          user_id: authData.user.id, // Track who created the event
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
