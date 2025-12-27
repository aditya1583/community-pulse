"use client";

import React, { useCallback, useEffect, useState } from "react";

type PulseLikeButtonProps = {
  pulseId: number;
  userIdentifier?: string;
};

type ReactionResponse = {
  fire?: number;
  eyes?: number;
  check?: number;
  userReactions?: string[];
};

export default function PulseLikeButton({
  pulseId,
  userIdentifier,
}: PulseLikeButtonProps) {
  const [count, setCount] = useState<number>(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = new URL(`/api/pulses/${pulseId}/react`, window.location.origin);
      if (userIdentifier) url.searchParams.set("userIdentifier", userIdentifier);

      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = (await res.json()) as ReactionResponse;
      setCount(data.check ?? 0);
      setLiked((data.userReactions ?? []).includes("check"));
    } catch {
      // ignore
    }
  }, [pulseId, userIdentifier]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async () => {
    if (!userIdentifier) return;
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/pulses/${pulseId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType: "check", userIdentifier }),
      });
      if (!res.ok) return;

      const data = (await res.json()) as ReactionResponse;
      setCount(data.check ?? 0);
      setLiked((data.userReactions ?? []).includes("check"));
    } finally {
      setLoading(false);
    }
  }, [loading, pulseId, userIdentifier]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!userIdentifier || loading}
      className={`inline-flex items-center gap-1 transition ${
        liked
          ? "text-emerald-300"
          : userIdentifier
            ? "text-slate-500 hover:text-emerald-200"
            : "text-slate-700 cursor-not-allowed"
      }`}
      title={
        !userIdentifier
          ? "Sign in to like"
          : liked
            ? "Unlike"
            : "Like"
      }
      aria-pressed={liked}
    >
      <span className="text-sm leading-none">{"\uD83D\uDC4D"}</span>
      {count > 0 && <span className="text-[11px] font-mono">{count}</span>}
    </button>
  );
}
