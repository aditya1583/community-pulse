"use client";

import React from "react";
import type { TabId } from "./types";

type BottomNavigationProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onPostPulse: () => void;
};

type NavItem = {
  id: TabId;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "pulse",
    label: "Pulse",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: "events",
    label: "Events",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    id: "traffic",
    label: "Traffic",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    id: "local",
    label: "Local",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
];

/**
 * BottomNavigation - Fixed bottom nav bar for primary navigation
 *
 * 2026 Mobile UX Standards:
 * - 44x44px minimum touch targets
 * - One-handed reachability (bottom placement)
 * - Center FAB for primary action (Post Pulse)
 * - Icon + label for clarity
 * - Safe area inset support for notched devices
 */
export default function BottomNavigation({
  activeTab,
  onTabChange,
  onPostPulse,
}: BottomNavigationProps) {
  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
    >
      <div className="glass-card premium-border rounded-2xl shadow-2xl overflow-hidden px-2 py-1">
        <div className="flex items-center justify-around relative">
          {/* Left nav items */}
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
            />
          ))}

          {/* Center FAB - Post Pulse */}
          {/* iOS Touch Fix: Explicit dimensions on parent to capture touch events */}
          <div className="relative group -mt-6 touch-manipulation">
            <button
              onClick={onPostPulse}
              onTouchEnd={(e) => {
                // iOS Safari sometimes needs explicit touch handling
                e.preventDefault();
                onPostPulse();
              }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:shadow-emerald-500/60 group-hover:-rotate-3 group-active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 touch-manipulation"
              aria-label="Post a pulse"
            >
              <svg
                className="w-8 h-8 text-slate-950 transition-transform duration-500 group-hover:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
            {/* FAB Glow */}
            <div className="absolute -inset-1 bg-emerald-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 -z-10 pointer-events-none" />
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-emerald-400 font-black uppercase tracking-[0.15em] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 pointer-events-none">
              Post
            </span>
          </div>

          {/* Right nav items */}
          {NAV_ITEMS.slice(2).map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onTouchEnd={(e) => {
        // iOS Safari sometimes needs explicit touch handling
        e.preventDefault();
        onClick();
      }}
      className={`relative flex flex-col items-center justify-center gap-1 min-w-[64px] py-1.5 transition-all duration-300 focus-visible:outline-none group touch-manipulation`}
      aria-current={isActive ? "page" : undefined}
    >
      <div className={`
        absolute inset-x-2 inset-y-1 rounded-xl transition-all duration-300 -z-10 pointer-events-none
        ${isActive ? "bg-emerald-500/10" : "bg-transparent group-hover:bg-white/5"}
      `} />

      <span className={`
        transition-all duration-500 pointer-events-none
        ${isActive ? "text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-slate-500 group-hover:text-slate-300"}
      `}>
        {item.icon}
      </span>

      <span className={`
        text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-300 pointer-events-none
        ${isActive ? "text-emerald-400 opacity-100" : "text-slate-500 opacity-60 group-hover:opacity-100"}
      `}>
        {item.label}
      </span>

      {isActive && (
        <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] pointer-events-none" />
      )}
    </button>
  );
}
