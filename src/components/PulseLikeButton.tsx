"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getApiUrl } from "@/lib/api-config";

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
      const params = userIdentifier ? `?userIdentifier=${encodeURIComponent(userIdentifier)}` : '';
      const apiPath = getApiUrl(`/api/pulses/${pulseId}/react${params}`);

      const res = await fetch(apiPath);
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

    // Polling fallback every 60 seconds for reaction updates
    // (Realtime may not be enabled for pulse_reactions table)
    const pollInterval = setInterval(() => {
      void load();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, [load]);

  // REALTIME: Subscribe to pulse_reactions for this pulse to get instant updates
  // Note: Requires Realtime to be enabled for pulse_reactions in Supabase dashboard
  useEffect(() => {
    const channelName = `pulse-reactions-${pulseId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for INSERT and DELETE
          schema: "public",
          table: "pulse_reactions",
          filter: `pulse_id=eq.${pulseId}`,
        },
        () => {
          // Reload reaction count when any change happens
          void load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pulseId, load]);

  const toggle = useCallback(async () => {
    if (!userIdentifier) return;
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/pulses/${pulseId}/react`), {
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
