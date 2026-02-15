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
  const [showPicker, setShowPicker] = useState(false);

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
    const pollInterval = setInterval(() => void load(), 60000);
    return () => clearInterval(pollInterval);
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`pulse-reactions-${pulseId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pulse_reactions",
        filter: `pulse_id=eq.${pulseId}`,
      }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pulseId, load]);

  const toggle = useCallback(async (reactionType: string) => {
    if (!userIdentifier || loading) return;
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
      setShowPicker(false);
    }
  }, [loading, pulseId, userIdentifier]);

  // Reactions that have counts > 0 (shown as pills)
  const activeReactions = REACTION_TYPES.filter(({ type }) => (counts[type] ?? 0) > 0);
  // Reactions user hasn't used yet (for the picker)
  const availableReactions = REACTION_TYPES.filter(({ type }) => !userReactions.includes(type));

  return (
    <div className="flex items-center gap-1.5 flex-wrap relative">
      {/* Existing reaction pills */}
      {activeReactions.map(({ type, emoji }) => {
        const active = userReactions.includes(type);
        const count = counts[type] ?? 0;
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            disabled={!userIdentifier || loading === type}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all border ${
              active
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : userIdentifier
                  ? "bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:border-slate-600/50"
                  : "bg-slate-800/40 border-slate-700/30 text-slate-500 cursor-not-allowed"
            }`}
            title={!userIdentifier ? "Sign in to react" : active ? `Remove ${type}` : type}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="text-[11px] font-mono tabular-nums">{count}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      {userIdentifier && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/40 border border-slate-700/30 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300 hover:border-slate-600/50 transition-all"
            title="Add reaction"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </button>

          {/* Emoji picker dropdown */}
          {showPicker && availableReactions.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded-full px-1.5 py-1 shadow-xl z-10">
              {availableReactions.map(({ type, emoji }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggle(type)}
                  className="w-7 h-7 rounded-full hover:bg-slate-700 flex items-center justify-center transition text-base"
                  title={type}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
