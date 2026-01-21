"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type AccentColor = "emerald" | "purple" | "amber";

export type BentoStatCardProps = {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  accentColor?: AccentColor;
  isClickable?: boolean;
  ariaLabel?: string;
  // Expanded content to show when card is tapped
  // Can be ReactNode or render function that receives closeModal callback
  expandedContent?: React.ReactNode | ((closeModal: () => void) => React.ReactNode);
  expandedTitle?: string;
  // Fallback onClick if no expanded content provided
  onClick?: () => void;
};

/**
 * BentoStatCard - Interactive stat card with tap-to-expand functionality
 *
 * 2026 Bento Grid Standard:
 * - Tap to expand into detailed modal view
 * - Smooth scale/translate animations
 * - Backdrop blur for focus
 * - Respects reduced motion preferences
 */
export default function BentoStatCard({
  icon,
  value,
  label,
  accentColor = "emerald",
  isClickable = true,
  ariaLabel,
  expandedContent,
  expandedTitle,
  onClick,
}: BentoStatCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const colorClasses: Record<AccentColor, { hover: string; glow: string; accent: string }> = {
    emerald: {
      hover: "hover:border-emerald-500/50",
      glow: "rgba(16, 185, 129, 0.15)",
      accent: "text-emerald-400",
    },
    purple: {
      hover: "hover:border-purple-500/50",
      glow: "rgba(147, 51, 234, 0.15)",
      accent: "text-purple-400",
    },
    amber: {
      hover: "hover:border-amber-500/50",
      glow: "rgba(245, 158, 11, 0.15)",
      accent: "text-amber-400",
    },
  };

  const handleClick = useCallback(() => {
    if (!isClickable) return;

    if (expandedContent) {
      setIsExpanded(true);
    } else if (onClick) {
      onClick();
    }
  }, [isClickable, expandedContent, onClick]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsExpanded(false);
      setIsClosing(false);
    }, 200); // Match animation duration
  }, []);

  // Close on escape key
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, handleClose]);

  // Lock body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  const colors = colorClasses[accentColor];

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!isClickable}
        aria-label={ariaLabel ?? `${label}: ${value}`}
        aria-expanded={isExpanded}
        className={[
          "group relative flex flex-col items-center justify-center gap-2 p-4",
          "glass-card premium-border rounded-2xl overflow-hidden",
          "transition-all duration-500 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
          isClickable
            ? `cursor-pointer hover:scale-[1.02] hover:shadow-xl`
            : "cursor-default opacity-60",
        ].join(" ")}
        style={{
          // Dynamic glow color based on accent
          ["--glow-color" as string]: colors.glow,
        }}
      >
        {/* Hover Gradient Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-${accentColor}-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

        <div className={`${colors.accent} transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_currentColor]`}>{icon}</div>
        <div className="text-white font-black text-lg tracking-tight z-10">{value}</div>
        <div className="text-slate-400 text-[9px] uppercase tracking-[0.2em] font-black z-10 opacity-70 group-hover:opacity-100 transition-opacity">
          {label}
        </div>

        {/* Expansion indicator */}
        {expandedContent && isClickable && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-1 -translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0">
            <svg
              className="w-3 h-3 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        )}
      </button>

      {/* Expanded Modal Portal */}
      {isExpanded && typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 ${isClosing ? "" : "backdrop-animate"
              }`}
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-card-title"
          >
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity ${isClosing ? "opacity-0" : "opacity-100"
                }`}
            />

            {/* Expanded Card Content */}
            <div
              className={`relative w-full max-w-lg max-h-[80vh] overflow-y-auto bg-[var(--background-elevated)] border border-white/10 rounded-2xl shadow-2xl ${isClosing ? "card-expand-exit" : "card-expand-enter"
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[var(--background-elevated)]">
                <div className="flex items-center gap-3">
                  <div className={colors.accent}>{icon}</div>
                  <h2
                    id="expanded-card-title"
                    className="text-lg font-semibold text-white"
                  >
                    {expandedTitle || label}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                {typeof expandedContent === "function"
                  ? expandedContent(handleClose)
                  : expandedContent}
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </>
  );
}
