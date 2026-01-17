"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface Comment {
  id: string;
  pulse_id: number;
  user_identifier: string;
  message: string;
  created_at: string;
}

interface PulseCommentsProps {
  pulseId: number;
  userIdentifier?: string;
  /** Reporter ID for flagging comments */
  reporterId?: string;
  /** Initial comment count to show before expanding */
  initialCount?: number;
}

// Format relative time (e.g., "2m ago", "1h ago", "3d ago")
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * PulseComments Component
 *
 * Collapsible comment section for pulses.
 * Features:
 * - Tap header to expand/collapse
 * - Shows comment count
 * - Relative timestamps
 * - Add new comment input
 * - Rate limiting and moderation handled by API
 * - Accessible with ARIA attributes
 */
export default function PulseComments({
  pulseId,
  userIdentifier,
  reporterId,
  initialCount = 0,
}: PulseCommentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmitTime = useRef<number>(0);
  const DEBOUNCE_MS = 1000;

  // Fetch comments when expanded
  const fetchComments = useCallback(async () => {
    if (hasFetched && comments.length > 0) return; // Don't refetch if we have comments

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/pulses/${pulseId}/comments`);
      if (!res.ok) {
        setError("Failed to load comments");
        return;
      }

      const data = await res.json();
      setComments(data.comments || []);
      setTotalCount(data.totalCount || 0);
      setHasFetched(true);
    } catch (err) {
      console.error("[PulseComments] Error fetching:", err);
      setError("Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  }, [pulseId, hasFetched, comments.length]);

  // Fetch count on mount (lightweight - just need the count)
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch(`/api/pulses/${pulseId}/comments?limit=0`);
        if (res.ok) {
          const data = await res.json();
          setTotalCount(data.totalCount || 0);
        }
      } catch {
        // Silently fail - count will update when expanded
      }
    }
    fetchCount();
  }, [pulseId]);

  // Fetch full comments when expanded
  useEffect(() => {
    if (isExpanded && !hasFetched) {
      fetchComments();
    }
  }, [isExpanded, hasFetched, fetchComments]);

  // Toggle expand/collapse
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle submit comment
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Debounce
    const now = Date.now();
    if (now - lastSubmitTime.current < DEBOUNCE_MS) {
      return;
    }
    lastSubmitTime.current = now;

    if (!userIdentifier) {
      setShowSignInPrompt(true);
      return;
    }

    const message = newComment.trim();
    if (!message) return;

    if (message.length > 500) {
      setError("Comment too long (max 500 characters)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/pulses/${pulseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIdentifier,
          message,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || "Failed to add comment");
        return;
      }

      const data = await res.json();

      // Add new comment to list
      setComments((prev) => [...prev, data.comment]);
      setTotalCount(data.totalCount);
      setNewComment("");

      // Focus back on input for easy follow-up
      inputRef.current?.focus();
    } catch (err) {
      console.error("[PulseComments] Error submitting:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [pulseId, userIdentifier, newComment]);


  // Delete a comment (own comments only)
  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!userIdentifier) return;

    try {
      const res = await fetch(`/api/pulses/${pulseId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIdentifier }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete comment");
        return;
      }

      // Remove from local state
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setActiveMenu(null);
    } catch (err) {
      console.error("[PulseComments] Delete error:", err);
      setError("Failed to delete comment");
    }
  }, [pulseId, userIdentifier]);

  // Report a comment
  const handleReportComment = useCallback(async (commentId: string, reason: string) => {
    if (!reporterId) {
      setShowSignInPrompt(true);
      return;
    }

    try {
      const res = await fetch(`/api/pulses/${pulseId}/comments/${commentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporterId, reason }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to report comment");
        return;
      }

      setReportingComment(null);
      setReportReason(null);
      setActiveMenu(null);
      // Show success briefly
      setError("Report submitted. Thank you!");
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error("[PulseComments] Report error:", err);
      setError("Failed to report comment");
    }
  }, [pulseId, reporterId]);

  // Character count
  const charCount = newComment.length;
  const isOverLimit = charCount > 500;

  return (
    <div className="mt-3 border-t border-slate-700/50 pt-3">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors w-full"
        aria-expanded={isExpanded}
        aria-controls={`comments-${pulseId}`}
      >
        <span className="text-base">💬</span>
        <span>
          {totalCount === 0 ? "Comments" : `Comments (${totalCount})`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          id={`comments-${pulseId}`}
          className="mt-3 space-y-3"
          role="region"
          aria-label="Comments section"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-2" role="status" aria-label="Loading comments">
              {[1, 2].map((i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-16 bg-slate-700/30 rounded-lg animate-pulse"
                  aria-hidden="true"
                />
              ))}
              <span className="sr-only">Loading comments...</span>
            </div>
          )}

          {/* Comments List */}
          {!isLoading && comments.length > 0 && (
            <div className="space-y-2" role="list" aria-label="Comment list">
              {comments.map((comment) => {
                const isOwnComment = comment.user_identifier === userIdentifier;
                const isMenuOpen = activeMenu === comment.id;
                const isReporting = reportingComment === comment.id;

                return (
                  <div
                    key={comment.id}
                    className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30 relative group"
                    role="listitem"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-cyan-400">{comment.user_identifier}</span>
                        <span aria-hidden="true">•</span>
                        <time dateTime={comment.created_at} className="text-slate-500">
                          {formatRelativeTime(comment.created_at)}
                        </time>
                      </div>

                      {/* Action Menu Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenu(isMenuOpen ? null : comment.id)}
                          className="p-1 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Comment actions"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && !isReporting && (
                          <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                            {isOwnComment && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-slate-700/50 flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                                Delete
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setReportingComment(comment.id);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-amber-400 hover:bg-slate-700/50 flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                              </svg>
                              Report
                            </button>
                          </div>
                        )}

                        {/* Report Reason Selector */}
                        {isReporting && (
                          <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                            <div className="px-3 py-1 text-xs text-slate-400 border-b border-slate-700">
                              Why report?
                            </div>
                            {["spam", "harassment", "inappropriate", "misinformation"].map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => handleReportComment(comment.id, reason)}
                                className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700/50 capitalize"
                              >
                                {reason}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setReportingComment(null);
                                setActiveMenu(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-700/50 border-t border-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-200 leading-snug">
                      {comment.message}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && comments.length === 0 && hasFetched && (
            <p className="text-sm text-slate-500 text-center py-2">
              No comments yet. Be the first!
            </p>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-xs text-red-400 text-center" role="alert">
              {error}
            </p>
          )}

          {/* Sign In Prompt - clickable to trigger sign-in */}
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
              <span>Sign in to comment</span>
              <span className="text-amber-300 font-medium">Sign in</span>
              <svg className="w-3.5 h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          )}

          {/* Add Comment Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                maxLength={550} // Allow a bit over to show error
                disabled={isSubmitting}
                className={`
                  w-full bg-slate-800/50 border rounded-lg px-3 py-2 text-sm text-slate-200
                  placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isOverLimit ? "border-red-500" : "border-slate-600"}
                `}
                aria-label="Write a comment"
                aria-invalid={isOverLimit}
              />
              {/* Character count (only show when typing) */}
              {charCount > 0 && (
                <span
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
                    isOverLimit ? "text-red-400" : "text-slate-500"
                  }`}
                  aria-live="polite"
                >
                  {charCount}/500
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim() || isOverLimit}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900
                ${isSubmitting || !newComment.trim() || isOverLimit
                  ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
                }
              `}
              aria-label="Send comment"
            >
              {isSubmitting ? (
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                "Send"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
