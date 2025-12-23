"use client";

import React from "react";

type FABProps = {
  onClick: () => void;
  visible?: boolean;
};

/**
 * Floating Action Button (FAB)
 *
 * Position: fixed bottom-6 right-6
 * Size: w-14 h-14, rounded-full
 * Style: bg-gradient emerald-400 to emerald-600, shadow-lg shadow-emerald-500/30
 * Icon: Plus icon (white)
 *
 * Only visible on Events and Traffic tabs (hidden on Pulse tab)
 */
export default function FAB({ onClick, visible = true }: FABProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white hover:from-emerald-300 hover:to-emerald-500 hover:scale-105 transition-all duration-200 z-40"
      aria-label="Create new pulse"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4.5v15m7.5-7.5h-15"
        />
      </svg>
    </button>
  );
}
