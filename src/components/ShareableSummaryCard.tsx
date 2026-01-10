"use client";

import React, { useRef, useState, useCallback } from "react";
import type { TrafficLevel } from "./types";

type ShareableSummaryCardProps = {
  cityName: string;
  vibeHeadline: string;
  vibeEmoji?: string;
  summary: string;
  trafficLevel?: TrafficLevel | null;
  eventsCount?: number;
  temperature?: number;
  date?: Date;
};

/**
 * ShareableSummaryCard - Generates a beautiful shareable image of today's city brief
 *
 * Features:
 * - Canvas-based image generation (no external dependencies)
 * - Styled to match the app's dark theme with emerald accents
 * - Includes city name, vibe headline, key stats, AI summary, and branding
 * - Uses Web Share API on mobile, download on desktop
 *
 * Why canvas over html2canvas:
 * - No external dependencies to install
 * - Full control over the output
 * - Faster rendering
 * - Guaranteed consistent output across browsers
 */
export default function ShareableSummaryCard({
  cityName,
  vibeHeadline,
  vibeEmoji,
  summary,
  trafficLevel,
  eventsCount,
  temperature,
  date = new Date(),
}: ShareableSummaryCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Format date for display
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Truncate summary if too long
  const truncateSummary = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    return truncated.substring(0, lastSpace) + "...";
  };

  // Draw the shareable card on canvas
  const generateImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Card dimensions (Instagram story friendly)
    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, "#0f172a"); // slate-900
    bgGradient.addColorStop(0.5, "#1e293b"); // slate-800
    bgGradient.addColorStop(1, "#0f172a"); // slate-900
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative gradient circles
    ctx.save();
    ctx.globalAlpha = 0.1;
    const circleGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 400);
    circleGradient.addColorStop(0, "#10b981"); // emerald-500
    circleGradient.addColorStop(1, "transparent");
    ctx.fillStyle = circleGradient;
    ctx.beginPath();
    ctx.arc(100, 200, 400, 0, Math.PI * 2);
    ctx.fill();

    const circleGradient2 = ctx.createRadialGradient(width, height, 0, width, height, 500);
    circleGradient2.addColorStop(0, "#10b981");
    circleGradient2.addColorStop(1, "transparent");
    ctx.fillStyle = circleGradient2;
    ctx.beginPath();
    ctx.arc(width - 100, height - 200, 500, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Card container with border
    const cardX = 60;
    const cardY = 100;
    const cardWidth = width - 120;
    const cardHeight = height - 200;
    const borderRadius = 40;

    // Card background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)"; // slate-800/80
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, borderRadius);
    ctx.fill();

    // Card border
    ctx.strokeStyle = "rgba(16, 185, 129, 0.3)"; // emerald-500/30
    ctx.lineWidth = 2;
    ctx.stroke();

    // Voxlo logo/branding at top
    ctx.fillStyle = "#10b981"; // emerald-500
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VOXLO", width / 2, cardY + 60);

    // Date
    ctx.fillStyle = "#94a3b8"; // slate-400
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.fillText(formattedDate, width / 2, cardY + 95);

    // City name (large)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px system-ui, -apple-system, sans-serif";
    const displayCity = cityName.split(",")[0]?.trim() || cityName;
    ctx.fillText(displayCity, width / 2, cardY + 200);

    // Vibe headline with emoji
    const headlineWithEmoji = vibeEmoji ? `${vibeEmoji} ${vibeHeadline}` : vibeHeadline;
    ctx.fillStyle = "#34d399"; // emerald-400
    ctx.font = "bold 48px system-ui, -apple-system, sans-serif";

    // Wrap headline if too long
    const maxHeadlineWidth = cardWidth - 100;
    if (ctx.measureText(headlineWithEmoji).width > maxHeadlineWidth) {
      ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
    }
    ctx.fillText(headlineWithEmoji, width / 2, cardY + 280);

    // Stats row
    const statsY = cardY + 380;
    const statSpacing = cardWidth / 3;
    const stats = [];

    if (trafficLevel) {
      stats.push({ label: "Traffic", value: trafficLevel });
    }
    if (eventsCount !== undefined && eventsCount > 0) {
      stats.push({ label: "Events", value: eventsCount.toString() });
    }
    if (temperature !== undefined) {
      stats.push({ label: "Temp", value: `${Math.round(temperature)}F` });
    }

    if (stats.length > 0) {
      // Stats background
      ctx.fillStyle = "rgba(15, 23, 42, 0.5)"; // slate-900/50
      ctx.beginPath();
      ctx.roundRect(cardX + 40, statsY - 40, cardWidth - 80, 100, 20);
      ctx.fill();

      const startX = cardX + cardWidth / 2 - ((stats.length - 1) * statSpacing) / 2;

      stats.forEach((stat, index) => {
        const x = startX + index * statSpacing;

        // Stat value
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(stat.value, x, statsY);

        // Stat label
        ctx.fillStyle = "#64748b"; // slate-500
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.fillText(stat.label.toUpperCase(), x, statsY + 30);
      });
    }

    // AI Summary section
    const summaryY = statsY + 120;
    ctx.textAlign = "left";

    // Summary label
    ctx.fillStyle = "#10b981"; // emerald-500
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.fillText("TODAY'S BRIEF", cardX + 60, summaryY);

    // Summary text (word wrap)
    const truncatedSummary = truncateSummary(summary, 280);
    ctx.fillStyle = "#e2e8f0"; // slate-200
    ctx.font = "24px system-ui, -apple-system, sans-serif";

    const words = truncatedSummary.split(" ");
    let line = "";
    let lineY = summaryY + 45;
    const maxWidth = cardWidth - 120;
    const lineHeight = 36;

    for (const word of words) {
      const testLine = line + word + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== "") {
        ctx.fillText(line.trim(), cardX + 60, lineY);
        line = word + " ";
        lineY += lineHeight;
        if (lineY > cardY + cardHeight - 150) break; // Stop if running out of space
      } else {
        line = testLine;
      }
    }
    if (line.trim() && lineY <= cardY + cardHeight - 150) {
      ctx.fillText(line.trim(), cardX + 60, lineY);
    }

    // Footer branding
    ctx.textAlign = "center";
    ctx.fillStyle = "#475569"; // slate-600
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.fillText("Get your city's vibe at voxlo.app", width / 2, cardY + cardHeight - 60);

    // Radar icon in corner
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(width - 120, cardY + 60, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(width - 120, cardY + 60, 6, 0, Math.PI * 2);
    ctx.fill();

    // Convert to blob
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        "image/png",
        1.0
      );
    });
  }, [cityName, vibeHeadline, vibeEmoji, summary, trafficLevel, eventsCount, temperature, formattedDate]);

  // Handle share action
  const handleShare = async () => {
    setIsGenerating(true);
    setShareError(null);

    try {
      const blob = await generateImage();
      if (!blob) {
        throw new Error("Failed to generate image");
      }

      const file = new File([blob], `community-pulse-${cityName.toLowerCase().replace(/\s+/g, "-")}.png`, {
        type: "image/png",
      });

      // Try Web Share API first (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${cityName} - Voxlo`,
          text: `Check out today's vibe in ${cityName}: ${vibeHeadline}`,
          files: [file],
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Share error:", error);
      if (error instanceof Error && error.name !== "AbortError") {
        setShareError("Could not share. Try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mt-3">
      {/* Hidden canvas for image generation */}
      <canvas
        ref={canvasRef}
        className="hidden"
        aria-hidden="true"
      />

      {/* Share button */}
      <button
        onClick={handleShare}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:border-emerald-500/30 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
      >
        {isGenerating ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Generating...</span>
          </>
        ) : (
          <>
            {/* Share icon */}
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span>Share Today&apos;s Brief</span>
          </>
        )}
      </button>

      {shareError && (
        <p className="mt-2 text-xs text-red-400 text-center">{shareError}</p>
      )}
    </div>
  );
}
