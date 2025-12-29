"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { ReactionCounts, ReactionType } from "./types";

type PulseReactionsProps = {
  pulseId: number;
  reactions: ReactionCounts;
  userReactions: ReactionType[];
  userIdentifier: string;
  onReactionUpdate?: (
    pulseId: number,
    reactions: ReactionCounts,
    userReactions: ReactionType[]
  ) => void;
};

// Reaction button configuration
const REACTION_CONFIG: Record<
  ReactionType,
  { emoji: string; label: string; activeColor: string }
> = {
  fire: {
    emoji: "\uD83D\uDD25",
    label: "Fire",
    activeColor: "text-orange-400 bg-orange-500/20 border-orange-500/50",
  },
  eyes: {
    emoji: "\uD83D\uDC40",
    label: "Interesting",
    activeColor: "text-blue-400 bg-blue-500/20 border-blue-500/50",
  },
  check: {
    emoji: "\u2713",
    label: "Verified",
    activeColor: "text-emerald-400 bg-emerald-500/20 border-emerald-500/50",
  },
};

/**
 * PulseReactions Component
 *
 * Displays reaction buttons below a pulse message.
 * Features:
 * - Shows three reaction types: fire, eyes, check
 * - Each button shows emoji + count
 * - Visual states: highlighted when user has reacted, muted otherwise
 * - Optimistic UI updates with revert on failure
 * - Brief scale animation on tap
 */
export default function PulseReactions({
  pulseId,
  reactions,
  userReactions,
  userIdentifier,
  onReactionUpdate,
}: PulseReactionsProps) {
  // Local state for optimistic updates
  const [localReactions, setLocalReactions] = useState<ReactionCounts>(reactions);
  const [localUserReactions, setLocalUserReactions] = useState<ReactionType[]>(userReactions);
  const [animatingButton, setAnimatingButton] = useState<ReactionType | null>(null);
  const [isLoading, setIsLoading] = useState<ReactionType | null>(null);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const signInPromptTimeoutRef = useRef<number | null>(null);

  const isAuthenticated = !!userIdentifier;
  const userReactionsKey = [...userReactions].sort().join("|");

  useEffect(() => {
    setLocalReactions(reactions);
  }, [pulseId, reactions.fire, reactions.eyes, reactions.check]);

  useEffect(() => {
    setLocalUserReactions(userReactions);
  }, [pulseId, userReactionsKey]);

  useEffect(() => {
    return () => {
      if (signInPromptTimeoutRef.current !== null) {
        window.clearTimeout(signInPromptTimeoutRef.current);
      }
    };
  }, []);

  // Handle reaction toggle
  const handleReaction = useCallback(
    async (reactionType: ReactionType) => {
      if (isLoading) return;

      if (!userIdentifier) {
        setShowSignInPrompt(true);
        if (signInPromptTimeoutRef.current !== null) {
          window.clearTimeout(signInPromptTimeoutRef.current);
        }
        signInPromptTimeoutRef.current = window.setTimeout(() => {
          setShowSignInPrompt(false);
        }, 3000);
        return;
      }

      // Optimistic update
      const hadReaction = localUserReactions.includes(reactionType);
      const newUserReactions = hadReaction
        ? localUserReactions.filter((r) => r !== reactionType)
        : [...localUserReactions, reactionType];

      const newReactions = {
        ...localReactions,
        [reactionType]: hadReaction
          ? Math.max(0, localReactions[reactionType] - 1)
          : localReactions[reactionType] + 1,
      };

      // Apply optimistic update
      setLocalReactions(newReactions);
      setLocalUserReactions(newUserReactions);

      // Trigger animation
      setAnimatingButton(reactionType);
      setTimeout(() => setAnimatingButton(null), 200);

      // Make API call
      setIsLoading(reactionType);

      try {
        const response = await fetch(`/api/pulses/${pulseId}/react`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reactionType,
            userIdentifier,
          }),
        });

        if (!response.ok) {
          // Revert on failure
          setLocalReactions(localReactions);
          setLocalUserReactions(localUserReactions);
          console.error("Failed to toggle reaction");
          return;
        }

        const data = await response.json();

        // Update with server response
        const serverReactions: ReactionCounts = {
          fire: data.fire ?? 0,
          eyes: data.eyes ?? 0,
          check: data.check ?? 0,
        };
        const serverUserReactions: ReactionType[] = data.userReactions ?? [];

        setLocalReactions(serverReactions);
        setLocalUserReactions(serverUserReactions);

        // Notify parent of update
        if (onReactionUpdate) {
          onReactionUpdate(pulseId, serverReactions, serverUserReactions);
        }
      } catch (error) {
        // Revert on error
        setLocalReactions(localReactions);
        setLocalUserReactions(localUserReactions);
        console.error("Error toggling reaction:", error);
      } finally {
        setIsLoading(null);
      }
    },
    [pulseId, userIdentifier, localReactions, localUserReactions, isLoading, onReactionUpdate]
  );

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((type) => {
          const config = REACTION_CONFIG[type];
          const count = localReactions[type];
          const isActive = localUserReactions.includes(type);
          const isAnimating = animatingButton === type;
          const isCurrentlyLoading = isLoading === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => handleReaction(type)}
              disabled={isCurrentlyLoading}
              aria-disabled={!isAuthenticated || isCurrentlyLoading}
              className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                border transition-all duration-150
                ${
                  isActive
                    ? config.activeColor
                    : "text-slate-500 bg-slate-800/40 border-slate-700/50 hover:border-slate-600 hover:text-slate-400"
                }
                ${isAnimating ? "scale-110" : "scale-100"}
                ${!isAuthenticated || isCurrentlyLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                min-w-[44px] min-h-[32px] justify-center
              `}
              title={
                !isAuthenticated
                  ? "Sign in to react to pulses"
                  : `${config.label}${isActive ? " (you reacted)" : ""}`
              }
              aria-label={`${config.label}: ${count} reactions${isActive ? ", you reacted" : ""}`}
              aria-pressed={isActive}
            >
              <span className="text-sm">{config.emoji}</span>
              <span className={count > 0 ? "" : "opacity-50"}>{count}</span>
            </button>
          );
        })}
      </div>

      {showSignInPrompt && (
        <p className="text-xs text-amber-400 mt-1">Sign in to react to pulses</p>
      )}
    </div>
  );
}
