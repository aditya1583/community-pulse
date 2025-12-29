/**
 * API route for badge definitions
 * GET /api/gamification/badges
 *
 * Returns all badge definitions for displaying available badges
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  try {
    const supabase = getClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("badge_definitions")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[/api/gamification/badges] Fetch error:", error);
      return NextResponse.json(
        { error: "Unable to fetch badge definitions" },
        { status: 500 }
      );
    }

    // Map to camelCase for frontend
    const badges = (data || []).map((row: {
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      required_tag: string | null;
      tier: number;
      required_pulse_count: number;
      required_reaction_count: number;
      required_streak_days: number;
      special_condition: Record<string, unknown> | null;
      display_order: number;
    }) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      requiredTag: row.required_tag,
      tier: row.tier,
      requiredPulseCount: row.required_pulse_count,
      requiredReactionCount: row.required_reaction_count,
      requiredStreakDays: row.required_streak_days,
      specialCondition: row.special_condition,
      displayOrder: row.display_order,
    }));

    return NextResponse.json({ badges });
  } catch (err) {
    console.error("[/api/gamification/badges] Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
