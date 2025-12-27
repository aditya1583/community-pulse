export type AuthStatus = "loading" | "signed_in" | "signed_out";

export function getOnboardingCompletedStorageKey(userId: string) {
  return `cp-onboarding-completed:${userId}`;
}

export function readOnboardingCompleted(
  storage: Pick<Storage, "getItem">,
  userId: string
) {
  try {
    return storage.getItem(getOnboardingCompletedStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeOnboardingCompleted(
  storage: Pick<Storage, "setItem">,
  userId: string
) {
  try {
    storage.setItem(getOnboardingCompletedStorageKey(userId), "1");
  } catch {
    // ignore storage errors (private mode, disabled storage, etc.)
  }
}

export function shouldShowFirstPulseOnboarding(args: {
  authStatus: AuthStatus;
  identityReady: boolean;
  pulseCountResolved: boolean;
  userPulseCount: number;
  onboardingCompleted: boolean;
  hasShownThisSession: boolean;
}) {
  if (args.authStatus !== "signed_in") return false;
  if (!args.identityReady) return false;
  if (!args.pulseCountResolved) return false;
  if (args.onboardingCompleted) return false;
  if (args.hasShownThisSession) return false;
  return args.userPulseCount === 0;
}

export function startOfLocalDay(now: Date = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfNextLocalDay(now: Date = new Date()) {
  const d = startOfLocalDay(now);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Get the start of "recent" window (7 days ago)
 */
export function startOfRecentWindow(now: Date = new Date(), days: number = 7) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isInLocalToday(createdAt: string | Date, now: Date = new Date()) {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;

  const start = startOfLocalDay(now).getTime();
  const end = startOfNextLocalDay(now).getTime();
  const t = d.getTime();
  return t >= start && t < end;
}

/**
 * Check if a pulse is within the "recent" window (default 7 days)
 * This is the default filter for the feed - not just "today"
 */
export function isInRecentWindow(createdAt: string | Date, now: Date = new Date(), days: number = 7) {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;

  const start = startOfRecentWindow(now, days).getTime();
  const end = startOfNextLocalDay(now).getTime();
  const t = d.getTime();
  return t >= start && t < end;
}

export function formatPulseDateTime(createdAt: string | Date) {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Unknown time";

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(-2);
  const hours12 = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");

  // Example: 12/26/25 9:07
  return `${month}/${day}/${year} ${hours12}:${minutes}`;
}

export function formatPulseLocation(city: string, neighborhood?: string | null) {
  const safeCity = (city || "").trim();
  const safeNeighborhood = (neighborhood || "").trim();

  if (!safeCity && !safeNeighborhood) return "Unknown location";
  if (safeCity && safeNeighborhood) return `${safeCity} · ${safeNeighborhood}`;
  return safeCity || safeNeighborhood;
}

export function isPostEnabled(args: {
  identityReady: boolean;
  loading: boolean;
  mood: string;
  tag: string;
  message: string;
}) {
  if (!args.identityReady) return false;
  if (args.loading) return false;
  if (!args.mood) return false;
  if (!args.tag) return false;
  if (!args.message.trim()) return false;
  return true;
}

export function resetComposerAfterSuccessfulPost() {
  return { mood: "", tag: "", message: "" };
}

