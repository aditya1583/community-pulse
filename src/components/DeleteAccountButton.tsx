"use client";

import React, { useState } from "react";
import { getApiUrl } from "@/lib/api-config";
import * as authBridge from "@/lib/serverAuth";

type DeleteAccountButtonProps = {
  onDeleted?: () => void;
};

/**
 * Delete Account Button
 *
 * Apple App Store requirement (5.1.1v):
 * Apps that support account creation must also offer account deletion.
 *
 * Shows a multi-step confirmation to prevent accidental deletion.
 */
export default function DeleteAccountButton({ onDeleted }: DeleteAccountButtonProps) {
  const [step, setStep] = useState<"idle" | "confirm1" | "confirm2" | "deleting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setStep("deleting");
    setError(null);

    try {
      const token = await authBridge.getAccessToken();
      if (!token) {
        setError("Not signed in");
        setStep("idle");
        return;
      }

      const res = await fetch(getApiUrl("/api/account/delete"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: "DELETE_MY_ACCOUNT" }),
      });

      const data = await res.json();

      if (res.ok) {
        setStep("done");
        // Clear local auth state
        localStorage.clear();
        sessionStorage.clear();
        authBridge.signOut();
        // Redirect after a brief delay
        setTimeout(() => {
          onDeleted?.();
          window.location.href = "/?account_deleted=1";
        }, 2000);
      } else {
        setError(data.error || "Failed to delete account");
        setStep("confirm2");
      }
    } catch (err) {
      console.error("[DeleteAccount] Error:", err);
      setError("Network error. Please try again.");
      setStep("confirm2");
    }
  };

  if (step === "done") {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">👋</div>
        <p className="text-sm font-bold text-white">Account deleted</p>
        <p className="text-xs text-slate-500 mt-1">Redirecting...</p>
      </div>
    );
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm1")}
        className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 transition-colors"
      >
        Delete Account
      </button>
    );
  }

  if (step === "confirm1") {
    return (
      <div className="glass-card premium-border rounded-3xl p-6 space-y-4">
        <div className="text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Delete your account?</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            This will permanently delete your account, posts, and all associated data. This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("idle")}
            className="flex-1 py-2.5 text-xs font-bold text-slate-400 rounded-xl border border-white/10 hover:border-white/20 transition-all"
          >
            Keep Account
          </button>
          <button
            onClick={() => setStep("confirm2")}
            className="flex-1 py-2.5 text-xs font-bold text-red-400 rounded-xl border border-red-500/20 hover:bg-red-500/10 transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // confirm2 or deleting
  return (
    <div className="glass-card premium-border rounded-3xl p-6 space-y-4 border-red-500/20">
      <div className="text-center">
        <div className="text-3xl mb-2">🗑️</div>
        <h3 className="text-sm font-black text-red-400 uppercase tracking-wider">Final confirmation</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          This is permanent. Your posts will be anonymized and your account data will be erased forever.
        </p>
        {error && (
          <p className="text-xs text-red-400 mt-2 font-bold">{error}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => { setStep("idle"); setError(null); }}
          disabled={step === "deleting"}
          className="flex-1 py-2.5 text-xs font-bold text-slate-400 rounded-xl border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={step === "deleting"}
          className="flex-1 py-2.5 text-xs font-black text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all disabled:opacity-50 active:scale-95"
        >
          {step === "deleting" ? "Deleting..." : "Delete Forever"}
        </button>
      </div>
    </div>
  );
}
