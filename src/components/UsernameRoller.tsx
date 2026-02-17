"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { generateFunUsername } from "@/lib/username";
import { getApiUrl } from "@/lib/api-config";

type UsernameRollerProps = {
  initialUsername: string;
  onConfirm: (username: string) => void;
  onCancel?: () => void;
  /** If true, shows as a modal overlay */
  modal?: boolean;
};

/**
 * UsernameRoller — Dice-roll username picker
 *
 * Shows a random username with a 🎲 button to reroll,
 * a text input for custom names, and a "Lock it in" button.
 */
export default function UsernameRoller({
  initialUsername,
  onConfirm,
  onCancel,
  modal = false,
}: UsernameRollerProps) {
  const [currentName, setCurrentName] = useState(initialUsername);
  const [customInput, setCustomInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [diceClicked, setDiceClicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  const rollDice = useCallback(async () => {
    if (rolling) return;
    setError(null);
    setIsCustom(false);
    setCustomInput("");
    setRolling(true);
    setDiceClicked(true);
    setHasInteracted(true);
    setTimeout(() => setDiceClicked(false), 600);

    // Shuffle animation: cycle through 6 random names
    let count = 0;
    const totalCycles = 6;
    rollIntervalRef.current = setInterval(() => {
      setCurrentName(generateFunUsername());
      count++;
      if (count >= totalCycles) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      }
    }, 80);

    // After animation, set the final name
    setTimeout(() => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      const finalName = generateFunUsername();
      setCurrentName(finalName);
      setRolling(false);
    }, 600);
  }, [rolling]);

  const handleCustomSubmit = useCallback(async () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/username"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json();
      if (data.filtered) {
        setError("That name isn\u2019t allowed. Try something else!");
        return;
      }
      setCurrentName(data.username);
      setIsCustom(true);
      setHasInteracted(true);
    } catch {
      setError("Couldn\u2019t validate name. Try again.");
    }
  }, [customInput]);

  const handleConfirm = useCallback(async () => {
    if (!currentName || confirming) return;
    setConfirming(true);
    onConfirm(currentName);
  }, [currentName, confirming, onConfirm]);

  const content = (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5 sm:p-6 w-full max-w-sm mx-auto shadow-2xl">
      {/* Close button */}
      {onCancel && (
        <div className="flex justify-end -mt-1 -mr-1 mb-1">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-all"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Choose Your Identity</h2>
        <p className="text-xs sm:text-sm text-slate-400">This is how your neighbors will know you</p>
      </div>

      {/* Current Name Display */}
      <div className="bg-slate-900/70 border border-slate-600/30 rounded-xl p-4 mb-4 text-center relative overflow-hidden">
        <div
          className={`text-xl sm:text-2xl font-bold text-emerald-400 transition-all duration-150 ${
            rolling ? "animate-pulse scale-105" : ""
          }`}
        >
          {currentName}
        </div>
        {isCustom && (
          <span className="text-[10px] text-slate-500 mt-1 block">customized ✨</span>
        )}
      </div>

      {/* Dice Roll Button */}
      <button
        onClick={rollDice}
        disabled={rolling || confirming}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 mb-4
          bg-slate-700/50 hover:bg-slate-700 border border-slate-600/30
          rounded-xl text-white font-medium transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          active:scale-[0.97]"
      >
        <span
          className={`text-xl inline-block transition-transform duration-500 ${
            diceClicked ? "animate-[dice-spin_0.5s_ease-out]" : ""
          }`}
          style={{ transformOrigin: "center" }}
        >
          🎲
        </span>
        <span>{rolling ? "Rolling..." : "Roll New Name"}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">or type your own</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      {/* Custom Input */}
      <div className="flex gap-2 mb-1">
        <input
          type="text"
          value={customInput}
          onChange={(e) => {
            setCustomInput(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
          placeholder="e.g. NightOwl42"
          maxLength={24}
          disabled={confirming}
          className="flex-1 min-w-0 bg-slate-900/70 border border-slate-600/30 rounded-xl px-3 sm:px-4 py-2.5
            text-white placeholder:text-slate-600 text-sm
            focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
            disabled:opacity-50"
        />
        <button
          onClick={handleCustomSubmit}
          disabled={!customInput.trim() || confirming}
          className="px-3 sm:px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/30
            rounded-xl text-sm text-white font-medium transition-all flex-shrink-0
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check
        </button>
      </div>

      {/* Character count */}
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="h-4">
          {error && <p className="text-red-400 text-[11px]">{error}</p>}
        </div>
        {customInput.length > 0 && (
          <p className="text-[10px] text-slate-600">{customInput.length}/24</p>
        )}
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={confirming || (!hasInteracted && !initialUsername)}
        className={`w-full py-3 px-4 rounded-xl text-white font-semibold transition-all
          active:scale-[0.97] ${
            hasInteracted || initialUsername
              ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
              : "bg-slate-700 cursor-not-allowed opacity-60"
          }
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {confirming ? "Locking in..." : "🔒 Lock It In"}
      </button>

      {/* Cancel link */}
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={confirming}
          className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Keep current name
        </button>
      )}

      {/* Dice spin keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dice-spin {
          0% { transform: rotate(0deg) scale(1); }
          30% { transform: rotate(180deg) scale(1.3); }
          60% { transform: rotate(360deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
      ` }} />
    </div>
  );

  if (modal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget && onCancel) onCancel(); }}
      >
        {content}
      </div>
    );
  }

  return content;
}
