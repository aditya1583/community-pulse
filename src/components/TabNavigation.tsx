"use client";

import React from "react";
import { DASHBOARD_TABS, SECONDARY_TABS, type TabId } from "./types";

type TabNavigationProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** When true, only show secondary tabs (News, Status) */
  secondaryOnly?: boolean;
};

/**
 * Tab Navigation component
 *
 * Container: bg-slate-800/50, rounded-xl, p-1, flex with gap-1
 * Active: bg-emerald-500, text-white, rounded-lg
 * Inactive: text-slate-400, hover:text-white
 *
 * When secondaryOnly is true, shows compact pill-style tabs for News/Status
 */
export default function TabNavigation({
  activeTab,
  onTabChange,
  secondaryOnly = false,
}: TabNavigationProps) {
  const tabs = secondaryOnly ? SECONDARY_TABS : DASHBOARD_TABS;

  // Secondary-only mode: compact inline pills
  if (secondaryOnly) {
    return (
      <nav className="flex items-center gap-2">
        <span className="text-xs text-slate-500 uppercase tracking-wider mr-1">More:</span>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabId)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    );
  }

  // Full mode: all tabs
  return (
    <nav className="bg-slate-800/50 rounded-xl p-1 flex gap-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as TabId)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              isActive
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
