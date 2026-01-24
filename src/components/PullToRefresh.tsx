"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

type PullToRefreshProps = {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
};

const PULL_THRESHOLD = 80; // Pixels to pull before triggering refresh
const RESISTANCE = 2.5; // How hard it is to pull

/**
 * PullToRefresh component for iOS-native pull-to-refresh experience
 *
 * Features:
 * - Native iOS-style pull down gesture
 * - Loading spinner animation
 * - Works in Capacitor iOS apps
 * - Smooth animations with spring physics
 */
export default function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartScrollTop = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // Only start tracking if we're at the top of the scroll area
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 5) return;

    touchStartY.current = e.touches[0].clientY;
    touchStartScrollTop.current = scrollTop;
    isPulling.current = true;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    // Only allow pull-to-refresh when at the top
    if (scrollTop > 5) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }

    const diff = currentY - touchStartY.current;

    // Only track downward pulls
    if (diff > 0) {
      // Apply resistance so it gets harder to pull
      const distance = Math.min(diff / RESISTANCE, PULL_THRESHOLD * 1.5);
      setPullDistance(distance);

      // Prevent default scrolling when pulling down from top
      if (distance > 0) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled) return;

    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD / 2); // Keep spinner visible

      try {
        await onRefresh();
      } catch (error) {
        console.error("[PullToRefresh] Refresh error:", error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh, disabled]);

  // Add touch listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive: false for touchmove to allow preventDefault
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const shouldShowSpinner = pullDistance > 10 || isRefreshing;

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center overflow-hidden transition-transform duration-200 ease-out z-50"
        style={{
          transform: `translateY(${pullDistance - 50}px)`,
          opacity: shouldShowSpinner ? 1 : 0,
        }}
      >
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/90 border border-slate-700/50 backdrop-blur-sm shadow-lg ${
            isRefreshing ? "animate-pulse" : ""
          }`}
        >
          {isRefreshing ? (
            // Spinning loader
            <svg
              className="w-5 h-5 text-emerald-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            // Arrow that rotates as you pull
            <svg
              className="w-5 h-5 text-emerald-400 transition-transform duration-200"
              style={{
                transform: `rotate(${progress >= 1 ? 180 : progress * 180}deg)`,
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
