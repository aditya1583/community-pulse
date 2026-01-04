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
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--background-elevated)]/95 backdrop-blur-lg border-t border-white/[0.06] safe-area-inset-bottom"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="max-w-lg mx-auto px-2">
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
          <div className="relative -mt-6">
            <button
              onClick={onPostPulse}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-emerald-500/40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              aria-label="Post a pulse"
            >
              <svg
                className="w-7 h-7 text-slate-950"
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
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-emerald-400 font-medium whitespace-nowrap">
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
  const baseClasses = "flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[56px] py-2 px-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-lg";
  const activeClasses = isActive ? "text-emerald-400" : "text-slate-500 hover:text-slate-300 active:text-emerald-400";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${activeClasses}`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
        {item.icon}
      </span>
      <span className={`text-[10px] font-medium ${isActive ? "text-emerald-400" : ""}`}>
        {item.label}
      </span>
    </button>
  );
}
