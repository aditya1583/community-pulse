/**
 * API route for pulse creation with server-side moderation
 * This endpoint enforces content moderation and ownership rules
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverModerateContent } from "@/lib/moderation";

export const dynamic = "force-dynamic";

// Server-side Supabase client with service role for RLS bypass when needed
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type PulseCreatePayload = {
  city: string;
  mood: string;
  tag: string;
  message: string;
  author: string;
  user_id: string;
  neighborhood?: string;
};

/**
 * POST /api/pulses - Create a new pulse with server-side moderation
 */
export async function POST(req: NextRequest) {
  try {
    // Get auth token from request header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Create Supabase client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { city, mood, tag, message, author, neighborhood } = body as Partial<PulseCreatePayload>;

    // Validate required fields
    if (!city || typeof city !== "string" || !city.trim()) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    if (!mood || typeof mood !== "string" || !mood.trim()) {
      return NextResponse.json(
        { error: "Mood is required" },
        { status: 400 }
      );
    }

    if (!tag || typeof tag !== "string" || !tag.trim()) {
      return NextResponse.json(
        { error: "Tag is required" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!author || typeof author !== "string" || !author.trim()) {
      return NextResponse.json(
        { error: "Author is required" },
        { status: 400 }
      );
    }

    // Validate message length
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 240) {
      return NextResponse.json(
        { error: "Message exceeds 240 character limit" },
        { status: 400 }
      );
    }

    // SERVER-SIDE MODERATION - This is the authoritative check
    const moderationResult = serverModerateContent(trimmedMessage);

    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          error: moderationResult.reason || "Message violates content guidelines",
          code: "MODERATION_FAILED"
        },
        { status: 400 }
      );
    }

    // Also moderate the author name
    const authorModeration = serverModerateContent(author.trim());
    if (!authorModeration.allowed) {
      return NextResponse.json(
        {
          error: "Author name violates content guidelines",
          code: "MODERATION_FAILED"
        },
        { status: 400 }
      );
    }

    // Validate tag is from allowed list
    const ALLOWED_TAGS = ["Traffic", "Weather", "Events", "General"];
    if (!ALLOWED_TAGS.includes(tag)) {
      return NextResponse.json(
        { error: "Invalid tag" },
        { status: 400 }
      );
    }

    // Insert the pulse
    const { data, error: insertError } = await supabase
      .from("pulses")
      .insert([
        {
          city: city.trim(),
          mood: mood.trim(),
          tag: tag.trim(),
          message: trimmedMessage,
          author: author.trim(),
          user_id: user.id,
          neighborhood: neighborhood?.trim() || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("[/api/pulses] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create pulse" },
        { status: 500 }
      );
    }

    return NextResponse.json({ pulse: data });
  } catch (err) {
    console.error("[/api/pulses] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pulses - Delete a pulse (owner only)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get auth token from request header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Create Supabase client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Get pulse ID from URL
    const { searchParams } = new URL(req.url);
    const pulseId = searchParams.get("id");

    if (!pulseId) {
      return NextResponse.json(
        { error: "Pulse ID is required" },
        { status: 400 }
      );
    }

    // First, verify ownership
    const { data: pulse, error: fetchError } = await supabase
      .from("pulses")
      .select("id, user_id")
      .eq("id", pulseId)
      .single();

    if (fetchError || !pulse) {
      return NextResponse.json(
        { error: "Pulse not found" },
        { status: 404 }
      );
    }

    if (pulse.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own pulses" },
        { status: 403 }
      );
    }

    // Delete the pulse
    const { error: deleteError } = await supabase
      .from("pulses")
      .delete()
      .eq("id", pulseId);

    if (deleteError) {
      console.error("[/api/pulses] Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete pulse" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/pulses] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
