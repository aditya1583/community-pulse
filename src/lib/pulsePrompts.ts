/**
 * Time-based placeholder prompts for Pulse input
 *
 * These prompts inspire users to share more interesting, contextual content
 * instead of generic observations like "good weather today"
 */

import type { PulseCategory } from "@/components/types";

type TimeOfDay = "morning" | "midday" | "afternoon" | "evening" | "night";
type DayType = "weekday" | "weekend";

/**
 * Get current time context
 */
function getTimeContext(): { timeOfDay: TimeOfDay; dayType: DayType } {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Determine day type
  const dayType: DayType = (day === 0 || day === 6) ? "weekend" : "weekday";

  // Determine time of day
  let timeOfDay: TimeOfDay;
  if (hour >= 5 && hour < 10) {
    timeOfDay = "morning";
  } else if (hour >= 10 && hour < 12) {
    timeOfDay = "midday";
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = "afternoon";
  } else if (hour >= 17 && hour < 21) {
    timeOfDay = "evening";
  } else {
    timeOfDay = "night";
  }

  return { timeOfDay, dayType };
}

/**
 * General prompts organized by time context
 * These are designed to spark specific, interesting observations
 */
const GENERAL_PROMPTS: Record<TimeOfDay, Record<DayType, string[]>> = {
  morning: {
    weekday: [
      "How's the coffee line at your spot?",
      "Is the morning commute smooth today?",
      "Any good breakfast spots open early?",
      "How packed is the gym this morning?",
    ],
    weekend: [
      "What's the brunch wait time looking like?",
      "Any garage sales or markets nearby?",
      "How's the farmers market crowd today?",
      "Good morning for outdoor coffee?",
    ],
  },
  midday: {
    weekday: [
      "Where's the lunch rush happening?",
      "Any food truck lines worth the wait?",
      "Is the coworking space busy today?",
      "Good spots for a quick lunch nearby?",
    ],
    weekend: [
      "Where's everyone grabbing lunch?",
      "Any good hiking trail conditions?",
      "How's the mall/shopping center vibe?",
      "Worth checking out any local spots?",
    ],
  },
  afternoon: {
    weekday: [
      "How's the afternoon traffic shaping up?",
      "Any good coffee shops for a work break?",
      "Is the post office line crazy today?",
      "Any local deals or happy hours starting?",
    ],
    weekend: [
      "Where's the best parking for downtown?",
      "Any live music happening today?",
      "How crowded is the park right now?",
      "Good vibe spots to hang out?",
    ],
  },
  evening: {
    weekday: [
      "Hear any sirens? What's happening?",
      "How's the rush hour commute looking?",
      "Any restaurant wait times worth knowing?",
      "Good spots for dinner tonight?",
    ],
    weekend: [
      "What's the nightlife vibe tonight?",
      "Any good shows or events happening?",
      "Where's everyone heading out?",
      "Best spot for Saturday/Sunday night?",
    ],
  },
  night: {
    weekday: [
      "Any late-night spots still open?",
      "How's the neighborhood vibe tonight?",
      "Anyone else working late nearby?",
      "Good 24/7 food options around?",
    ],
    weekend: [
      "What's still poppin' tonight?",
      "Any after-hours spots worth it?",
      "How's the Uber/Lyft situation?",
      "Late night food recommendations?",
    ],
  },
};

/**
 * Category-specific prompts (non-time-dependent)
 */
const CATEGORY_PROMPTS: Record<Exclude<PulseCategory, "General">, string[]> = {
  Traffic: [
    "What's traffic like? (e.g., 'I-35 backed up near downtown')",
    "Any accidents or road closures?",
    "How's the highway looking right now?",
    "Construction delays anywhere?",
  ],
  Weather: [
    "How's the weather feeling outside?",
    "Perfect day for outdoor plans?",
    "Any weather surprises today?",
    "What's the real temperature feel like?",
  ],
  Events: [
    "What event are you at right now?",
    "How's the crowd at the event?",
    "Any hidden gems at this venue?",
    "Worth checking out this event?",
  ],
};

/**
 * Get a contextual placeholder for the Pulse input
 *
 * For "General" category: returns time-appropriate, engaging prompts
 * For other categories: returns category-specific prompts
 */
export function getPulsePrompt(category: PulseCategory): string {
  if (category !== "General") {
    // Return random category-specific prompt
    const prompts = CATEGORY_PROMPTS[category];
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  // For General: use time-based prompts
  const { timeOfDay, dayType } = getTimeContext();
  const prompts = GENERAL_PROMPTS[timeOfDay][dayType];

  // Pick a random prompt from the appropriate time slot
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Get a stable placeholder (doesn't change on re-render)
 * Uses the current minute to seed selection, so it only changes every minute
 */
export function getStablePulsePrompt(category: PulseCategory): string {
  if (category !== "General") {
    const prompts = CATEGORY_PROMPTS[category];
    const index = new Date().getMinutes() % prompts.length;
    return prompts[index];
  }

  const { timeOfDay, dayType } = getTimeContext();
  const prompts = GENERAL_PROMPTS[timeOfDay][dayType];
  const index = new Date().getMinutes() % prompts.length;

  return prompts[index];
}
