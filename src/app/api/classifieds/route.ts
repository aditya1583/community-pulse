import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";
import { isCleanText } from "../../../../lib/contentFilter";

type ClassifiedType = "offer" | "need";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { error: "Missing city parameter", classifieds: [] },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("classifieds")
      .select(
        "id, city, type, title, description, contact_hint, created_at"
      )
      .eq("city", city)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase classifieds GET error:", error);
      return NextResponse.json(
        { error: "db_error", classifieds: [] },
        { status: 200 }
      );
    }

    return NextResponse.json({ classifieds: data || [] }, { status: 200 });
  } catch (e) {
    console.error("Unexpected /api/classifieds GET error:", e);
    return NextResponse.json(
      { error: "unexpected_error", classifieds: [] },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { city, type, title, description, contact_hint } = body as {
      city?: string;
      type?: ClassifiedType;
      title?: string;
      description?: string;
      contact_hint?: string;
    };

    if (!city || !type || !title || !description || !contact_hint) {
      return NextResponse.json(
        { error: "city, type, title, description, and contact_hint are required" },
        { status: 400 }
      );
    }

    if (type !== "offer" && type !== "need") {
      return NextResponse.json(
        { error: "type must be either 'offer' or 'need'" },
        { status: 400 }
      );
    }

    if (!isCleanText(title) || !isCleanText(description)) {
      return NextResponse.json(
        { error: "Listing contains disallowed language" },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer", "").trim();

    if (!token) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(
      token
    );

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "invalid_user" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("classifieds")
      .insert([
        {
          city,
          type,
          title,
          description,
          contact_hint,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase classifieds POST error:", error);
      return NextResponse.json(
        { error: "Failed to create classified" },
        { status: 500 }
      );
    }

    return NextResponse.json({ classified: data }, { status: 201 });
  } catch (e) {
    console.error("Unexpected /api/classifieds POST error:", e);
    return NextResponse.json(
      { error: "Unexpected error while creating classified" },
      { status: 500 }
    );
  }
}
