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
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
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

    // Shuffle animation: rapidly show random names for ~600ms
    let count = 0;
    rollIntervalRef.current = setInterval(() => {
      setCurrentName(generateFunUsername());
      count++;
      if (count >= 8) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      }
    }, 75);

    // After animation, set the final name
    setTimeout(() => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      const finalName = generateFunUsername();
      setCurrentName(finalName);
      setRolling(false);
    }, 650);
  }, [rolling]);

  const handleCustomSubmit = useCallback(async () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;

    // Validate via /api/username
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/username"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json();
      if (data.filtered) {
        setError("That name isn't allowed. Try something else!");
        return;
      }
      // Use the sanitized version from the API
      setCurrentName(data.username);
      setIsCustom(true);
    } catch {
      setError("Couldn't validate name. Try again.");
    }
  }, [customInput]);

  const handleConfirm = useCallback(async () => {
    if (!currentName || confirming) return;
    setConfirming(true);
    onConfirm(currentName);
  }, [currentName, confirming, onConfirm]);

  const content = (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6 w-full max-w-sm mx-auto shadow-2xl">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Pick Your Name</h2>
        <p className="text-sm text-slate-400">Roll the dice or type your own</p>
      </div>

      {/* Current Name Display */}
      <div className="bg-slate-900/70 border border-slate-600/30 rounded-xl p-4 mb-4 text-center relative overflow-hidden">
        <div
          className={`text-2xl font-bold text-emerald-400 transition-all duration-150 ${
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
          active:scale-[0.98]"
      >
        <span className={`text-xl ${rolling ? "animate-spin" : ""}`}>🎲</span>
        <span>{rolling ? "Rolling..." : "Roll New Name"}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-xs text-slate-500">or type your own</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      {/* Custom Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
          placeholder="Type a name..."
          maxLength={24}
          disabled={confirming}
          className="flex-1 bg-slate-900/70 border border-slate-600/30 rounded-xl px-4 py-2.5
            text-white placeholder:text-slate-500 text-sm
            focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
            disabled:opacity-50"
        />
        <button
          onClick={handleCustomSubmit}
          disabled={!customInput.trim() || confirming}
          className="px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/30
            rounded-xl text-sm text-white font-medium transition-all
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs text-center mb-4">{error}</p>
      )}

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500
          rounded-xl text-white font-semibold transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          active:scale-[0.98] shadow-lg shadow-emerald-500/20"
      >
        {confirming ? "Locking in..." : "🔒 Lock It In"}
      </button>

      {/* Cancel */}
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={confirming}
          className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Keep current name
        </button>
      )}
    </div>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        {content}
      </div>
    );
  }

  return content;
}
