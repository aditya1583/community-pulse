"use client";

import { useState } from "react";
import { authBridge } from "@/lib/authBridge";
import { moderateContent } from "@/lib/moderation";
import {
  resetComposerAfterSuccessfulPost,
  writeOnboardingCompleted,
} from "@/lib/pulses";
import { getApiUrl } from "@/lib/api-config";
import type { Pulse } from "@/components/types";
import type { Profile } from "@/hooks/useAuth";

type TabCategory = "Traffic" | "Events" | "General";

interface UsePostPulseOptions {
  city: string;
  sessionUser: { id: string } | null;
  profile: Profile | null;
  username: string;
  identityReady: boolean;
  geolocationLat: number | null;
  geolocationLon: number | null;
  selectedCityLat?: number | null;
  selectedCityLon?: number | null;
  pulseCountResolved: boolean;
  userPulseCount: number;
  onboardingCompleted: boolean;
  setPulses: React.Dispatch<React.SetStateAction<Pulse[]>>;
  setLoading: (l: boolean) => void;
  setErrorMsg: (e: string | null) => void;
  setShowAuthModal: (s: boolean) => void;
  setShowPulseModal: (s: boolean) => void;
  setPulseCountResolved: (r: boolean) => void;
  setUserPulseCount: React.Dispatch<React.SetStateAction<number>>;
  setOnboardingCompleted: (c: boolean) => void;
  setShowFirstPulseModal: (s: boolean) => void;
  setHasShownOnboarding: (s: boolean) => void;
  setShowFirstPulseBadgeToast: (s: boolean) => void;
  loadStreak: () => Promise<void>;
}

