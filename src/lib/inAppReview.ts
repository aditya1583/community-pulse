import { Capacitor, registerPlugin } from "@capacitor/core";

interface InAppReviewPlugin {
  requestReview(): Promise<void>;
}

const InAppReview = registerPlugin<InAppReviewPlugin>("InAppReview");

const REVIEW_PULSE_THRESHOLD = 3;
const STORAGE_KEY = "voxlo_review_prompted";

/**
 * Request an in-app review after the user's Nth pulse.
 * Only triggers once. Only works on native iOS.
 * Call this after every successful pulse post.
 */
export async function maybeRequestReview(userPulseCount: number): Promise<void> {
  // Only on native iOS
  if (Capacitor.getPlatform() !== "ios") return;

  // Only trigger at exactly the threshold
  if (userPulseCount !== REVIEW_PULSE_THRESHOLD) return;

  // Only prompt once ever
  if (typeof window !== "undefined" && window.localStorage) {
    const alreadyPrompted = localStorage.getItem(STORAGE_KEY);
    if (alreadyPrompted) return;
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  }

  try {
    await InAppReview.requestReview();
    console.log("[Voxlo] In-app review requested");
  } catch (err) {
    console.warn("[Voxlo] In-app review failed:", err);
  }
}
