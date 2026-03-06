"use client";

import React, { useState } from "react";
import { getApiUrl } from "@/lib/api-config";
import * as authBridge from "@/lib/serverAuth";

type BlockUserButtonProps = {
  targetUserId: string;
  targetUsername?: string;
  onBlocked?: (userId: string) => void;
  className?: string;
};

/**
 * Block User Button
 *
 * Apple Review requirement: mechanism for users to block abusive users.
 * Blocking removes the user's content from the blocker's feed instantly
 * and notifies the developer.
 */
export default function BlockUserButton({
  targetUserId,
  targetUsername,
  onBlocked,
  className = "",
}: BlockUserButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const handleBlock = async () => {
    setLoading(true);
    try {
      const token = await authBridge.getAccessToken();
      if (!token) return;

      const res = await fetch(getApiUrl("/api/block-user"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          blockedUserId: targetUserId,
          reason: "blocked_by_user",
        }),
      });

      if (res.ok) {
        setBlocked(true);
        setShowConfirm(false);
        onBlocked?.(targetUserId);
      }
    } catch (err) {
      console.error("[BlockUser] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (blocked) {
    return (
      <span className={`text-[10px] font-bold text-red-400/60 ${className}`}>
        Blocked
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowConfirm(true);
        }}
        className={`text-slate-600 hover:text-red-400 transition-colors active:scale-90 ${className}`}
        title="Block this user"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }}
        >
          <div
            className="w-full max-w-sm glass-card premium-border rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-6 text-center">
              <div className="text-4xl mb-4">🚫</div>
              <h3 className="text-lg font-black text-white mb-2">Block {targetUsername || "this user"}?</h3>
              <p className="text-sm text-slate-400 mb-6">
                Their posts and comments will be hidden from your feed. You can unblock them later in your settings.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-400 rounded-2xl border border-white/10 hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlock}
                  disabled={loading}
                  className="flex-1 py-3 text-sm font-black text-white bg-red-500 hover:bg-red-400 rounded-2xl transition-all disabled:opacity-50 active:scale-95"
                >
                  {loading ? "..." : "Block"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
