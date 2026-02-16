"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { authBridge } from "@/lib/authBridge";
import { useGeocodingAutocomplete } from "@/hooks/useGeocodingAutocomplete";
import { useEvents } from "@/hooks/useEvents";
import type { GeocodedCity } from "@/lib/geocoding";
import {
  shouldShowFirstPulseOnboarding,
  hasShownFirstPulseModalThisSession,
  markFirstPulseModalShown,
} from "@/lib/pulses";
// New Neon Theme Components
// Force rebuild: PulseCard styling update
import Header from "@/components/Header";
import CurrentVibeCard from "@/components/CurrentVibeCard";
import QuickStats from "@/components/QuickStats";
import TabNavigation from "@/components/TabNavigation";
import BottomNavigation from "@/components/BottomNavigation";
import AISummaryStories from "@/components/AISummaryStories";
import EventCard from "@/components/EventCard";
import PulseCard from "@/components/PulseCard";
import LocalTab from "@/components/LocalTab";
import StatusTab from "@/components/StatusTab";
import PulseInput from "@/components/PulseInput";
import PulseModal from "@/components/PulseModal";
import TrafficContent from "@/components/TrafficContent";
// LiveVibes removed (dead feature)
import { DASHBOARD_TABS, type TabId, type Pulse } from "@/components/types";
import { useAuth } from "@/hooks/useAuth";
// Profile type inferred from useAuth
import { usePulses } from "@/hooks/usePulses";
import { useGamification } from "@/hooks/useGamification";
import XPProgressBadge from "@/components/XPProgressBadge";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHomeData } from "@/hooks/useHomeData";
import { useSummary } from "@/hooks/useSummary";
import { useCityMood } from "@/hooks/useCityMood";
import { useStreak } from "@/hooks/useStreak";
import { useUsername } from "@/hooks/useUsername";
import { useAutoSeed } from "@/hooks/useAutoSeed";
import { usePostPulse } from "@/hooks/usePostPulse";
import LocationPrompt from "@/components/LocationPrompt";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import InstallPrompt from "@/components/InstallPrompt";
import PullToRefresh from "@/components/PullToRefresh";
import { getApiUrl } from "@/lib/api-config";

// EVENTS
type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  starts_at: string;
  ends_at?: string | null;
  is_sponsored?: boolean | null;
};

// GLOBAL POSTING STREAK — type moved to useStreak hook

// Saved Favorites
type FavoritePulseId = number;

const TAGS = ["All", "Traffic", "Weather", "Events", "General"];

const DEFAULT_CITY: GeocodedCity = {
  id: "austin-tx-us",
  name: "Austin",
  state: "TX",
  country: "US",
  lat: 30.2672,
  lon: -97.7431,
  displayName: "Austin, TX, US",
};

type StoredCity = {
  displayName: string;
  name?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
  id?: string;
};

const TAB_ID_SET = new Set<TabId>(DASHBOARD_TABS.map((tab) => tab.id));

function isTabId(value: unknown): value is TabId {
  return typeof value === "string" && TAB_ID_SET.has(value as TabId);
}

// Gas price data removed from home load per directive (Phase 2)

