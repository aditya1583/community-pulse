"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api-config";

/**
 * Prediction metadata from the pulse
 */
export interface PredictionData {
  /** Is this pulse a prediction? */
  isPrediction: boolean;
  /** When voting closes and outcome is determined */
  resolvesAt: Date | string;
  /** When the prediction was resolved (null if pending) */
  resolvedAt: Date | string | null;
  /** Index of winning option (null if unresolved, -1 if cancelled) */
  winningOption: number | null;
  /** XP reward for correct predictors */
  xpReward: number;
  /** Category: weather, traffic, events, civic, local */
  category: string;
  /** How the prediction is resolved: manual, openweather, community, etc. */
  dataSource?: string;
  /** When community resolution voting ends (for community-resolved predictions) */
  resolutionVotingEndsAt?: Date | string | null;
}

interface PredictionCardProps {
  pulseId: number;
  options: string[];  // ["YES - Rain coming", "NO - Staying dry"]
  predictionData: PredictionData;
  userIdentifier?: string;
  onVote?: (optionIndex: number) => void;
}

interface VoteState {
  votes: Record<string, number>;  // { "0": 12, "1": 8 }
  totalVotes: number;
  userVote: number | null;
}

interface ResolutionVoteState {
  tallyA: number;
  tallyB: number;
  userResolutionVote: number | null;
  isVoting: boolean;
}

// Deep clone helper
function deepCloneVoteState(state: VoteState): VoteState {
  return {
    votes: { ...state.votes },
    totalVotes: state.totalVotes,
    userVote: state.userVote,
  };
}

/**
 * Calculate time remaining until a deadline
 */
function getTimeRemaining(deadline: Date): {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = deadline.getTime() - Date.now();
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { total, days, hours, minutes, seconds };
}

/**
 * Format countdown string
 */
function formatCountdown(time: ReturnType<typeof getTimeRemaining>): string {
  if (time.total <= 0) return "Voting closed";
  if (time.days > 0) return `${time.days}d ${time.hours}h left`;
  if (time.hours > 0) return `${time.hours}h ${time.minutes}m left`;
  if (time.minutes > 0) return `${time.minutes}m ${time.seconds}s left`;
  return `${time.seconds}s left`;
}

/**
 * PredictionCard Component
 *
 * Extends PollVoting with prediction-specific features:
 * - Countdown timer to resolution
 * - XP reward preview
 * - Resolution status (pending/resolved)
 * - "You were right!" celebration for winners
 * - Category badge (weather, traffic, civic, etc.)
 *
 * PHILOSOPHY: Predictions transform passive voting into active engagement.
 * Users stake their reputation (XP) on local outcomes, creating emotional
 * investment that drives return visits to see results.
 */
