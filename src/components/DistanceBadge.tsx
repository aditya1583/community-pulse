"use client";

import { RADIUS_CONFIG } from "@/lib/constants/radius";
import { formatDistance, categorizeDistance } from "@/lib/geo/distance";

type DistanceBadgeProps = {
  distanceMiles: number;
  /** Show badge even for in-radius content (default: false) */
  showAlways?: boolean;
  /** Size variant (default: "sm") */
  size?: "xs" | "sm";
};

/**
 * DistanceBadge - Visual indicator for distance from user's location
 *
 * By default, only shows for out-of-radius content (>10 miles).
 * Use showAlways=true to display for all distances.
 *
 * Color coding:
 * - Emerald/green: Within 10-mile radius (local)
 * - Amber/yellow: 10-25 miles (nearby)
 * - Orange: 25-50 miles (distant)
 */
export default function DistanceBadge({
  distanceMiles,
  showAlways = false,
  size = "sm",
}: DistanceBadgeProps) {
  const isOutOfRadius = distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES;

  // Don't render if within radius and showAlways is false
  if (!showAlways && !isOutOfRadius) {
    return null;
  }

  const category = categorizeDistance(distanceMiles);

  const colorClasses = {
    local: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    nearby: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    distant: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  };

  const sizeClasses = {
    xs: "text-[9px] px-1.5 py-0.5",
    sm: "text-[10px] px-2 py-0.5",
  };

  const tooltip = isOutOfRadius
    ? `Beyond ${RADIUS_CONFIG.PRIMARY_RADIUS_MILES}-mile radius`
    : `Within ${RADIUS_CONFIG.PRIMARY_RADIUS_MILES}-mile radius`;

  return (
    <span
      className={`
        rounded-full font-mono border
        ${sizeClasses[size]}
        ${colorClasses[category]}
      `}
      title={tooltip}
    >
      {formatDistance(distanceMiles)}
    </span>
  );
}
