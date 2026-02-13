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

const REACTION_TYPES = [
  { type: "fire", emoji: "🔥" },
  { type: "check", emoji: "👍" },
  { type: "eyes", emoji: "👀" },
] as const;

export default function PulseLikeButton({
  pulseId,
  userIdentifier,
}: PulseLikeButtonProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReactions, setUserReactions] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = userIdentifier ? `?userIdentifier=${encodeURIComponent(userIdentifier)}` : '';
      const apiPath = getApiUrl(`/api/pulses/${pulseId}/react${params}`);

      const res = await fetch(apiPath);
      if (!res.ok) return;
      const data = (await res.json()) as ReactionResponse;
      setCounts({ fire: data.fire ?? 0, eyes: data.eyes ?? 0, check: data.check ?? 0 });
      setUserReactions(data.userReactions ?? []);
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

  const toggle = useCallback(async (reactionType: string) => {
    if (!userIdentifier) return;
    if (loading) return;

    setLoading(reactionType);
    try {
      const res = await fetch(getApiUrl(`/api/pulses/${pulseId}/react`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType, userIdentifier }),
      });
      if (!res.ok) return;

      const data = (await res.json()) as ReactionResponse;
      setCounts({ fire: data.fire ?? 0, eyes: data.eyes ?? 0, check: data.check ?? 0 });
      setUserReactions(data.userReactions ?? []);
    } finally {
      setLoading(null);
    }
  }, [loading, pulseId, userIdentifier]);

  return (
    <div className="inline-flex items-center gap-1.5">
      {REACTION_TYPES.map(({ type, emoji }) => {
        const active = userReactions.includes(type);
        const count = counts[type] ?? 0;
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            disabled={!userIdentifier || loading === type}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition ${
              active
                ? "bg-emerald-500/20 text-emerald-300"
                : userIdentifier
                  ? "text-slate-500 hover:bg-slate-700/50 hover:text-slate-300"
                  : "text-slate-700 cursor-not-allowed"
            }`}
            title={!userIdentifier ? "Sign in to react" : active ? `Remove ${type}` : type}
            aria-pressed={active}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && <span className="text-[10px] font-mono">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