export default function PredictionCard({
  pulseId,
  options,
  predictionData,
  userIdentifier,
  onVote,
}: PredictionCardProps) {
  const [voteState, setVoteState] = useState<VoteState>({
    votes: {},
    totalVotes: 0,
    userVote: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [isVotingClosed, setIsVotingClosed] = useState(false);

  // Community resolution voting state
  const [resolutionState, setResolutionState] = useState<ResolutionVoteState>({
    tallyA: 0,
    tallyB: 0,
    userResolutionVote: null,
    isVoting: false,
  });
  const [resolutionCountdown, setResolutionCountdown] = useState<string>("");
  const [showResolutionPhase, setShowResolutionPhase] = useState(false);

  // Debounce ref
  const lastVoteTime = useRef<number>(0);
  const DEBOUNCE_MS = 500;

  // Parse dates
  const resolvesAt = predictionData.resolvesAt instanceof Date
    ? predictionData.resolvesAt
    : new Date(predictionData.resolvesAt);
  const isResolved = predictionData.resolvedAt !== null;
  const winningOption = predictionData.winningOption;
  const isCommunityResolved = predictionData.dataSource === "community";
  const resolutionVotingEndsAt = predictionData.resolutionVotingEndsAt
    ? (predictionData.resolutionVotingEndsAt instanceof Date
      ? predictionData.resolutionVotingEndsAt
      : new Date(predictionData.resolutionVotingEndsAt))
    : null;

  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const time = getTimeRemaining(resolvesAt);
      setCountdown(formatCountdown(time));
      const votingClosed = time.total <= 0;
      setIsVotingClosed(votingClosed);

      // Check if we should show resolution phase for community-resolved predictions
      if (votingClosed && isCommunityResolved && !isResolved) {
        setShowResolutionPhase(true);

        // Update resolution countdown if we have an end date
        if (resolutionVotingEndsAt) {
          const resTime = getTimeRemaining(resolutionVotingEndsAt);
          setResolutionCountdown(
            resTime.total <= 0 ? "Finalizing..." : formatCountdown(resTime)
          );
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [resolvesAt, isCommunityResolved, isResolved, resolutionVotingEndsAt]);

  // Fetch initial vote counts
  const fetchVotes = useCallback(async () => {
    try {
      const url = new URL(getApiUrl(`/api/pulses/${pulseId}/vote`));
      const headers: HeadersInit = {};
      if (userIdentifier) {
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
      console.error("[PredictionCard] Error fetching votes:", err);
      setError("Failed to load votes");
    } finally {
      setIsInitialLoading(false);
    }
  }, [pulseId, userIdentifier]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  // Handle vote
  const handleVote = useCallback(
    async (optionIndex: number) => {
      // Cannot vote if closed or resolved
      if (isVotingClosed || isResolved) return;

      // Debounce
      const now = Date.now();
      if (now - lastVoteTime.current < DEBOUNCE_MS) return;
      lastVoteTime.current = now;

      if (isLoading) return;

      if (!userIdentifier) {
        setShowSignInPrompt(true);
        return;
      }

      setError(null);
      const previousState = deepCloneVoteState(voteState);
      const previousVoteIndex = voteState.userVote;

      // Optimistic update
      const newVotes = { ...voteState.votes };
      if (previousVoteIndex !== null && previousVoteIndex !== optionIndex) {
        const prevKey = String(previousVoteIndex);
        newVotes[prevKey] = Math.max(0, (newVotes[prevKey] || 0) - 1);
      }
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
        const res = await fetch(getApiUrl(`/api/pulses/${pulseId}/vote`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIdentifier, optionIndex }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
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

        if (onVote) onVote(optionIndex);
      } catch (err) {
        setVoteState(previousState);
        setError("Network error. Please try again.");
        console.error("[PredictionCard] Error voting:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [pulseId, userIdentifier, voteState, isLoading, isVotingClosed, isResolved, onVote]
  );

  const dismissSignInPrompt = useCallback(() => {
    setShowSignInPrompt(false);
  }, []);

  // Handle resolution vote (for community-resolved predictions)
  const handleResolutionVote = useCallback(
    async (votedOutcome: number) => {
      if (!userIdentifier) {
        setShowSignInPrompt(true);
        return;
      }

      if (resolutionState.isVoting) return;

      setResolutionState((prev) => ({ ...prev, isVoting: true }));
      setError(null);

      try {
        const res = await fetch(getApiUrl(`/api/pulses/${pulseId}/resolution-vote`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ votedOutcome, userIdentifier }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          setError(errorData.error || "Failed to cast resolution vote");
          return;
        }

        const data = await res.json();
        setResolutionState({
          tallyA: data.tally?.optionA || 0,
          tallyB: data.tally?.optionB || 0,
          userResolutionVote: votedOutcome,
          isVoting: false,
        });
      } catch (err) {
        setError("Network error. Please try again.");
        console.error("[PredictionCard] Resolution vote error:", err);
      } finally {
        setResolutionState((prev) => ({ ...prev, isVoting: false }));
      }
    },
    [pulseId, userIdentifier, resolutionState.isVoting]
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

  // Check if user won the prediction
  const userWon = isResolved && hasVoted && voteState.userVote === winningOption;
  const userLost = isResolved && hasVoted && voteState.userVote !== winningOption;

  // Category badge colors
  const categoryColors: Record<string, string> = {
    weather: "bg-blue-500/20 text-blue-300",
    traffic: "bg-orange-500/20 text-orange-300",
    events: "bg-purple-500/20 text-purple-300",
    civic: "bg-green-500/20 text-green-300",
    local: "bg-pink-500/20 text-pink-300",
  };

  const categoryIcons: Record<string, string> = {
    weather: "⛈️",
    traffic: "🚗",
    events: "🎟️",
    civic: "🏛️",
    local: "📍",
  };

  // Loading skeleton
  if (isInitialLoading) {
    return (
      <div className="mt-3 space-y-2" role="status" aria-label="Loading prediction">
        <div className="h-8 w-32 bg-slate-700/50 rounded animate-pulse" />
        {options.map((option) => (
          <div
            key={`skeleton-${option}`}
            className="h-14 bg-slate-700/50 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Prediction Header: Category + XP Reward + Countdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Category Badge */}
          <span
            className={`
              text-xs px-2 py-1 rounded-full font-medium
              ${categoryColors[predictionData.category] || "bg-slate-600/30 text-slate-300"}
            `}
          >
            {categoryIcons[predictionData.category] || "🔮"}{" "}
            {predictionData.category.charAt(0).toUpperCase() + predictionData.category.slice(1)}
          </span>

          {/* XP Reward Badge */}
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 font-medium">
            +{predictionData.xpReward} XP
          </span>
        </div>

        {/* Countdown or Resolution Status */}
        <div className="text-right">
          {isResolved ? (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
              Resolved
            </span>
          ) : isVotingClosed ? (
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300 font-medium">
              Awaiting Result
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-mono">
              {countdown}
            </span>
          )}
        </div>
      </div>

      {/* Winner Banner (if resolved and user participated) */}
      {userWon && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
          <span className="text-lg">🎉</span>
          <span className="text-emerald-300 font-medium">
            You were right! +{predictionData.xpReward} XP earned
          </span>
          <span className="text-lg">🎉</span>
        </div>
      )}

      {userLost && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="text-slate-400 text-sm">
            Better luck next time! The other option won.
          </span>
        </div>
      )}

      {/* Community Resolution Voting Phase */}
      {showResolutionPhase && !isResolved && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🗳️</span>
              <span className="text-purple-300 font-medium text-sm">
                What actually happened?
              </span>
            </div>
            {resolutionCountdown && (
              <span className="text-xs text-purple-400 font-mono">
                {resolutionCountdown}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mb-3">
            The prediction deadline passed. Vote on the outcome to determine winners!
            {voteState.userVote !== null && (
              <span className="text-purple-300"> Your vote counts 2x since you predicted.</span>
            )}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {options.map((option, index) => {
              const isSelected = resolutionState.userResolutionVote === index;
              const totalTally = resolutionState.tallyA + resolutionState.tallyB;
              const tally = index === 0 ? resolutionState.tallyA : resolutionState.tallyB;
              const percentage = totalTally > 0 ? Math.round((tally / totalTally) * 100) : 0;

              return (
                <button
                  key={`resolution-${pulseId}-${index}`}
                  type="button"
                  onClick={() => handleResolutionVote(index)}
                  disabled={resolutionState.isVoting}
                  className={`
                    relative px-3 py-2 rounded-lg border text-sm font-medium transition-all
                    ${isSelected
                      ? "border-purple-500 bg-purple-500/20 text-purple-200"
                      : "border-slate-600 bg-slate-800/50 text-slate-300 hover:border-purple-400/50"
                    }
                    ${resolutionState.isVoting ? "opacity-50 cursor-wait" : "cursor-pointer"}
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate max-w-full">
                      {option.split(" - ")[0]}
                    </span>
                    {totalTally > 0 && (
                      <span className="text-xs text-slate-400">
                        {percentage}% ({tally})
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 text-xs">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 mt-2 text-center">
            Needs 3+ votes to resolve. Majority wins.
          </p>
        </div>
      )}

      {/* Voting Options */}
      <div className="space-y-2" role="group" aria-label="Prediction voting options">
        {options.map((option, index) => {
          const percentage = getPercentage(index);
          const count = getVoteCount(index);
          const isSelected = voteState.userVote === index;
          const isWinner = isResolved && winningOption === index;
          const isLoser = isResolved && winningOption !== index;

          return (
            <button
              key={`prediction-${pulseId}-${index}`}
              type="button"
              onClick={() => handleVote(index)}
              disabled={isLoading || isVotingClosed || isResolved}
              aria-pressed={isSelected}
              aria-label={`
                ${isResolved ? (isWinner ? "Winning option: " : "Losing option: ") : ""}
                Predict ${option}${hasVoted ? `, ${percentage}% with ${count} votes` : ""}
              `}
              className={`
                relative w-full overflow-hidden rounded-lg border transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900
                ${isWinner
                  ? "border-emerald-500 bg-emerald-500/10"
                  : isLoser
                    ? "border-slate-600/50 bg-slate-800/30 opacity-60"
                    : isSelected
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-slate-600 bg-slate-800/50 hover:border-amber-400/50 hover:bg-slate-700/50"
                }
                ${(isLoading || isVotingClosed || isResolved) && !isWinner ? "cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {/* Progress bar background */}
              {(hasVoted || isResolved) && (
                <div
                  className={`
                    absolute inset-y-0 left-0 transition-all duration-500 ease-out
                    ${isWinner ? "bg-emerald-500/20" : isSelected ? "bg-amber-500/20" : "bg-slate-600/30"}
                  `}
                  style={{ width: `${percentage}%` }}
                  aria-hidden="true"
                />
              )}

              {/* Content */}
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {isWinner && (
                    <span className="text-emerald-400" aria-hidden="true">✓</span>
                  )}
                  {isSelected && !isWinner && (
                    <span className="text-amber-400 text-sm" aria-hidden="true">●</span>
                  )}
                  <span className={`
                    font-medium
                    ${isWinner ? "text-emerald-300" : isSelected ? "text-amber-300" : "text-slate-200"}
                  `}>
                    {option}
                  </span>
                </div>

                {(hasVoted || isResolved) && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-mono ${isWinner ? "text-emerald-400" : "text-slate-400"}`}
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
      </div>

      {/* Total votes & status */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        {voteState.totalVotes > 0 && (
          <span>
            {voteState.totalVotes} prediction{voteState.totalVotes !== 1 ? "s" : ""}
          </span>
        )}
        {!isResolved && !isVotingClosed && (
          <span className="text-amber-400/70">
            Stake your prediction for XP
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 text-center" role="alert">
          {error}
        </p>
      )}

      {/* Sign in prompt */}
      {showSignInPrompt && (
        <div
          className="flex items-center justify-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2"
          role="alert"
        >
          <span>Sign in to make predictions</span>
          <button
            type="button"
            onClick={dismissSignInPrompt}
            className="text-amber-300 hover:text-amber-200 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
