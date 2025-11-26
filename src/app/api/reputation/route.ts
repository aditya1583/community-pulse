import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

type ReputationRow = {
  user_id: string | null;
  author: string | null;
  favorites?: { count: number }[];
};

const REPUTATION_CAP = 999;

function extractCount(row: ReputationRow) {
  const first = row.favorites?.[0];
  if (!first || typeof first.count !== "number") return 0;
  return first.count;
}

function capScore(value: number) {
  return Math.min(REPUTATION_CAP, Math.max(0, value));
}

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = (payload ?? {}) as {
    userIds?: unknown;
    authors?: unknown;
  };

  const userIds: string[] = Array.from(
    new Set(
      (Array.isArray(parsed.userIds) ? parsed.userIds : [])
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
        .map((value) => value.trim())
    )
  );
  const authors: string[] = Array.from(
    new Set(
      (Array.isArray(parsed.authors) ? parsed.authors : [])
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
        .map((value) => value.trim())
    )
  );

  if (userIds.length === 0 && authors.length === 0) {
    return NextResponse.json({ byUserId: {}, byAuthor: {} });
  }

  const byUserId: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};

  const queries: Promise<void>[] = [];

  if (userIds.length > 0) {
    queries.push(
      (async () => {
        const { data, error } = await supabase
          .from("pulses")
          .select("user_id, author, favorites(count)")
          .in("user_id", userIds);

        if (error) {
          console.error("Error fetching user reputation:", error);
          return;
        }

        (data as ReputationRow[] | null)?.forEach((row) => {
          const count = extractCount(row);
          const key = row.user_id;
          if (!key) return;

          byUserId[key] = capScore((byUserId[key] || 0) + count);

          const authorKey = row.author || "Anonymous";
          byAuthor[authorKey] = capScore((byAuthor[authorKey] || 0) + count);
        });
      })()
    );
  }

  const filteredAuthors = authors.filter(
    (author) => !byAuthor[author] // avoid double work for overlaps
  );

  if (filteredAuthors.length > 0) {
    queries.push(
      (async () => {
        const { data, error } = await supabase
          .from("pulses")
          .select("author, favorites(count)")
          .in("author", filteredAuthors);

        if (error) {
          console.error("Error fetching author reputation:", error);
          return;
        }

        (data as ReputationRow[] | null)?.forEach((row) => {
          const count = extractCount(row);
          const authorKey = row.author || "Anonymous";
          byAuthor[authorKey] = capScore((byAuthor[authorKey] || 0) + count);
        });
      })()
    );
  }

  await Promise.all(queries);

  return NextResponse.json({ byUserId, byAuthor });
}
