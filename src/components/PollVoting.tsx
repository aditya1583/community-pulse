"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface PollVotingProps {
  pulseId: number;
  options: string[];  // ["🤠 Whataburger", "🍔 In-N-Out"]
  userIdentifier?: string;
  onVote?: (optionIndex: number) => void;
}

interface VoteState {
  votes: Record<string, number>;  // { "0": 12, "1": 8 }
  totalVotes: number;
  userVote: number | null;
}

// Deep clone helper to avoid shallow copy issues
function deepCloneVoteState(state: VoteState): VoteState {
  return {
    votes: { ...state.votes },
    totalVotes: state.totalVotes,
    userVote: state.userVote,
  };
}

/**
 * PollVoting Component
 *
 * Displays voting buttons for "This or That" style polls.
 * Features:
 * - Two option buttons with vote counts
 * - Percentage bars showing vote distribution
 * - Highlighted state when user has voted
 * - Optimistic updates with proper rollback
 * - Debounced voting to prevent double-clicks
 * - Accessible with ARIA attributes
 */
export default function PollVoting({
  pulseId,
  options,
  userIdentifier,
  onVote,
}: PollVotingProps) {
  const [voteState, setVoteState] = useState<VoteState>({
    votes: {},
    totalVotes: 0,
    userVote: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce ref to prevent rapid clicks
  const lastVoteTime = useRef<number>(0);
  const DEBOUNCE_MS = 500;

  // Fetch initial vote counts
  const fetchVotes = useCallback(async () => {
    try {
      const url = new URL(`/api/pulses/${pulseId}/vote`, window.location.origin);

      const headers: HeadersInit = {};
      if (userIdentifier) {
        // Send via header for privacy (not logged in URLs)
        headers["x-user-identifier"] = userIdentifier;
      }

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        setError("Failed to load votes");
        return;
      }

      const data = await res.json();
      setVoteState({
        votes: data.votes || {},
        totalVotes: data.totalVotes || 0,
        userVote: data.userVote ?? null,
      });
      setError(null);
    } catch (err) {
      console.error("[PollVoting] Error fetching votes:", err);
      setError("Failed to load votes");
    } finally {
      setIsInitialLoading(false);
    }
  }, [pulseId, userIdentifier]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  // Handle vote with debouncing
  const handleVote = useCallback(
    async (optionIndex: number) => {
      // Debounce rapid clicks
      const now = Date.now();
      if (now - lastVoteTime.current < DEBOUNCE_MS) {
        return;
      }
      lastVoteTime.current = now;

      if (isLoading) return;

      if (!userIdentifier) {
        setShowSignInPrompt(true);
        return;
      }

      // Clear any previous error
      setError(null);

      // Deep clone for proper rollback
      const previousState = deepCloneVoteState(voteState);
      const previousVoteIndex = voteState.userVote;

      // Optimistic update
      const newVotes = { ...voteState.votes };

      // Remove previous vote if changing
      if (previousVoteIndex !== null && previousVoteIndex !== optionIndex) {
        const prevKey = String(previousVoteIndex);
        newVotes[prevKey] = Math.max(0, (newVotes[prevKey] || 0) - 1);
      }

      // Add new vote (only if not already voted for this option)
      if (previousVoteIndex !== optionIndex) {
        const newKey = String(optionIndex);
        newVotes[newKey] = (newVotes[newKey] || 0) + 1;
      }

      const newTotal = Object.values(newVotes).reduce((sum, count) => sum + count, 0);

      setVoteState({
        votes: newVotes,
        totalVotes: newTotal,
        userVote: optionIndex,
      });

      setIsLoading(true);

      try {
        const res = await fetch(`/api/pulses/${pulseId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIdentifier,
            optionIndex,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          // Revert on failure
          setVoteState(previousState);
          setError(errorData.error || "Failed to vote");
          return;
        }

        const data = await res.json();
        setVoteState({
          votes: data.votes || {},
          totalVotes: data.totalVotes || 0,
          userVote: data.userVote ?? null,
        });

        if (onVote) {
          onVote(optionIndex);
        }
      } catch (err) {
        // Revert on error
        setVoteState(previousState);
        setError("Network error. Please try again.");
        console.error("[PollVoting] Error voting:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [pulseId, userIdentifier, voteState, isLoading, onVote]
  );

  // Calculate percentages
  const getPercentage = (optionIndex: number): number => {
    if (voteState.totalVotes === 0) return 0;
    const count = voteState.votes[String(optionIndex)] || 0;
    return Math.round((count / voteState.totalVotes) * 100);
  };

  const getVoteCount = (optionIndex: number): number => {
    return voteState.votes[String(optionIndex)] || 0;
  };

  const hasVoted = voteState.userVote !== null;

  // Loading skeleton
  if (isInitialLoading) {
    return (
      <div className="mt-3 space-y-2" role="status" aria-label="Loading poll">
        {options.map((option, index) => (
          <div
            key={`skeleton-${option}`}
            className="h-12 bg-slate-700/50 rounded-lg animate-pulse"
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">Loading poll options...</span>
      </div>
    );
  }

  return (
    <div
      className="mt-3 space-y-2"
      role="group"
      aria-label="Poll voting options"
    >
      {options.map((option, index) => {
        const percentage = getPercentage(index);
        const count = getVoteCount(index);
        const isSelected = voteState.userVote === index;
        const isWinning = hasVoted && count === Math.max(...options.map((_, i) => getVoteCount(i))) && count > 0;

        return (
          <button
            key={`poll-option-${pulseId}-${option}`}
            type="button"
            onClick={() => handleVote(index)}
            disabled={isLoading}
            aria-pressed={isSelected}
            aria-label={`Vote for ${option}${hasVoted ? `, ${percentage}% with ${count} votes` : ""}`}
            className={`
              relative w-full overflow-hidden rounded-lg border transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900
              ${isSelected
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-700/50"
              }
              ${isLoading ? "opacity-50 cursor-wait" : "cursor-pointer"}
            `}
          >
            {/* Progress bar background */}
            {hasVoted && (
              <div
                className={`
                  absolute inset-y-0 left-0 transition-all duration-500 ease-out
                  ${isSelected ? "bg-emerald-500/20" : "bg-slate-600/30"}
                `}
                style={{ width: `${percentage}%` }}
                aria-hidden="true"
              />
            )}

            {/* Content */}
            <div className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {isSelected && (
                  <span className="text-emerald-400 text-sm" aria-hidden="true">✓</span>
                )}
                <span className={`font-medium ${isSelected ? "text-emerald-300" : "text-slate-200"}`}>
                  {option}
                </span>
              </div>

              {hasVoted && (
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-mono ${isWinning ? "text-emerald-400" : "text-slate-400"}`}
                    aria-hidden="true"
                  >
                    {percentage}%
                  </span>
                  <span className="text-xs text-slate-500" aria-hidden="true">
                    ({count})
                  </span>
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Total votes */}
      {hasVoted && voteState.totalVotes > 0 && (
        <p className="text-xs text-slate-500 text-center pt-1" aria-live="polite">
          {voteState.totalVotes} vote{voteState.totalVotes !== 1 ? "s" : ""}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 text-center" role="alert">
          {error}
        </p>
      )}

      {/* Sign in prompt - clickable to trigger sign-in */}
      {showSignInPrompt && (
        <button
          type="button"
          onClick={() => {
            setShowSignInPrompt(false);
            // Dispatch custom event to trigger sign-in modal
            window.dispatchEvent(new CustomEvent("showSignInModal"));
          }}
          className="w-full flex items-center justify-center gap-2 text-xs text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg px-3 py-2 transition-colors cursor-pointer"
          role="alert"
        >
          <span>Sign in to vote on polls</span>
          <span className="text-amber-300 font-medium">Sign in</span>
          <svg className="w-3.5 h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      )}
    </div>
  );
}
