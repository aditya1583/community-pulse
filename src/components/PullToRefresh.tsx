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
        // Add timeout safety - don't let refresh get stuck forever
        const timeoutPromise = new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error("Refresh timeout")), 10000)
        );
        await Promise.race([onRefresh(), timeoutPromise]);
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
    <div ref={containerRef} className="relative bg-[#09090b]" style={{ minHeight: "100vh", overscrollBehavior: "none" }}>
      {/* Pull indicator - Only render when actively pulling or refreshing */}
      {shouldShowSpinner && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center pt-10 pointer-events-none z-[9999]"
        >
          <div
            className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-900 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-200"
            style={{
              transform: `scale(${0.8 + progress * 0.2}) translateY(${Math.min(pullDistance, 40)}px)`,
            }}
          >
            {isRefreshing ? (
              <>
                <svg className="w-5 h-5 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Vibing...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 text-emerald-400 transition-transform duration-200"
                  style={{ transform: `rotate(${progress >= 1 ? 180 : 0}deg)` }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">
                  {progress >= 1 ? "Release" : "Refresh"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content with pull transform — no CSS transition on snap-back to prevent stuck state */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'translateY(0)',
          transition: pullDistance > 0 ? 'transform 0.1s ease-out' : 'transform 0.15s ease-out',
          willChange: pullDistance > 0 ? 'transform' : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
