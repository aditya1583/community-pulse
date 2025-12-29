"use client";

import React from "react";

type FABProps = {
  onClick: () => void;
  visible?: boolean;
  /** Show a subtle pulse animation to draw attention */
  animated?: boolean;
};

/**
 * Floating Action Button (FAB)
 *
 * A persistent, attention-drawing button for the primary action (drop a pulse).
 *
 * Position: fixed bottom-6 right-6 (with safe area padding on mobile)
 * Size: w-14 h-14, rounded-full
 * Style: bg-gradient emerald-400 to emerald-600, shadow-lg shadow-emerald-500/30
 * Icon: Lightning bolt (pulse icon) - representing the pulse action
 *
 * Features:
 * - Subtle pulse animation ring to draw attention
 * - Smooth scale transition on hover
 * - Safe area inset for iOS devices
 * - Always visible across all tabs (the primary action should always be accessible)
 */
export default function FAB({ onClick, visible = true, animated = true }: FABProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white hover:from-emerald-300 hover:to-emerald-500 hover:scale-110 active:scale-95 transition-all duration-200 z-40 group"
      style={{
        // Safe area inset for iOS notch/home indicator
        marginBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Drop a pulse"
    >
      {/* Animated pulse ring */}
      {animated && (
        <>
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
          <span
            className="absolute inset-[-4px] rounded-full border-2 border-emerald-400/30 animate-pulse"
            style={{ animationDuration: "2s" }}
          />
        </>
      )}

      {/* Lightning bolt icon - represents dropping a pulse */}
      <svg
        className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform duration-200"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    </button>
  );
}