export function usePostPulse(opts: UsePostPulseOptions) {
  // Main form state
  const [mood, setMood] = useState("");
  const [tag, setTag] = useState("General");
  const [message, setMessage] = useState("");

  // Tab-specific pulse input state
  const [trafficMood, setTrafficMood] = useState("");
  const [trafficMessage, setTrafficMessage] = useState("");
  const [eventsMood, setEventsMood] = useState("");
  const [eventsMessage, setEventsMessage] = useState("");
  const [localMood, setLocalMood] = useState("");
  const [localMessage, setLocalMessage] = useState("");

  // Post success feedback
  const [postSuccess, setPostSuccess] = useState(false);

  // Main form validation
  const [moodValidationError, setMoodValidationError] = useState<string | null>(null);
  const [tagValidationError, setTagValidationError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Tab validation
  const [tabMoodValidationError, setTabMoodValidationError] = useState<string | null>(null);
  const [tabMessageValidationError, setTabMessageValidationError] = useState<string | null>(null);
  const [showTabValidationErrors, setShowTabValidationErrors] = useState(false);

  const handleAddPulse = async () => {
    const {
      city, sessionUser, profile, username, identityReady,
      geolocationLat, geolocationLon, selectedCityLat, selectedCityLon,
      pulseCountResolved, userPulseCount, onboardingCompleted,
      setPulses, setLoading, setErrorMsg, setShowAuthModal, setShowPulseModal,
      setPulseCountResolved, setUserPulseCount, setOnboardingCompleted,
      setShowFirstPulseModal, setHasShownOnboarding, setShowFirstPulseBadgeToast,
      loadStreak,
    } = opts;

    console.log("[Voxlo] handleAddPulse called", {
      message: message.slice(0, 20),
      mood,
      tag,
      identityReady,
      sessionUser: !!sessionUser,
      profile: profile?.anon_name,
    });
    const trimmed = message.trim();
    const resolvedTag = tag || "General";

    if (!sessionUser) {
      setErrorMsg("Sign in to post.");
      setShowAuthModal(true);
      return;
    }

    if (!identityReady) {
      setErrorMsg("Please wait...");
      return;
    }

    let hasErrors = false;

    if (!mood) {
      setMoodValidationError("Please select a vibe");
      hasErrors = true;
    } else {
      setMoodValidationError(null);
    }

    if (!tag) {
      setTag(resolvedTag);
    }
    setTagValidationError(null);

    if (!trimmed) {
      setValidationError("Please enter a message");
      hasErrors = true;
    } else {
      const moderationResult = moderateContent(trimmed);
      if (!moderationResult.allowed) {
        setValidationError(
          moderationResult.reason || "Pulse contains disallowed language."
        );
        hasErrors = true;
      } else {
        setValidationError(null);
      }
    }

    if (hasErrors) {
      setShowValidationErrors(true);
      return;
    }

    setErrorMsg(null);
    setShowValidationErrors(false);

    const wasFirstPulse =
      pulseCountResolved && userPulseCount === 0 && !onboardingCompleted;

    const authorName = profile!.anon_name || username || "Anonymous";

    setLoading(true);
    try {
      console.log("[Voxlo] Getting access token...");
      const accessToken = await authBridge.getAccessToken();
      console.log("[Voxlo] Access token:", accessToken ? `${accessToken.slice(0, 20)}...` : "NULL");

      if (!accessToken) {
        console.error("[Voxlo] No access token — showing sign-in");
        setErrorMsg("Sign in to post.");
        setShowAuthModal(true);
        return;
      }

      const postBody = {
        city,
        mood,
        tag: resolvedTag,
        message: trimmed,
        author: authorName,
        lat: geolocationLat ?? selectedCityLat ?? null,
        lon: geolocationLon ?? selectedCityLon ?? null,
      };
      console.log("[Voxlo] Posting pulse:", { ...postBody, message: postBody.message.slice(0, 30) });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(getApiUrl("/api/pulses"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(postBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      console.log("[Voxlo] POST /api/pulses response:", res.status, res.statusText);

      type CreatePulseResponse = { pulse?: unknown; error?: string; code?: string };
      let data: CreatePulseResponse | null = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse error
      }

      console.log("[Voxlo] Response data:", data ? { pulse: !!data.pulse, error: data.error, code: data.code } : "null");

      if (!res.ok || !data?.pulse) {
        const serverMsg = data?.error;
        const fallback = `Post failed (${res.status}). Please try again.`;
        const msg = serverMsg || fallback;
        console.error("[Voxlo] Post failed:", res.status, res.statusText, "body:", JSON.stringify(data));

        if (data?.code === "MODERATION_FAILED") {
          setValidationError(msg);
          setShowValidationErrors(true);
          return;
        }

        if (res.status === 401) {
          setErrorMsg("Session expired. Please sign in again.");
          setShowAuthModal(true);
          return;
        }

        setErrorMsg(msg);
        return;
      }

      const raw = data.pulse as Record<string, unknown>;
      const createdAt =
        typeof raw.created_at === "string"
          ? raw.created_at
          : typeof raw.createdAt === "string"
            ? raw.createdAt
            : new Date().toISOString();

      const createdPulse: Pulse = {
        id: Number(raw.id),
        city: typeof raw.city === "string" ? raw.city : city,
        neighborhood:
          typeof raw.neighborhood === "string" ? raw.neighborhood : null,
        mood: typeof raw.mood === "string" ? raw.mood : mood,
        tag: typeof raw.tag === "string" ? raw.tag : resolvedTag,
        message: typeof raw.message === "string" ? raw.message : trimmed,
        author: typeof raw.author === "string" ? raw.author : authorName,
        createdAt,
        user_id: typeof raw.user_id === "string" ? raw.user_id : sessionUser.id,
      };

      if (createdPulse.id) {
        setPulses((prev) => {
          const exists = prev.some((p) => String(p.id) === String(createdPulse.id));
          if (exists) return prev;
          return [createdPulse, ...prev].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }

      const reset = resetComposerAfterSuccessfulPost();
      setMessage(reset.message);
      setMood(reset.mood);
      setTag(reset.tag);
      setValidationError(null);
      setMoodValidationError(null);
      setTagValidationError(null);
      setShowValidationErrors(false);

      setShowPulseModal(false);

      // Show success toast
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);

      setPulseCountResolved(true);
      setUserPulseCount((prev) => prev + 1);

      if (wasFirstPulse) {
        writeOnboardingCompleted(window.localStorage, sessionUser.id);
        setOnboardingCompleted(true);
        setShowFirstPulseModal(false);
        setHasShownOnboarding(true);
      }

      if (sessionUser) {
        await loadStreak();

        if (wasFirstPulse) {
          setShowFirstPulseBadgeToast(true);
          setTimeout(() => {
            setShowFirstPulseBadgeToast(false);
          }, 5000);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Unexpected error creating pulse:", errMsg, err);
      if (errMsg.includes("abort")) {
        setErrorMsg("Post timed out. Check your connection and try again.");
      } else {
        setErrorMsg(`Network error: ${errMsg.slice(0, 80)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabPulseSubmit = async (
    tabCategory: TabCategory,
    tabMood: string,
    tabMessage: string,
    setTabMood: (m: string) => void,
    setTabMessage: (m: string) => void
  ) => {
    const {
      city, sessionUser, profile, username, identityReady,
      geolocationLat, geolocationLon, selectedCityLat, selectedCityLon,
      pulseCountResolved, userPulseCount, onboardingCompleted,
      setPulses, setLoading, setErrorMsg, setShowAuthModal,
      setPulseCountResolved, setUserPulseCount, setOnboardingCompleted,
      setShowFirstPulseModal, setHasShownOnboarding, setShowFirstPulseBadgeToast,
      loadStreak,
    } = opts;

    const trimmed = tabMessage.trim();

    if (!sessionUser) {
      setErrorMsg("Sign in to post.");
      setShowAuthModal(true);
      return;
    }

    if (!identityReady) {
      setErrorMsg("Please wait...");
      return;
    }

    let hasErrors = false;

    if (!tabMood) {
      setTabMoodValidationError("Please select a vibe");
      hasErrors = true;
    } else {
      setTabMoodValidationError(null);
    }

    if (!trimmed) {
      setTabMessageValidationError("Please enter a message");
      hasErrors = true;
    } else {
      const moderationResult = moderateContent(trimmed);
      if (!moderationResult.allowed) {
        setTabMessageValidationError(
          moderationResult.reason || "Pulse contains disallowed language."
        );
        hasErrors = true;
      } else {
        setTabMessageValidationError(null);
      }
    }

    if (hasErrors) {
      setShowTabValidationErrors(true);
      return;
    }

    setErrorMsg(null);
    setShowTabValidationErrors(false);

    const wasFirstPulse =
      pulseCountResolved && userPulseCount === 0 && !onboardingCompleted;

    const authorName = profile?.anon_name || username || "Anonymous";

    try {
      const accessToken = await authBridge.getAccessToken();

      if (!accessToken) {
        setErrorMsg("Sign in to post.");
        setShowAuthModal(true);
        return;
      }

      setLoading(true);

      const res = await fetch(getApiUrl("/api/pulses"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          city,
          mood: tabMood,
          tag: tabCategory,
          message: trimmed,
          author: authorName,
          lat: geolocationLat ?? selectedCityLat ?? null,
          lon: geolocationLon ?? selectedCityLon ?? null,
        }),
      });

      type CreatePulseResponse = { pulse?: unknown; error?: string; code?: string };
      let data: CreatePulseResponse | null = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse error
      }

      if (!res.ok || !data?.pulse) {
        const serverMsg = data?.error;
        const fallback = `Post failed (${res.status}). Please try again.`;
        const msg = serverMsg || fallback;
        console.error("[Voxlo] Tab post failed:", res.status, res.statusText, "body:", JSON.stringify(data));

        if (data?.code === "MODERATION_FAILED") {
          setTabMessageValidationError(msg);
          setShowTabValidationErrors(true);
          setLoading(false);
          return;
        }

        if (res.status === 401) {
          setErrorMsg("Sign in to post.");
          setShowAuthModal(true);
          setLoading(false);
          return;
        }

        setErrorMsg(msg);
        setLoading(false);
        return;
      }

      const raw = data.pulse as Record<string, unknown>;
      const createdAt =
        typeof raw.created_at === "string"
          ? raw.created_at
          : typeof raw.createdAt === "string"
            ? raw.createdAt
            : new Date().toISOString();

      const createdPulse: Pulse = {
        id: Number(raw.id),
        city: typeof raw.city === "string" ? raw.city : city,
        neighborhood:
          typeof raw.neighborhood === "string" ? raw.neighborhood : null,
        mood: typeof raw.mood === "string" ? raw.mood : tabMood,
        tag: typeof raw.tag === "string" ? raw.tag : tabCategory,
        message: typeof raw.message === "string" ? raw.message : trimmed,
        author: typeof raw.author === "string" ? raw.author : authorName,
        createdAt,
        user_id: typeof raw.user_id === "string" ? raw.user_id : sessionUser.id,
      };

      if (createdPulse.id) {
        setPulses((prev) => {
          const exists = prev.some((p) => String(p.id) === String(createdPulse.id));
          if (exists) return prev;
          return [createdPulse, ...prev].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }

      setTabMood("");
      setTabMessage("");
      setTabMoodValidationError(null);
      setTabMessageValidationError(null);
      setShowTabValidationErrors(false);

      setLoading(false);

      setPulseCountResolved(true);
      setUserPulseCount((prev) => prev + 1);

      if (wasFirstPulse) {
        writeOnboardingCompleted(window.localStorage, sessionUser.id);
        setOnboardingCompleted(true);
        setShowFirstPulseModal(false);
        setHasShownOnboarding(true);
      }

      if (sessionUser) {
        await loadStreak();

        if (wasFirstPulse) {
          setShowFirstPulseBadgeToast(true);
          setTimeout(() => {
            setShowFirstPulseBadgeToast(false);
          }, 5000);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Unexpected error creating tab pulse:", errMsg, err);
      setErrorMsg(`Network error: ${errMsg.slice(0, 80)}`);
      setLoading(false);
    }
  };

  const handleTrafficPulseSubmit = () => {
    handleTabPulseSubmit("Traffic", trafficMood, trafficMessage, setTrafficMood, setTrafficMessage);
  };

  const handleEventsPulseSubmit = () => {
    handleTabPulseSubmit("Events", eventsMood, eventsMessage, setEventsMood, setEventsMessage);
  };

  const handleLocalPulseSubmit = () => {
    handleTabPulseSubmit("General", localMood, localMessage, setLocalMood, setLocalMessage);
  };

  return {
    // Main form
    mood, setMood,
    tag, setTag,
    message, setMessage,
    moodValidationError, setMoodValidationError,
    tagValidationError, setTagValidationError,
    validationError, setValidationError,
    showValidationErrors,
    postSuccess,
    handleAddPulse,

    // Tab-specific
    trafficMood, setTrafficMood,
    trafficMessage, setTrafficMessage,
    eventsMood, setEventsMood,
    eventsMessage, setEventsMessage,
    localMood, setLocalMood,
    localMessage, setLocalMessage,
    tabMoodValidationError, setTabMoodValidationError,
    tabMessageValidationError, setTabMessageValidationError,
    showTabValidationErrors,
    handleTrafficPulseSubmit,
    handleEventsPulseSubmit,
    handleLocalPulseSubmit,
  };
}
