"use client";

import React from "react";
import type { TabId } from "./types";

type TabNavigationProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "pulse", label: "Pulse" },
  { id: "events", label: "Events" },
  { id: "traffic", label: "Traffic" },
  { id: "news", label: "News" },
  { id: "local", label: "Local" },
];

/**
 * Tab Navigation component
 *
 * Container: bg-slate-800/50, rounded-xl, p-1, flex with gap-1
 * Active: bg-emerald-500, text-white, rounded-lg
 * Inactive: text-slate-400, hover:text-white
 */
export default function TabNavigation({
  activeTab,
  onTabChange,
}: TabNavigationProps) {
  return (
    <nav className="bg-slate-800/50 rounded-xl p-1 flex gap-1">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
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
