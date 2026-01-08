"use client";

import Link from "next/link";
import { useState } from "react";

export function BotLabButton() {
  const [isHovered, setIsHovered] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Link
      href="/bot-lab"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 text-white shadow-lg shadow-pink-500/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-pink-500/40"
    >
      <span className="text-xl">🧠</span>
      {isHovered && (
        <span className="text-sm font-semibold animate-in fade-in slide-in-from-right-2 duration-200">
          Bot Lab
        </span>
      )}
    </Link>
  );
}