export default function Home() {
  // Core state - initialize with defaults to avoid SSR hydration mismatch
  // localStorage restoration happens in useEffect after hydration
  const [city, setCity] = useState(DEFAULT_CITY.displayName);
  const [selectedCity, setSelectedCity] = useState<GeocodedCity | null>(DEFAULT_CITY);
  const [lastValidCity, setLastValidCity] = useState<GeocodedCity>(DEFAULT_CITY);
  const [tagFilter, setTagFilter] = useState("All");
  const [username, setUsername] = useState<string>("");
  // validationError, mood, tag, message — extracted to usePostPulse hook

  // Tab-specific pulse state — extracted to usePostPulse hook

  // Tab state for new Neon theme
  // Persist tab state in sessionStorage so it survives navigation to venue pages
  const [activeTab, setActiveTabState] = useState<TabId>("pulse");
  // localSection removed — LocalTab simplified to single view

  // Wrapper to persist tab changes
  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem("cp-active-tab", tab);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      // Ignore storage errors
    }
  };

  // Restore local section from sessionStorage on mount
  // NOTE: We do NOT restore the active tab — "pulse" is always the default
  // Pulse is the main landing page. sessionStorage in WKWebView persists
  // across app restarts, so restoring would override the intended default.
  // Storage restoration removed — no longer needed
  const [showPulseModal, setShowPulseModal] = useState(false);

  // Auth + anon profile (extracted to useAuth hook)
  const {
    sessionUser, setSessionUser,
    profile, setProfile,
    authStatus, setAuthStatus,
    profileLoading, setProfileLoading,
    showAuthModal, setShowAuthModal,
    authMode, setAuthMode,
    authEmail, setAuthEmail,
    authPassword, setAuthPassword,
    authPasswordConfirm, setAuthPasswordConfirm,
    authLoading, setAuthLoading,
    authError, setAuthError,
    authSuccess, setAuthSuccess,
    handleAuth,
    handleForgotPassword,
  } = useAuth();

  // User gamification stats (level, XP, tier)
  const {
    level: userLevel,
    xp: userXp,
    weeklyRank: userRank,
    loading: gamificationLoading,
  } = useGamification(sessionUser?.id ?? null);

  // Geolocation - true hyperlocal experience
  const geolocation = useGeolocation();

  // Pulses/Feed (extracted to usePulses hook)
  const {
    pulses, setPulses,
    initialPulsesFetched, setInitialPulsesFetched,
    hasMorePulses,
    loadingMore,
    authorStats,
    loading, setLoading, errorMsg, setErrorMsg,
    fetchPulses,
    handlePullToRefresh,
    handleLoadMorePulses,
    visiblePulses,
    pulsesWithDistance,
  } = usePulses({ city, selectedCity, geolocation });
  // Initialize with false to avoid hydration mismatch - restored in useEffect
  const [useManualLocation, setUseManualLocation] = useState(false);
  // Track if we've restored state from storage (prevents geolocation race)
  const [storageRestored, setStorageRestored] = useState(false);
  // Ref to ensure storage restoration only happens once (survives re-renders and StrictMode)
  const storageRestorationAttempted = useRef(false);

  // USER STREAK (extracted to useStreak hook)
  const {
    streakInfo, userPulseCount, setUserPulseCount,
    pulseCountResolved, setPulseCountResolved,
    onboardingCompleted, setOnboardingCompleted, loadStreak,
  } = useStreak(sessionUser?.id);

  // Saved Favorites
  const [favoritePulseIds, setFavoritePulseIds] = useState<FavoritePulseId[]>(
    []
  );
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // AI username generator (extracted to useUsername hook)
  const {
    usernamePrompt, setUsernamePrompt,
    usernameGenerating, usernameErrorMsg,
    showUsernameEditor, setShowUsernameEditor,
    lastAnonName,
    handleLockUsername, handleGenerateUsername, handleRevertUsername,
  } = useUsername({ sessionUser, profile, setProfile, username, setUsername });

  // First-time user onboarding
  const [showFirstPulseModal, setShowFirstPulseModal] = useState(false);
  const [showFirstPulseBadgeToast, setShowFirstPulseBadgeToast] = useState(false);
  const [hasShownOnboarding, setHasShownOnboarding] = useState(false);

  // Form validation — extracted to usePostPulse hook
  const [checklistDismissed, setChecklistDismissed] = useState(false);

  // Pull-to-refresh trigger
  // refreshTrigger removed — pull-to-refresh now directly awaits fetchPulses

  // Events state (legacy - user-created events from Supabase)
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventCreateError, setEventCreateError] = useState<string | null>(null);

  // Ticketmaster Events - uses useEvents hook with location
  const {
    events: ticketmasterEvents,
    isLoading: ticketmasterLoading,
    error: ticketmasterError,
    fallback: ticketmasterFallback,
  } = useEvents(selectedCity?.lat ?? null, selectedCity?.lon ?? null, {
    radius: 25,
    city: city,
    state: selectedCity?.state ?? undefined,
  });

  // Bundled weather + traffic data (extracted to useHomeData hook)
  const {
    weather, weatherLoading, weatherError,
    trafficLevel, trafficLoading, trafficError,
    trafficIncidents, hasRoadClosure,
  } = useHomeData({ city, lat: selectedCity?.lat, lon: selectedCity?.lon });

  // AI Summary (extracted to useSummary hook)
  const { summary, summaryLoading, summaryError } = useSummary({
    city, pulses, ticketmasterEvents, trafficLevel, weather,
  });

  // City Mood (extracted to useCityMood hook)
  const { cityMood, cityMoodLoading, cityMoodError } = useCityMood({
    city, lat: selectedCity?.lat, lon: selectedCity?.lon,
    ticketmasterEvents, trafficLevel, weather, pulsesLength: pulses.length,
  });

  // Gas Prices (for quick view in Current Vibe section)
  // Gas price state removed — no longer fetched on home load

  // City Autocomplete
  const {
    inputValue: cityInput,
    setInputValue: setCityInput,
    suggestions: citySuggestions,
    selectCity: applySuggestionSelection,
    loading: citySuggestionsLoading,
    error: citySuggestionsError,
    notFound: citySuggestionsNotFound,
    open: showCitySuggestions,
    setOpen: setShowCitySuggestions,
    highlightedIndex,
    setHighlightedIndex,
    commitInput: commitCityInput,
    clearSuggestions,
  } = useGeocodingAutocomplete({ minLength: 3, debounceMs: 300, limit: 7 });

  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const pulseTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [renderCitySuggestionsMenu, setRenderCitySuggestionsMenu] = useState(false);
  const cityDropdownOpen = showCitySuggestions && citySuggestions.length > 0;

  // After sign-out redirect, show auth modal and clean URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("signed_out")) {
      setShowAuthModal(true);
      // Clean the URL without triggering a reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!isTabId(activeTab)) {
      console.warn(`[tabs] Unknown activeTab "${String(activeTab)}" — defaulting to "pulse"`);
      setActiveTab("pulse");
    }
  }, [activeTab]);

  useEffect(() => {
    if (cityDropdownOpen) {
      setRenderCitySuggestionsMenu(true);
      return;
    }

    if (!renderCitySuggestionsMenu) return;

    const t = window.setTimeout(() => setRenderCitySuggestionsMenu(false), 160);
    return () => window.clearTimeout(t);
  }, [cityDropdownOpen, renderCitySuggestionsMenu]);

  // AI SUMMARY — extracted to useSummary hook

  // CITY MOOD — extracted to useCityMood hook

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cityInputRef.current &&
        !cityInputRef.current.contains(event.target as Node) &&
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCitySuggestions(false);
        clearSuggestions();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clearSuggestions, setShowCitySuggestions]);

  // Keep the visible input aligned with the active city label
  useEffect(() => {
    if (city) {
      setCityInput(city);
    }
  }, [city, setCityInput]);

  // Reset tag filter to "All" when city changes
  // Prevents confusing "No pulses yet" when user switches cities with a filter active
  useEffect(() => {
    setTagFilter("All");
  }, [city]);

  // BUNDLED WEATHER + TRAFFIC — extracted to useHomeData hook

  // Identity is ready when signed in with a profile, OR if profile loading is taking too long
  // This prevents the "WAIT..." button from getting stuck forever
  const identityReady =
    authStatus === "signed_in" && !!sessionUser && !profileLoading && !!profile;

  // Pulse posting logic (extracted to usePostPulse hook)
  const {
    mood, setMood, tag, setTag, message, setMessage,
    moodValidationError, setMoodValidationError,
    tagValidationError, setTagValidationError,
    validationError, setValidationError,
    showValidationErrors,
    handleAddPulse,
    trafficMood, setTrafficMood, trafficMessage, setTrafficMessage,
    eventsMood, setEventsMood, eventsMessage, setEventsMessage,
    localMood, setLocalMood, localMessage, setLocalMessage,
    tabMoodValidationError, setTabMoodValidationError,
    tabMessageValidationError, setTabMessageValidationError,
    showTabValidationErrors,
    handleTrafficPulseSubmit, handleEventsPulseSubmit, handleLocalPulseSubmit,
  } = usePostPulse({
    city,
    sessionUser,
    profile,
    username,
    identityReady,
    geolocationLat: geolocation.lat,
    geolocationLon: geolocation.lon,
    selectedCityLat: selectedCity?.lat,
    selectedCityLon: selectedCity?.lon,
    pulseCountResolved,
    userPulseCount,
    onboardingCompleted,
    setPulses,
    setLoading,
    setErrorMsg,
    setShowAuthModal,
    setShowPulseModal,
    setPulseCountResolved,
    setUserPulseCount,
    setOnboardingCompleted,
    setShowFirstPulseModal,
    setHasShownOnboarding,
    setShowFirstPulseBadgeToast,
    loadStreak,
  });

  // Reset first-pulse modal state on user change
  useEffect(() => {
    setShowFirstPulseModal(false);
    setHasShownOnboarding(false);
  }, [sessionUser?.id]);

  // ========= FIRST-TIME USER ONBOARDING =========
  // Use sessionStorage to track if modal has been shown (survives navigation within session)
  useEffect(() => {
    // Check sessionStorage first - if already shown this session, don't show again
    const alreadyShownInSession = hasShownFirstPulseModalThisSession(window.sessionStorage);

    const show = shouldShowFirstPulseOnboarding({
      authStatus,
      identityReady,
      pulseCountResolved,
      userPulseCount,
      onboardingCompleted,
      hasShownThisSession: hasShownOnboarding || alreadyShownInSession,
    });

    if (show) {
      setShowFirstPulseModal(true);
      setHasShownOnboarding(true);
      // Persist to sessionStorage so it survives navigation
      markFirstPulseModalShown(window.sessionStorage);
    }
  }, [
    authStatus,
    identityReady,
    pulseCountResolved,
    userPulseCount,
    onboardingCompleted,
    hasShownOnboarding,
  ]);

  useEffect(() => {
    if (!showFirstPulseModal) return;
    if (onboardingCompleted) {
      setShowFirstPulseModal(false);
      return;
    }
    if (pulseCountResolved && userPulseCount > 0) {
      setShowFirstPulseModal(false);
    }
  }, [showFirstPulseModal, onboardingCompleted, pulseCountResolved, userPulseCount]);

  // ========= LOAD FAVORITES FOR USER =========
  useEffect(() => {
    const userId = sessionUser?.id;

    if (!userId) {
      setFavoritePulseIds([]);
      return;
    }

    async function loadFavorites() {
      try {
        setFavoritesLoading(true);

        const { data, error } = await supabase
          .from("favorites")
          .select("pulse_id")
          .eq("user_id", userId);

        if (error) {
          console.error("Error loading favorites:", error);
          return;
        }

        const ids = (data || []).map(
          (row: { pulse_id: number }) => row.pulse_id
        );
        setFavoritePulseIds(ids);
      } catch (err) {
        console.error("Unexpected error loading favorites:", err);
      } finally {
        setFavoritesLoading(false);
      }
    }

    loadFavorites();
  }, [sessionUser]);

  // ========= EVENTS FETCH =========
  useEffect(() => {
    if (!city) return;

    async function fetchEvents() {
      try {
        setEventsLoading(true);
        setEventsError(null);

        const res = await fetch(getApiUrl(`/api/events?city=${encodeURIComponent(city)}`));

        type EventsResponse = { events?: EventItem[]; error?: string };
        let data: EventsResponse | null = null;
        try {
          data = await res.json();
        } catch {
          // ignore JSON parse error
        }

        if (!res.ok) {
          console.error("Events API returned error:", data);
          setEventsError(
            (data && data.error) || "Unable to load local events right now."
          );
          setEvents([]);
          return;
        }

        setEvents((data && data.events) || []);
      } catch (err: unknown) {
        console.error("Error fetching events:", err);
        setEventsError("Unable to load local events right now.");
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    }

    fetchEvents();
  }, [city]);

  // ========= STORAGE RESTORATION (runs once after hydration) =========
  // Restores city and manual location flag to prevent geolocation override
  // Uses a ref to ensure this only runs ONCE even with StrictMode double-invocation
  useEffect(() => {
    if (typeof window === "undefined") return;

    // CRITICAL: Skip if already attempted (prevents StrictMode/re-render issues)
    if (storageRestorationAttempted.current) {
      // Even if skipped, ensure storageRestored is true
      if (!storageRestored) setStorageRestored(true);
      return;
    }
    storageRestorationAttempted.current = true;

    // 1. Restore manual location flag FIRST (BEFORE anything else can run)
    try {
      const savedManualFlag = sessionStorage.getItem("cp-use-manual-location");
      if (savedManualFlag === "true") {
        setUseManualLocation(true);
        console.log("[Storage Restore] Manual location flag restored: true");
      }
    } catch {
      // Ignore storage errors
    }

    // 2. Restore city from localStorage
    const savedCity = localStorage.getItem("cp-city");
    if (savedCity) {
      try {
        const parsed = JSON.parse(savedCity) as StoredCity;
        if (parsed && parsed.displayName) {
          const restoredCity: GeocodedCity = {
            id:
              parsed.id ||
              `${parsed.displayName}-${parsed.lat ?? "unknown"}-${parsed.lon ?? "unknown"
              }`,
            name:
              parsed.name ||
              parsed.displayName.split(",")[0]?.trim() ||
              parsed.displayName,
            state: parsed.state,
            country: parsed.country,
            lat: parsed.lat ?? DEFAULT_CITY.lat,
            lon: parsed.lon ?? DEFAULT_CITY.lon,
            displayName: parsed.displayName,
          };

          console.log("[Storage Restore] City restored:", restoredCity.displayName);
          setCity(restoredCity.displayName);
          setCityInput(restoredCity.displayName);
          if (parsed.lat && parsed.lon) {
            setSelectedCity(restoredCity);
            setLastValidCity(restoredCity);
          }
        }
      } catch {
        // Fallback to treating as plain string
        console.log("[Storage Restore] City restored (plain):", savedCity);
        setCity(savedCity);
        setCityInput(savedCity);
        setSelectedCity(null);
      }
    }

    // 3. Mark storage as restored - allows geolocation to proceed if not manual
    setStorageRestored(true);
    console.log("[Storage Restore] Complete");
  }, [setCityInput, setLastValidCity, setSelectedCity, setCity, storageRestored]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!city) return;
    const toStore: StoredCity =
      selectedCity ?? {
        displayName: city,
      };

    try {
      localStorage.setItem("cp-city", JSON.stringify(toStore));
    } catch {
      // Ignore storage errors
    }
  }, [city, selectedCity]);

  // ========= GEOLOCATION → CITY SYNC =========
  // When geolocation succeeds and we're not in manual mode, update city state
  useEffect(() => {
    // Skip until storage has been restored (prevents race condition)
    if (!storageRestored) {
      console.log("[Geo Sync] Skipping - storage not yet restored");
      return;
    }
    // Skip if user chose manual mode (check state first, then storage as fallback)
    if (useManualLocation) {
      console.log("[Geo Sync] Skipping - manual location mode active (state)");
      return;
    }
    // CRITICAL FALLBACK: Check sessionStorage directly in case state hasn't synced yet
    // This prevents race conditions where geolocation sync runs before state updates
    try {
      const storedManualFlag = sessionStorage.getItem("cp-use-manual-location");
      if (storedManualFlag === "true") {
        console.log("[Geo Sync] Skipping - manual location mode active (storage fallback)");
        return;
      }
    } catch {
      // Ignore storage errors
    }
    // Skip if geolocation doesn't have data yet
    if (!geolocation.lat || !geolocation.lon || !geolocation.displayName) {
      console.log("[Geo Sync] Skipping - no geolocation data");
      return;
    }
    // Skip if still loading
    if (geolocation.loading) {
      console.log("[Geo Sync] Skipping - geolocation still loading");
      return;
    }

    // Build a GeocodedCity from geolocation
    const geoCity: GeocodedCity = {
      id: `geo-${geolocation.lat}-${geolocation.lon}`,
      name: geolocation.cityName || "Near You",
      state: geolocation.stateCode || undefined,
      lat: geolocation.lat,
      lon: geolocation.lon,
      displayName: geolocation.displayName,
    };

    console.log("[Geo Sync] Updating city to geolocation:", geoCity.displayName);

    // Update city state with geolocation data
    // Use applySuggestionSelection to set input without triggering autocomplete search
    applySuggestionSelection(geoCity);
    setCity(geoCity.displayName);
    setSelectedCity(geoCity);
    setLastValidCity(geoCity);
  }, [
    storageRestored,
    useManualLocation,
    geolocation.lat,
    geolocation.lon,
    geolocation.displayName,
    geolocation.cityName,
    geolocation.stateCode,
    geolocation.loading,
    applySuggestionSelection,
  ]);

  // Handler for selecting a city from autocomplete
  function handleCitySelect(chosenCity: GeocodedCity) {
    applySuggestionSelection(chosenCity);
    setCity(chosenCity.displayName);
    setSelectedCity(chosenCity);
    setLastValidCity(chosenCity);
    setShowCitySuggestions(false);
    // Mark as manual selection to prevent geolocation from overwriting
    setUseManualLocation(true);
    // Persist manual location flag so it survives page navigation
    try {
      sessionStorage.setItem("cp-use-manual-location", "true");
    } catch {
      // Ignore storage errors
    }
  }

  // Handler for city input changes
  function handleCityInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setCityInput(value);
    setShowCitySuggestions(value.trim().length >= 3);
    setHighlightedIndex(-1);
  }

  // Handler for pressing Enter in city input
  function handleCityInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (citySuggestions.length === 0) return;
      e.preventDefault();
      setShowCitySuggestions(true);
      setHighlightedIndex((prev) =>
        prev < citySuggestions.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (e.key === "ArrowUp") {
      if (citySuggestions.length === 0) return;
      e.preventDefault();
      setShowCitySuggestions(true);
      setHighlightedIndex((prev) =>
        prev <= 0 ? citySuggestions.length - 1 : prev - 1
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (citySuggestions.length > 0) {
        const selection =
          highlightedIndex >= 0 && highlightedIndex < citySuggestions.length
            ? citySuggestions[highlightedIndex]
            : citySuggestions[0];
        handleCitySelect(selection);
      } else if (cityInput.trim()) {
        const manualCity = cityInput.trim();
        commitCityInput();
        setCity(manualCity);
        setSelectedCity(null);
        setShowCitySuggestions(false);
        // Mark as manual selection to prevent geolocation from overwriting
        setUseManualLocation(true);
        // Persist manual location flag so it survives page navigation
        try {
          sessionStorage.setItem("cp-use-manual-location", "true");
        } catch {
          // Ignore storage errors
        }
      }
      return;
    }

    if (e.key === "Escape") {
      setShowCitySuggestions(false);
      clearSuggestions();
    }
  }

  // AUTO-SEED AND REFRESH STALE CITIES — extracted to useAutoSeed hook
  useAutoSeed({
    city, pulses, initialPulsesFetched, loading,
    ticketmasterEvents, ticketmasterLoading,
    weather, weatherLoading,
    selectedCityLat: selectedCity?.lat,
    selectedCityLon: selectedCity?.lon,
    fetchPulses,
  });

  // ========= TRAFFIC =========
  // ========= CREATE EVENT HANDLER =========
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!city || !newEventTitle || !newEventTime) return;

    try {
      setCreatingEvent(true);
      setEventCreateError(null);

      const res = await fetch(getApiUrl("/api/events"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          title: newEventTitle,
          location: newEventLocation,
          starts_at: newEventTime,
        }),
      });

      type CreateEventResponse = { event?: EventItem; error?: string };
      let data: CreateEventResponse | null = null;
      try {
        data = await res.json();
      } catch {
        // If body is empty or not JSON
      }

      if (!res.ok) {
        const msg =
          (data && data.error) ||
          `Failed to create event (status ${res.status})`;
        throw new Error(msg);
      }

      if (data && data.event) {
        setEvents((prev) => [data.event as EventItem, ...prev]);
      }

      setNewEventTitle("");
      setNewEventLocation("");
      setNewEventTime("");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to create event right now.";
      console.error("Error creating event:", err);
      setEventCreateError(message);
    } finally {
      setCreatingEvent(false);
    }
  }

  // ========= FAVORITES TOGGLE HANDLER =========
  async function handleToggleFavorite(pulseId: number) {
    const userId = sessionUser?.id;
    if (!userId) {
      alert("Sign in to save favorites.");
      return;
    }

    const alreadyFav = favoritePulseIds.includes(pulseId);

    try {
      if (alreadyFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("pulse_id", pulseId);

        if (error) {
          console.error("Error removing favorite:", error);
          return;
        }

        setFavoritePulseIds((prev) => prev.filter((id) => id !== pulseId));
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: userId,
          pulse_id: pulseId,
        });

        if (error) {
          console.error("Error adding favorite:", error);
          return;
        }

        setFavoritePulseIds((prev) =>
          prev.includes(pulseId) ? prev : [...prev, pulseId]
        );
      }
    } catch (err) {
      console.error("Unexpected error toggling favorite:", err);
    }
  }

  // handleLockUsername — extracted to useUsername hook

  // ========= DELETE PULSE HANDLER =========
  async function handleDeletePulse(pulseId: number) {
    const userId = sessionUser?.id;
    if (!userId) {
      setErrorMsg("Sign in to delete pulses.");
      return;
    }

    const pulse = pulses.find((p) => p.id === pulseId);
    if (!pulse) {
      setErrorMsg("Pulse not found.");
      return;
    }

    if (pulse.user_id !== userId) {
      setErrorMsg("You can only delete your own pulses.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this pulse?")) {
      return;
    }

    try {
      // Use authBridge + API endpoint instead of supabase client directly.
      // On Capacitor/WKWebView, the supabase JS client has no session
      // (auth goes through authBridge/serverAuth), so direct supabase.delete()
      // fires with no auth token and RLS silently blocks it.
      const accessToken = await authBridge.getAccessToken();
      if (!accessToken) {
        setErrorMsg("Sign in to delete pulses.");
        setShowAuthModal(true);
        return;
      }

      const res = await fetch(getApiUrl(`/api/pulses?id=${pulseId}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error || `Delete failed (${res.status})`;
        console.error("Error deleting pulse:", msg);
        setErrorMsg(msg);
        return;
      }

      setPulses((prev) => prev.filter((p) => p.id !== pulseId));
      setUserPulseCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Unexpected error deleting pulse:", err);
      setErrorMsg("Could not delete pulse. Please try again.");
    }
  }

  // handleGenerateUsername, handleRevertUsername — extracted to useUsername hook

  // Apply tag filter
  const filteredPulses = pulsesWithDistance.filter((p) => tagFilter === "All" || p.tag === tagFilter);

  // Count in-radius vs out-of-radius for potential UI separation
  const inRadiusPulses = filteredPulses.filter(
    (p) => p.distanceMiles !== null && p.distanceMiles <= RADIUS_CONFIG.PRIMARY_RADIUS_MILES
  );
  const outOfRadiusPulses = filteredPulses.filter(
    (p) => p.distanceMiles === null || p.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES
  );

  // Traffic-tagged pulses for traffic tab (also filter expired)
  const trafficPulses = visiblePulses.filter((p) => p.tag === "Traffic");

  // "Happening Now" - Find the most critical active pulse for pinning
  // Priority: Traffic alerts < 1hr old, then Events happening today, then Weather alerts
  const happeningNowPulse = useMemo(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Consider both in-radius pulses AND pulses without coordinates (treated as local)
    // This ensures bot-generated alerts without geo-coords still appear in "Happening Now"
    const localPulses = filteredPulses.filter(
      (p) => p.distanceMiles === null || p.distanceMiles <= RADIUS_CONFIG.PRIMARY_RADIUS_MILES
    );

    const candidates = localPulses
      .filter((p) => {
        const created = new Date(p.createdAt);
        // Must be recent (within 2 hours)
        if (created < new Date(now.getTime() - 2 * 60 * 60 * 1000)) return false;
        // Must be high-priority category
        return p.tag === "Traffic" || p.tag === "Events" || p.tag === "Weather";
      })
      .map((p) => {
        const created = new Date(p.createdAt);
        let priority = 0;

        // Traffic gets highest priority if very recent
        if (p.tag === "Traffic" && created > oneHourAgo) priority = 100;
        else if (p.tag === "Traffic") priority = 50;
        // Events get medium-high priority
        else if (p.tag === "Events") priority = 40;
        // Weather alerts
        else if (p.tag === "Weather") priority = 30;

        // Boost for polls/predictions (interactive)
        if (p.poll_options && p.poll_options.length >= 2) priority += 10;
        if (p.is_prediction) priority += 15;

        return { pulse: p, priority };
      })
      .sort((a, b) => b.priority - a.priority);

    return candidates.length > 0 ? candidates[0].pulse : null;
  }, [filteredPulses]);

  // handleAddPulse, handleTabPulseSubmit, tab handlers — extracted to usePostPulse hook

  const displayName = profile?.anon_name || username || "...";
  const currentStreak = streakInfo?.currentStreak ?? 0;

  const recentPulseCount2h = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    return pulses.reduce((count, pulse) => {
      const createdAtMs = new Date(pulse.createdAt).getTime();
      if (Number.isNaN(createdAtMs)) return count;
      return createdAtMs >= cutoff ? count + 1 : count;
    }, 0);
  }, [pulses]);

  const localState = selectedCity?.state ?? lastValidCity.state ?? "";
  // Prefer exact GPS coordinates over city center for Local tab (closer results)
  const localLat = geolocation.lat ?? selectedCity?.lat ?? lastValidCity.lat;
  const localLon = geolocation.lon ?? selectedCity?.lon ?? lastValidCity.lon;

  // Force GPS refresh when switching to Local tab for accurate nearby results
  useEffect(() => {
    if (activeTab === "local" && !useManualLocation && geolocation.permissionStatus === "granted") {
      geolocation.requestLocation();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDropPulseJump = useCallback(() => {
    setActiveTab("pulse");

    const tryFocus = (attempt: number) => {
      const target = document.getElementById("drop-a-pulse");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        const textarea =
          pulseTextareaRef.current ??
          target.querySelector<HTMLTextAreaElement>("textarea");
        textarea?.focus();
        return;
      }

      if (attempt < 10) {
        window.setTimeout(() => tryFocus(attempt + 1), 50);
      }
    };

    window.setTimeout(() => tryFocus(0), 0);
  }, [setActiveTab]);

  // Show LocationPrompt if:
  // 1. Not in manual mode
  // 2. Geolocation permission is "prompt" (never asked)
  // 3. No cached location (geolocation hasn't been granted before)
  // 4. Not still loading
  const showLocationPrompt =
    !useManualLocation &&
    !geolocation.loading &&
    geolocation.permissionStatus === "prompt" &&
    !geolocation.lat;

  // Show loading overlay while geolocation is resolving after user granted permission
  // This prevents users from interacting with Austin content while waiting for location
  // EXPANDED: Also show loading when permission is granted but we haven't received data yet
  // This closes the race condition gap between permission check and location arrival
  const showLocationLoading =
    !useManualLocation &&
    !geolocation.lat &&
    !geolocation.error &&
    (
      geolocation.loading ||
      // Permission granted but still waiting for location data (gap between permission check and requestLocationInternal)
      (geolocation.permissionStatus === "granted" && !geolocation.displayName)
    );

  // If we need location prompt, show it instead of main app
  if (showLocationPrompt) {
    return (
      <LocationPrompt
        onRequestLocation={async () => {
          const success = await geolocation.requestLocation();
          return success;
        }}
        onUseManual={() => {
          setUseManualLocation(true);
          try {
            sessionStorage.setItem("cp-use-manual-location", "true");
          } catch {
            // Ignore storage errors
          }
        }}
        loading={geolocation.loading}
        error={geolocation.error}
      />
    );
  }

  // Show loading screen while determining location
  if (showLocationLoading) {
    return (
      <div className="min-h-screen neon-grid-bg text-slate-50 flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-emerald-400">Finding your location...</h2>
          <p className="text-slate-400 text-sm">Getting hyperlocal content for your area</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fixed background that extends into iOS safe areas */}
      <div className="fixed inset-0 bg-black -z-50" aria-hidden="true" />

      <div className="min-h-screen neon-grid-bg text-slate-50 flex flex-col">
        {/* First-Time User Onboarding Modal */}
        {showFirstPulseModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
              className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowFirstPulseModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <svg className="w-8 h-8 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Drop your first pulse
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Share what&apos;s happening in your city - traffic, weather, mood, anything.
              </p>
              <button
                onClick={() => {
                  setShowFirstPulseModal(false);
                  setActiveTab("pulse");
                  setTimeout(() => {
                    pulseTextareaRef.current?.focus();
                  }, 100);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-medium text-sm rounded-lg shadow-lg shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500 transition"
              >
                <span>Start my first pulse</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                onClick={() => setShowFirstPulseModal(false)}
                className="block mx-auto mt-3 text-xs text-slate-500 hover:text-slate-300 transition"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {/* First Pulse Badge Toast */}
        {showFirstPulseBadgeToast && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="bg-emerald-500/15 border border-emerald-500/60 rounded-xl px-4 py-3 shadow-lg shadow-emerald-500/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-100">
                  Nice! You started your streak
                </p>
                <p className="text-xs text-emerald-300/80">
                  and unlocked your first badge
                </p>
              </div>
              <button
                onClick={() => setShowFirstPulseBadgeToast(false)}
                className="text-emerald-300 hover:text-emerald-100 ml-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Auth Modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAuthModal(false)}>
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                {authMode === "forgot" ? (
                  <h2 className="text-lg font-semibold text-white">Reset Password</h2>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setAuthError(null);
                        setAuthSuccess(null);
                        setAuthPasswordConfirm("");
                      }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${authMode === "signin"
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800/60 text-slate-400 hover:text-white"
                        }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${authMode === "signup"
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800/60 text-slate-400 hover:text-white"
                        }`}
                    >
                      Create Account
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowAuthModal(false);
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthEmail("");
                    setAuthPassword("");
                    setAuthPasswordConfirm("");
                    setAuthMode("signin");
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={authMode === "forgot" ? handleForgotPassword : handleAuth} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="auth-email" className="text-xs text-slate-400 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={authEmail}
                    onChange={(e) => {
                      setAuthEmail(e.target.value);
                      setAuthError(null);
                    }}
                    placeholder="you@example.com"
                    className="rounded-lg bg-slate-800/70 border border-slate-700/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent"
                    disabled={authLoading}
                    autoFocus
                  />
                </div>

                {authMode !== "forgot" && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="auth-password" className="text-xs text-slate-400 uppercase tracking-wide">
                      Password
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      value={authPassword}
                      onChange={(e) => {
                        setAuthPassword(e.target.value);
                        setAuthError(null);
                      }}
                      placeholder={authMode === "signup" ? "Create a strong password" : "Enter your password"}
                      className="rounded-lg bg-slate-800/70 border border-slate-700/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent"
                      disabled={authLoading}
                    />
                    {authMode === "signup" && (
                      <p className="text-[10px] text-slate-500">
                        Must be 8+ characters with uppercase, lowercase, and number
                      </p>
                    )}
                    {authMode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setAuthError(null);
                          setAuthSuccess(null);
                          setAuthPassword("");
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 text-left mt-1 transition"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                )}

                {authMode === "signup" && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="auth-password-confirm" className="text-xs text-slate-400 uppercase tracking-wide">
                      Confirm Password
                    </label>
                    <input
                      id="auth-password-confirm"
                      type="password"
                      value={authPasswordConfirm}
                      onChange={(e) => {
                        setAuthPasswordConfirm(e.target.value);
                        setAuthError(null);
                      }}
                      placeholder="Re-enter your password"
                      className="rounded-lg bg-slate-800/70 border border-slate-700/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent"
                      disabled={authLoading}
                    />
                  </div>
                )}

                {authError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                    {authError}
                  </p>
                )}

                {authSuccess && (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2">
                    {authSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-medium text-sm rounded-lg shadow-lg shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {authLoading
                    ? "Please wait..."
                    : authMode === "signup"
                      ? "Create Account"
                      : authMode === "forgot"
                        ? "Send Reset Link"
                        : "Sign In"}
                </button>

                {authMode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signin");
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white text-center transition"
                  >
                    Back to Sign In
                  </button>
                )}

                <p className="text-[11px] text-slate-500 text-center">
                  {authMode === "signup"
                    ? "We'll assign you a fun anonymous username after you create your account."
                    : authMode === "forgot"
                      ? "Enter the email you used to sign up and we'll send you a reset link."
                      : "Your password is securely encrypted."}
                </p>
              </form>
            </div>
          </div>
        )}

        {/* Pulse Modal - for FAB */}
        <PulseModal
          isOpen={showPulseModal}
          onClose={() => setShowPulseModal(false)}
          mood={mood}
          tag={tag}
          message={message}
          displayName={displayName}
          identityReady={identityReady}
          loading={loading}
          moodValidationError={moodValidationError}
          tagValidationError={tagValidationError}
          messageValidationError={validationError}
          showValidationErrors={showValidationErrors}
          onMoodChange={(m) => {
            setMood(m);
            setMoodValidationError(null);
          }}
          onTagChange={(t) => {
            setTag(t);
            setTagValidationError(null);
          }}
          onMessageChange={(m) => {
            setMessage(m);
            setValidationError(null);
          }}
          onSubmit={handleAddPulse}
          weather={weather}
        />

        <PullToRefresh onRefresh={handlePullToRefresh} disabled={loading}>
          {/* Main Content Area */}
          <main className="flex-1 flex justify-center px-4 pb-6 pt-[env(safe-area-inset-top,0.25rem)]">
            <div className="w-full max-w-lg space-y-6">

              {/* VIEW BRANCHING: Dashboard (Pulse) vs Dedicated Tabs (Traffic/Events/Local/Status) */}
              {activeTab === "pulse" ? (
                /* --- DASHBOARD VIEW (HOME) --- */
                <div key="dashboard-tab" className="space-y-6">
                  {/* Top Bar: Header + Auth Action */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <Header cityName={city} isLive={!loading} />
                    </div>

                    <div className="flex-shrink-0">
                      {!sessionUser ? (
                        <button
                          onClick={() => setShowAuthModal(true)}
                          className="text-[10px] px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                          Sign in
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setActiveTab("status")}
                            className="flex items-center gap-1.5 active:scale-95 transition-all"
                          >
                            <XPProgressBadge
                              level={userLevel}
                              xp={userXp}
                              weeklyRank={userRank}
                            />
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400/70 max-w-[80px] sm:max-w-[120px] truncate">
                              {displayName}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Clear everything first, THEN attempt sign-out
                              // authBridge.signOut() can hang on web — don't let it block logout
                              localStorage.clear();
                              sessionStorage.clear();
                              authBridge.signOut().catch(() => {});
                              window.location.href = "/?signed_out=1";
                            }}
                            className="p-2 text-slate-500 hover:text-red-400 transition-colors active:scale-90"
                            title="Sign out"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* City selector */}
                  <div className="relative z-50">
                    <div className="group relative">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <svg
                          className="w-4 h-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <input
                        ref={cityInputRef}
                        type="text"
                        className="w-full h-14 bg-slate-900/80 border border-white/5 rounded-2xl pl-12 pr-4 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all"
                        placeholder="Switch city or neighborhood..."
                        value={cityInput}
                        onChange={handleCityInputChange}
                        onKeyDown={handleCityInputKeyDown}
                      />
                      {citySuggestionsLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                          Searching...
                        </span>
                      )}

                      {renderCitySuggestionsMenu && (
                        <>
                          <div
                            aria-hidden="true"
                            className={`fixed inset-0 z-40 transition-opacity duration-150 ${cityDropdownOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                            onClick={() => {
                              setShowCitySuggestions(false);
                              clearSuggestions();
                            }}
                          />

                          <div
                            ref={cityDropdownRef}
                            className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl max-h-64 overflow-y-auto transform transition duration-150 origin-top ${cityDropdownOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-1 scale-[0.98] pointer-events-none"}`}
                          >
                            {citySuggestions.map((suggestion, idx) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => handleCitySelect(suggestion)}
                                className={`w-full px-4 py-3 text-left text-sm transition border-b border-slate-800 last:border-b-0 ${highlightedIndex === idx ? "bg-slate-800 text-emerald-200" : "text-slate-100"}`}
                              >
                                {suggestion.displayName}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Current Vibe Card */}
                  <CurrentVibeCard
                    weather={weather}
                    weatherLoading={weatherLoading}
                    recentPulseCount={recentPulseCount2h}
                    onDropPulse={handleDropPulseJump}
                    cityMood={cityMood}
                    cityMoodLoading={cityMoodLoading}
                    gasPrice={null}
                    gasStationName={null}
                    onGasPriceClick={() => {
                      setActiveTab("local");
                    }}
                  />

                  {/* Quick Stats */}
                  <QuickStats
                    trafficLevel={trafficLevel}
                    trafficLoading={trafficLoading}
                    eventsCount={ticketmasterEvents.length}
                    eventsLoading={ticketmasterLoading}
                    cityMood={cityMood}
                    cityMoodLoading={cityMoodLoading}
                    onTrafficClick={() => setActiveTab("traffic")}
                    onEventsClick={() => setActiveTab("events")}
                    onMoodClick={() => {
                      if (!sessionUser) {
                        setShowAuthModal(true);
                      } else {
                        setShowPulseModal(true);
                      }
                    }}
                  />

                  {/* Onboarding Checklist for new users */}
                  {sessionUser && !onboardingCompleted && !checklistDismissed && (
                    <OnboardingChecklist
                      onboardingCompleted={onboardingCompleted}
                      onDismiss={() => setChecklistDismissed(true)}
                      steps={[
                        {
                          id: "location",
                          label: "Setup Location",
                          description: "Hyperlocal content depends on it.",
                          completed: !!selectedCity,
                          actionLabel: "Set Location",
                          action: () => cityInputRef.current?.focus(),
                        },
                        {
                          id: "profile",
                          label: "Craft your Identity",
                          description: "Describe your vibe for a custom name.",
                          completed: !!profile?.name_locked,
                          actionLabel: "Edit Name",
                          action: () => setShowUsernameEditor(true),
                        },
                        {
                          id: "pulse",
                          label: "Post your first Pulse",
                          description: "Let the community know what's up.",
                          completed: userPulseCount > 0,
                          actionLabel: "Post Pulse",
                          action: () => setShowPulseModal(true),
                        },
                        {
                          id: "bookmark",
                          label: "Bookmark a Vibe",
                          description: "Keep track of interesting updates.",
                          completed: favoritePulseIds.length > 0,
                          actionLabel: "Browse",
                          action: () => setActiveTab("pulse"),
                        }
                      ]}
                    />
                  )}

                  {/* Secondary Bottom Navigation (Tab Chips) */}
                  <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} secondaryOnly />

                  {/* AI Summary Stories */}
                  <AISummaryStories
                    activeTab={activeTab}
                    summary={summary}
                    summaryLoading={summaryLoading}
                    summaryError={summaryError}
                    pulsesCount={visiblePulses.length}
                    cityName={city}
                    events={ticketmasterEvents}
                    eventsLoading={ticketmasterLoading}
                    eventsError={ticketmasterError}
                    trafficLevel={trafficLevel}
                    trafficLoading={trafficLoading}
                    trafficError={trafficError}
                    onNavigateTab={setActiveTab}
                    vibeHeadline={cityMood?.vibeHeadline}
                    vibeEmoji={cityMood?.dominantMood ?? undefined}
                    temperature={weather?.temp}
                  />

                  {/* Traffic Flash Alert Banner */}
                  {(hasRoadClosure || (trafficIncidents && trafficIncidents.some(i => i.severity >= 3))) && (
                    <div
                      onClick={() => setActiveTab("traffic")}
                      className="mb-4 glass-card border border-red-500/30 bg-red-500/10 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-red-500/20 transition-all animate-pulse"
                    >
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">🚨</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Traffic Alert</h4>
                        <p className="text-sm font-bold text-white truncate">
                          {(() => {
                            const closure = trafficIncidents?.find(i => i.type === "closure");
                            if (closure?.roadName) return `${closure.roadName}: ${closure.description || "Closed"}`;
                            if (hasRoadClosure) return "Road closures nearby";
                            const severe = trafficIncidents?.find(i => i.severity >= 3);
                            if (severe?.roadName) return `${severe.roadName}: ${severe.description || "Major incident"}`;
                            return "Major incidents detected";
                          })()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Pulse Input & Feed (Main Home Content) */}
                  <div className="space-y-4 pt-4">
                    <div id="drop-a-pulse">
                      <PulseInput
                        ref={pulseTextareaRef}
                        mood={mood}
                        tag={tag}
                        message={message}
                        displayName={displayName}
                        isSignedIn={authStatus !== "signed_out"}
                        identityReady={identityReady}
                        loading={loading}
                        moodValidationError={moodValidationError}
                        tagValidationError={tagValidationError}
                        messageValidationError={validationError}
                        showValidationErrors={showValidationErrors}
                        onMoodChange={(m) => {
                          setMood(m);
                          setMoodValidationError(null);
                        }}
                        onTagChange={(t) => {
                          setTag(t);
                          setTagValidationError(null);
                        }}
                        onMessageChange={(m) => {
                          setMessage(m);
                          setValidationError(null);
                        }}
                        onSubmit={handleAddPulse}
                        onSignInClick={() => setShowAuthModal(true)}
                        weather={weather}
                        cityName={city}
                      />
                    </div>

                    {/* Filter chips */}
                    <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                      {TAGS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTagFilter(t)}
                          className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${tagFilter === t
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]"
                            : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Pulse List */}
                    <div className="space-y-3 pb-20">
                      {/* Happening Now Banner */}
                      {happeningNowPulse && tagFilter === "All" && (
                        <div className="mb-4">
                          <PulseCard
                            pulse={happeningNowPulse}
                            isOwnPulse={sessionUser?.id === happeningNowPulse.user_id}
                            isFavorite={favoritePulseIds.includes(happeningNowPulse.id)}
                            onToggleFavorite={handleToggleFavorite}
                            onDelete={handleDeletePulse}
                            reporterId={sessionUser?.id}
                            userIdentifier={sessionUser ? displayName : undefined}
                            authorRank={happeningNowPulse.user_id ? authorStats[happeningNowPulse.user_id]?.rank : null}
                            authorLevel={happeningNowPulse.user_id ? authorStats[happeningNowPulse.user_id]?.level : undefined}
                          />
                        </div>
                      )}

                      {/* Debug overlay removed — feed fix confirmed working */}

                      {(loading || !initialPulsesFetched) && pulses.length === 0 ? (
                        <div className="bg-slate-800/40 border border-dashed border-slate-700/50 rounded-2xl p-10 text-center">
                          <p className="text-sm font-bold text-slate-400">Loading the local vibe for {city}...</p>
                        </div>
                      ) : filteredPulses.length === 0 ? (
                        <div className="bg-slate-800/40 border border-dashed border-slate-700/50 rounded-2xl p-10 text-center space-y-3">
                          <p className="text-lg">📝</p>
                          <p className="text-sm font-bold text-slate-300">Be the first to share what&apos;s happening in {city}!</p>
                          <p className="text-xs text-slate-500">Your neighbors are waiting to hear from you</p>
                          <button
                            type="button"
                            onClick={() => setShowPulseModal(true)}
                            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
                          >
                            Share a Pulse
                          </button>
                        </div>
                      ) : (
                        <>
                          {inRadiusPulses
                            .filter((pulse) => !happeningNowPulse || pulse.id !== happeningNowPulse.id)
                            .flatMap((pulse, idx) => {
                              const card = (
                                <PulseCard
                                  key={pulse.id}
                                  pulse={pulse}
                                  isOwnPulse={sessionUser?.id === pulse.user_id}
                                  isFavorite={favoritePulseIds.includes(pulse.id)}
                                  onToggleFavorite={handleToggleFavorite}
                                  onDelete={handleDeletePulse}
                                  reporterId={sessionUser?.id}
                                  userIdentifier={sessionUser ? displayName : undefined}
                                  authorRank={pulse.user_id ? authorStats[pulse.user_id]?.rank : null}
                                  authorLevel={pulse.user_id ? authorStats[pulse.user_id]?.level : undefined}
                                />
                              );
                              if (idx > 0 && idx % 5 === 4) {
                                return [
                                  card,
                                  <button
                                    key={`cta-${idx}`}
                                    type="button"
                                    onClick={() => setShowPulseModal(true)}
                                    className="w-full bg-slate-800/30 border border-dashed border-slate-700/40 rounded-xl py-3 px-4 text-center transition hover:border-emerald-500/40 hover:bg-slate-800/50"
                                  >
                                    <span className="text-xs text-slate-400">What&apos;s happening near you? <span className="text-emerald-400 font-semibold">Share a pulse →</span></span>
                                  </button>,
                                ];
                              }
                              return [card];
                            })}

                          {/* Out-of-radius Content */}
                          {outOfRadiusPulses.length > 0 && (
                            <div className="relative py-4">
                              <div className="absolute inset-0 flex items-center px-4"><div className="w-full border-t border-dashed border-amber-500/20" /></div>
                              <div className="relative flex justify-center">
                                <span className="bg-slate-950 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-500/80 border border-amber-500/20 rounded-full">Beyond 10 Miles</span>
                              </div>
                            </div>
                          )}

                          {outOfRadiusPulses.map((pulse) => (
                            <PulseCard
                              key={pulse.id}
                              pulse={pulse}
                              isOwnPulse={sessionUser?.id === pulse.user_id}
                              isFavorite={favoritePulseIds.includes(pulse.id)}
                              onToggleFavorite={handleToggleFavorite}
                              onDelete={handleDeletePulse}
                              reporterId={sessionUser?.id}
                              userIdentifier={sessionUser ? displayName : undefined}
                              authorRank={pulse.user_id ? authorStats[pulse.user_id]?.rank : null}
                              authorLevel={pulse.user_id ? authorStats[pulse.user_id]?.level : undefined}
                            />
                          ))}

                          {hasMorePulses && tagFilter === "All" && (
                            <button
                              onClick={handleLoadMorePulses}
                              className="w-full py-3 rounded-xl bg-white/5 text-slate-400 hover:text-white text-xs font-bold transition-all"
                            >
                              {loadingMore ? "Loading more..." : "Show older pulses"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* --- DEDICATED TAB VIEW (Traffic/Events/Local/Status) --- */
                <div key="dedicated-tab" className="space-y-6 min-h-[70vh]">
                  {/* Compact Navigation Header */}
                  <div className="flex items-center justify-between px-2 pt-2 pb-4">
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tighter leading-none flex items-center gap-2">
                        {city}
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase text-[9px] font-black tracking-widest border border-emerald-500/20">
                          {activeTab}
                        </span>
                      </h2>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Hyperlocal Intelligence Active</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("pulse")}
                      className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90"
                      aria-label="Back to dashboard"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Tab Specific Rendering */}
                  {activeTab === "events" && (
                    <EventCard
                      events={ticketmasterEvents}
                      isLoading={ticketmasterLoading}
                      error={ticketmasterError}
                      hasLocation={!!(selectedCity?.lat && selectedCity?.lon)}
                      fallback={ticketmasterFallback}
                      cityName={city}
                      state={selectedCity?.state}
                      lat={selectedCity?.lat}
                      lon={selectedCity?.lon}
                      isSignedIn={authStatus !== "signed_out"}
                      identityReady={identityReady}
                      displayName={displayName}
                      pulseLoading={loading}
                      pulseMood={eventsMood}
                      pulseMessage={eventsMessage}
                      moodValidationError={tabMoodValidationError}
                      messageValidationError={tabMessageValidationError}
                      showValidationErrors={showTabValidationErrors}
                      onMoodChange={(m) => { setEventsMood(m); setTabMoodValidationError(null); }}
                      onMessageChange={(m) => { setEventsMessage(m); setTabMessageValidationError(null); }}
                      onSubmit={handleEventsPulseSubmit}
                      onSignInClick={() => setShowAuthModal(true)}
                    />
                  )}

                  {activeTab === "traffic" && (
                    <TrafficContent
                      trafficLevel={trafficLevel}
                      trafficLoading={trafficLoading}
                      trafficError={trafficError}
                      trafficPulses={trafficPulses}
                      cityName={city}
                      trafficIncidents={trafficIncidents}
                      hasRoadClosure={hasRoadClosure}
                      isSignedIn={authStatus !== "signed_out"}
                      identityReady={identityReady}
                      displayName={displayName}
                      pulseLoading={loading}
                      pulseMood={trafficMood}
                      pulseMessage={trafficMessage}
                      moodValidationError={tabMoodValidationError}
                      messageValidationError={tabMessageValidationError}
                      showValidationErrors={showTabValidationErrors}
                      onMoodChange={(m) => { setTrafficMood(m); setTabMoodValidationError(null); }}
                      onMessageChange={(m) => { setTrafficMessage(m); setTabMessageValidationError(null); }}
                      onSubmit={handleTrafficPulseSubmit}
                      onSignInClick={() => setShowAuthModal(true)}
                    />
                  )}

                  {activeTab === "local" && (
                    <LocalTab
                      cityName={city}
                      state={localState}
                      lat={localLat}
                      lon={localLon}
                      userId={sessionUser?.id ?? null}
                      onSignInClick={() => setShowAuthModal(true)}
                      isSignedIn={authStatus !== "signed_out"}
                      identityReady={identityReady}
                      displayName={displayName}
                      pulseLoading={loading}
                      pulseMood={localMood}
                      pulseMessage={localMessage}
                      moodValidationError={tabMoodValidationError}
                      messageValidationError={tabMessageValidationError}
                      showValidationErrors={showTabValidationErrors}
                      onMoodChange={(m) => { setLocalMood(m); setTabMoodValidationError(null); }}
                      onMessageChange={(m) => { setLocalMessage(m); setTabMessageValidationError(null); }}
                      onSubmit={handleLocalPulseSubmit}
                    />
                  )}

                  {activeTab === "status" && (
                    <StatusTab
                      userId={sessionUser?.id ?? null}
                      city={city}
                      onSignOut={() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        authBridge.signOut().catch(() => {});
                        window.location.href = "/?signed_out=1";
                      }}
                    />
                  )}
                </div>
              )}

              {errorMsg && activeTab === "pulse" && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              {/* Compact Footer */}
              <footer className="py-4 pb-32 text-center mt-6">
                <p className="text-[10px] text-slate-600 flex justify-center gap-3">
                  <a href="/terms" className="text-slate-500 hover:text-emerald-400 transition">Terms</a>
                  <span>•</span>
                  <a href="/privacy" className="text-slate-500 hover:text-emerald-400 transition">Privacy</a>
                  <span>•</span>
                  <a href="/legal" className="text-slate-500 hover:text-emerald-400 transition">Legal &amp; Attributions</a>
                </p>
              </footer>
            </div>
          </main>
        </PullToRefresh>

        {/* Bottom Navigation */}
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onPostPulse={() => {
            if (!sessionUser) {
              setShowAuthModal(true);
            } else {
              setShowPulseModal(true);
            }
          }}
        />

        {/* PWA Install Prompt */}
        <InstallPrompt />
      </div>
    </>
  );
}
// Deployed: 2026-02-06T19:09:47Z
