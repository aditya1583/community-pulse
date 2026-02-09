"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { authBridge } from "@/lib/authBridge";

/** Load profile via server-side endpoint (works in WKWebView) or Supabase JS fallback */
async function loadProfileServerSide(accessToken: string): Promise<{ anon_name: string; name_locked: boolean } | null> {
  try {
    const res = await fetch(getApiUrl("/api/auth/profile"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.profile) {
      return { anon_name: data.profile.anon_name, name_locked: data.profile.name_locked ?? false };
    }
    return null;
  } catch {
    return null;
  }
}

async function createProfileServerSide(accessToken: string, anonName: string): Promise<{ anon_name: string; name_locked: boolean } | null> {
  try {
    const res = await fetch(getApiUrl("/api/auth/profile"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ anon_name: anonName }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.profile) {
      return { anon_name: data.profile.anon_name, name_locked: data.profile.name_locked ?? false };
    }
    return null;
  } catch {
    return null;
  }
}
import { useGeocodingAutocomplete } from "@/hooks/useGeocodingAutocomplete";
import { useEvents } from "@/hooks/useEvents";
import type { GeocodedCity } from "@/lib/geocoding";
import {
  isInRecentWindow,
  readOnboardingCompleted,
  resetComposerAfterSuccessfulPost,
  shouldShowFirstPulseOnboarding,
  startOfRecentWindow,
  startOfNextLocalDay,
  writeOnboardingCompleted,
  filterVisiblePulses,
  isPulseVisible,
  hasShownFirstPulseModalThisSession,
  markFirstPulseModalShown,
  type AuthStatus,
} from "@/lib/pulses";
import { moderateContent } from "@/lib/moderation";
import { generateUniqueUsername } from "@/lib/username";

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
import FAB from "@/components/FAB";
import PulseModal from "@/components/PulseModal";
import TrafficContent from "@/components/TrafficContent";
import LiveVibes from "@/components/LiveVibes";
import { DASHBOARD_TABS, type TabId, type WeatherInfo, type Pulse, type CityMood, type TrafficLevel, type LocalSection } from "@/components/types";
import { useGamification } from "@/hooks/useGamification";
import XPProgressBadge from "@/components/XPProgressBadge";
import { useGeolocation } from "@/hooks/useGeolocation";
import LocationPrompt from "@/components/LocationPrompt";
import { calculateDistanceMiles } from "@/lib/geo/distance";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import InstallPrompt from "@/components/InstallPrompt";
import PullToRefresh from "@/components/PullToRefresh";
import { getApiUrl } from "@/lib/api-config";

// Real-time Live Updates
type DBPulse = {
  id: number;
  city: string;
  neighborhood?: string | null;
  mood: string;
  tag: string;
  message: string;
  author: string;
  created_at: string;
  user_id?: string;
  expires_at?: string | null;
  is_bot?: boolean;
  hidden?: boolean;
  poll_options?: string[] | null;
  lat?: number | null;
  lon?: number | null;
};

// Pagination constants
const PULSES_PAGE_SIZE = 50;

function mapDBPulseToPulse(row: DBPulse): Pulse {
  return {
    id: row.id,
    city: row.city,
    neighborhood: row.neighborhood ?? null,
    mood: row.mood,
    tag: row.tag,
    message: row.message,
    author: row.author,
    createdAt: row.created_at,
    user_id: row.user_id,
    expiresAt: row.expires_at ?? null,
    is_bot: row.is_bot ?? false,
    poll_options: row.poll_options ?? null,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
  };
}

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

// GLOBAL POSTING STREAK
type StreakInfo = {
  currentStreak: number;
  lastActiveDate: string | null;
};

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

type Profile = {
  anon_name: string;
  name_locked?: boolean | null;
};

const TAB_ID_SET = new Set<TabId>(DASHBOARD_TABS.map((tab) => tab.id));

function isTabId(value: unknown): value is TabId {
  return typeof value === "string" && TAB_ID_SET.has(value as TabId);
}

// Hardcoded fallback gas stations for Central Texas when API fails
const FALLBACK_GAS_STATIONS: Record<string, { name: string; distanceMiles: number }> = {
  "leander": { name: "H-E-B Fuel", distanceMiles: 0.8 },
  "cedar park": { name: "H-E-B Fuel", distanceMiles: 1.2 },
  "austin": { name: "H-E-B Fuel", distanceMiles: 0.5 },
};

export default function Home() {
  // Core state - initialize with defaults to avoid SSR hydration mismatch
  // localStorage restoration happens in useEffect after hydration
  const [city, setCity] = useState(DEFAULT_CITY.displayName);
  const [selectedCity, setSelectedCity] = useState<GeocodedCity | null>(DEFAULT_CITY);
  const [lastValidCity, setLastValidCity] = useState<GeocodedCity>(DEFAULT_CITY);
  const [tagFilter, setTagFilter] = useState("All");
  const [username, setUsername] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mood, setMood] = useState("");
  const [tag, setTag] = useState("General");
  const [message, setMessage] = useState("");

  // Tab-specific pulse input state (Traffic, Events, Local tabs each have their own input)
  const [trafficMood, setTrafficMood] = useState("");
  const [trafficMessage, setTrafficMessage] = useState("");
  const [eventsMood, setEventsMood] = useState("");
  const [eventsMessage, setEventsMessage] = useState("");
  const [localMood, setLocalMood] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  // Tab-specific validation (reuse existing error state but with separate show flags)
  const [tabMoodValidationError, setTabMoodValidationError] = useState<string | null>(null);
  const [tabMessageValidationError, setTabMessageValidationError] = useState<string | null>(null);
  const [showTabValidationErrors, setShowTabValidationErrors] = useState(false);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  // Track whether initial pulse fetch has completed (prevents "No pulses" flash)
  const [initialPulsesFetched, setInitialPulsesFetched] = useState(false);
  // Author stats for displaying level/rank on pulse cards
  const [authorStats, setAuthorStats] = useState<Record<string, { level: number; rank: number | null }>>({});

  // Tab state for new Neon theme
  // Persist tab state in sessionStorage so it survives navigation to venue pages
  const [activeTab, setActiveTabState] = useState<TabId>("pulse");
  const [localSection, setLocalSection] = useState<LocalSection>("deals");

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

  // Restore tab and local section from sessionStorage on mount
  useEffect(() => {
    try {
      const savedTab = sessionStorage.getItem("cp-active-tab");
      if (savedTab && isTabId(savedTab)) {
        setActiveTabState(savedTab);
      }
      // Also restore local section if navigating to local tab
      const savedLocalSection = sessionStorage.getItem("cp-local-section");
      if (savedLocalSection && ["deals", "gas", "markets", "heatmap"].includes(savedLocalSection)) {
        setLocalSection(savedLocalSection as LocalSection);
        // Clear it after reading so it doesn't persist unexpectedly
        sessionStorage.removeItem("cp-local-section");
      }
    } catch {
      // Ignore storage errors
    }
  }, []);
  const [showPulseModal, setShowPulseModal] = useState(false);

  // Auth + anon profile
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [profileLoading, setProfileLoading] = useState(false);

  // User gamification stats (level, XP, tier)
  const {
    level: userLevel,
    xp: userXp,
    weeklyRank: userRank,
    loading: gamificationLoading,
  } = useGamification(sessionUser?.id ?? null);

  // Geolocation - true hyperlocal experience
  const geolocation = useGeolocation();
  // Initialize with false to avoid hydration mismatch - restored in useEffect
  const [useManualLocation, setUseManualLocation] = useState(false);
  // Track if we've restored state from storage (prevents geolocation race)
  const [storageRestored, setStorageRestored] = useState(false);
  // Ref to ensure storage restoration only happens once (survives re-renders and StrictMode)
  const storageRestorationAttempted = useRef(false);

  // USER STREAK
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [, setStreakLoading] = useState(false);
  const [userPulseCount, setUserPulseCount] = useState(0);
  const [pulseCountResolved, setPulseCountResolved] = useState(false);

  // Saved Favorites
  const [favoritePulseIds, setFavoritePulseIds] = useState<FavoritePulseId[]>(
    []
  );
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // AI username generator / persona switcher
  const [usernamePrompt, setUsernamePrompt] = useState("");
  const [usernameGenerating, setUsernameGenerating] = useState(false);
  const [usernameErrorMsg, setUsernameErrorMsg] = useState<string | null>(null);
  const [showUsernameEditor, setShowUsernameEditor] = useState(false);
  const [lastAnonName, setLastAnonName] = useState<string | null>(null);

  // First-time user onboarding
  const [showFirstPulseModal, setShowFirstPulseModal] = useState(false);
  const [showFirstPulseBadgeToast, setShowFirstPulseBadgeToast] = useState(false);
  const [hasShownOnboarding, setHasShownOnboarding] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Form validation errors for mood and tag
  const [moodValidationError, setMoodValidationError] = useState<string | null>(null);
  const [tagValidationError, setTagValidationError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(false);

  // Auth form state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pull-to-refresh trigger
  // refreshTrigger removed — pull-to-refresh now directly awaits fetchPulses

  // Pagination state
  const [hasMorePulses, setHasMorePulses] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
  });

  // Traffic
  const [trafficLevel, setTrafficLevel] = useState<TrafficLevel | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficIncidents, setTrafficIncidents] = useState<Array<{
    id: string;
    type: "accident" | "roadwork" | "closure" | "congestion" | "other";
    description: string;
    roadName?: string;
    delay?: number;
    severity: 1 | 2 | 3 | 4;
  }>>([]);
  const [hasRoadClosure, setHasRoadClosure] = useState(false);

  // Summary
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Weather
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // City Mood
  const [cityMood, setCityMood] = useState<CityMood | null>(null);
  const [cityMoodLoading, setCityMoodLoading] = useState(false);
  const [cityMoodError, setCityMoodError] = useState<string | null>(null);

  // Gas Prices (for quick view in Current Vibe section)
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const [nearestStation, setNearestStation] = useState<{ name: string; distanceMiles: number } | null>(null);

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

  // ========= AI SUMMARY =========
  useEffect(() => {
    // Need at least some data to generate a summary
    const hasData = pulses.length > 0 || ticketmasterEvents.length > 0;

    if (!hasData) {
      setSummary(null);
      setSummaryError(null);
      setSummaryLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setSummaryLoading(true);
        setSummaryError(null);

        // Prepare events data for the summary (deduplicated by normalized name)
        // Robust normalization: lowercase, trim, collapse whitespace, remove special chars
        const normalizeEventName = (name: string): string => {
          return name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ")           // Collapse multiple spaces
            .replace(/[^\w\s]/g, "");       // Remove special characters
        };

        const seenEventNames = new Set<string>();
        const eventsForSummary = ticketmasterEvents
          .filter((e) => {
            const normalizedName = normalizeEventName(e.name);
            if (seenEventNames.has(normalizedName)) {
              return false;
            }
            seenEventNames.add(normalizedName);
            return true;
          })
          .slice(0, 10)
          .map((e) => ({
            name: e.name,
            venue: e.venue,
            date: e.date,
            time: e.time,
          }));

        // Get weather condition if available
        const weatherCondition = weather
          ? `${weather.description}, ${Math.round(weather.temp)}F`
          : undefined;

        // Create an AbortController for the summary fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const res = await fetch(getApiUrl("/api/summary"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: city.split(',')[0].trim(),
            context: "all",
            pulses,
            events: eventsForSummary,
            trafficLevel,
            weatherCondition,
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setSummaryError(data.error || "Failed to get summary");
          setSummary(null);
          return;
        }

        setSummary(data.summary);
      } catch {
        if (!cancelled) {
          setSummaryError("Unable to summarize right now.");
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [city, pulses, ticketmasterEvents, trafficLevel, weather]);

  // ========= REAL-TIME FEED =========
  useEffect(() => {
    if (!city) return;

    const channelName = `pulses-realtime-${city.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pulses",
        },
        (payload) => {
          const row = payload.new as DBPulse;
          // Match city loosely — "Leander, Texas" should match "Leander, Texas, US"
          const cityBase = city.split(",").slice(0, 2).join(",").trim().toLowerCase();
          const rowCityBase = (row.city || "").split(",").slice(0, 2).join(",").trim().toLowerCase();
          if (!row || rowCityBase !== cityBase) return;
          if (!isInRecentWindow(row.created_at)) return;

          const pulse = mapDBPulseToPulse(row);

          setPulses((prev) => {
            const exists = prev.some((p) => String(p.id) === String(pulse.id));
            if (exists) return prev;

            return [pulse, ...prev].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pulses",
        },
        (payload) => {
          const deleted = payload.old as { id?: number };
          if (!deleted?.id) return;

          setPulses((prev) => prev.filter((p) => p.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [city, setPulses]);

  // ========= CITY MOOD =========
  // ENHANCED: Now passes ALL city context (events, traffic, weather, news)
  // so the vibe calculation reflects total city activity, not just pulses.
  useEffect(() => {
    if (!city) return;

    async function fetchCityMood() {
      try {
        setCityMoodLoading(true);
        setCityMoodError(null);

        // Build query params with full city context
        const params = new URLSearchParams();
        params.set("city", city);

        // Include events count for activity calculation
        if (ticketmasterEvents.length > 0) {
          params.set("eventsCount", String(ticketmasterEvents.length));
        }

        // Include traffic level for commute mood
        if (trafficLevel) {
          params.set("trafficLevel", trafficLevel);
        }

        // Include weather condition for environmental context
        if (weather) {
          params.set("weatherCondition", `${weather.description}, ${Math.round(weather.temp)}F`);
        }

        // MOBILE FIX: Add aggressive 5-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(getApiUrl(`/api/city-mood?${params.toString()}`), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error("Failed to fetch city mood");
        }

        const data = await res.json();
        setCityMood({
          dominantMood: data.dominantMood,
          scores: data.scores || [],
          pulseCount: data.pulseCount || 0,
          // New vibe system fields
          tagScores: data.tagScores || [],
          dominantTag: data.dominantTag || null,
          vibeHeadline: data.vibeHeadline,
          vibeSubtext: data.vibeSubtext,
          vibeEmotion: data.vibeEmotion,
          vibeIntensity: data.vibeIntensity,
        });
      } catch (err: unknown) {
        console.error("Error fetching city mood:", err);
        setCityMoodError("Unable to load city mood right now.");
        setCityMood(null);
      } finally {
        setCityMoodLoading(false);
      }
    }

    fetchCityMood();
  }, [city, pulses.length, ticketmasterEvents.length, trafficLevel, weather]);

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

  // ========= WEATHER =========
  useEffect(() => {
    if (!city.trim()) {
      setWeather(null);
      setWeatherError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);

        // MOBILE FIX: Add aggressive 5-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(getApiUrl("/api/weather"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city,
            lat: selectedCity?.lat,
            lon: selectedCity?.lon,
            country: selectedCity?.country,
            state: selectedCity?.state,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setWeather(null);
          setWeatherError(data.error || "Unable to load weather.");
          return;
        }

        setWeather(data);
      } catch {
        if (!cancelled) {
          setWeather(null);
          setWeatherError("Unable to load weather.");
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [city, selectedCity?.lat, selectedCity?.lon, selectedCity?.country, selectedCity?.state]);

  // ========= GAS PRICES (for Current Vibe card) =========
  useEffect(() => {
    const stateCode = selectedCity?.state;
    if (!stateCode) {
      setGasPrice(null);
      return;
    }

    let cancelled = false;

    const fetchGasPrice = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/gas-prices?state=${encodeURIComponent(stateCode)}`));
        const data = await res.json();

        if (cancelled) return;

        if (data.regular) {
          setGasPrice(data.regular);
        }
      } catch {
        // Silently fail - gas price is supplementary info
        if (!cancelled) setGasPrice(null);
      }
    };

    fetchGasPrice();

    return () => {
      cancelled = true;
    };
  }, [selectedCity?.state]);

  // ========= NEAREST GAS STATION (for Current Vibe card) =========
  useEffect(() => {
    const lat = selectedCity?.lat;
    const lon = selectedCity?.lon;
    const cityName = selectedCity?.name?.toLowerCase() || "";

    if (!lat || !lon) {
      console.log("[GasStation] No coordinates available, skipping fetch");
      // Try fallback based on city name
      const fallback = FALLBACK_GAS_STATIONS[cityName];
      if (fallback) {
        console.log("[GasStation] Using city-name fallback:", fallback.name);
        setNearestStation(fallback);
      } else {
        setNearestStation(null);
      }
      return;
    }

    let cancelled = false;

    const fetchNearestStation = async () => {
      console.log(`[GasStation] Fetching nearest station for coords: ${lat}, ${lon} (city: ${cityName})`);
      try {
        const res = await fetch(getApiUrl(`/api/gas-stations?lat=${lat}&lon=${lon}&limit=1`));
        const data = await res.json();

        console.log("[GasStation] API response:", data);

        if (cancelled) {
          console.log("[GasStation] Request cancelled");
          return;
        }

        if (data.stations && data.stations.length > 0) {
          const station = data.stations[0];
          console.log("[GasStation] Found station:", station.name, "at", station.distanceMiles, "mi");

          // CRITICAL: If the found station is > 3 miles away but we have a verified local fallback
          // (like HEB Plus) that is closer, prioritize the fallback for a better "hyperlocal" feel.
          const fallback = FALLBACK_GAS_STATIONS[cityName];
          if (station.distanceMiles > 3 && fallback && (fallback.distanceMiles ?? 0) < station.distanceMiles) {
            console.log("[GasStation] Dynamic station too far, using verified fallback:", fallback.name);
            setNearestStation(fallback);
          } else {
            setNearestStation({
              name: station.name,
              distanceMiles: station.distanceMiles,
            });
          }
        } else {
          console.log("[GasStation] No stations from API, trying fallback");
          // Use fallback if API returns empty
          const fallback = FALLBACK_GAS_STATIONS[cityName];
          if (fallback) {
            console.log("[GasStation] Using fallback:", fallback.name);
            setNearestStation(fallback);
          } else {
            setNearestStation(null);
          }
        }
      } catch (error) {
        console.error("[GasStation] Error fetching:", error);
        if (!cancelled) {
          // Use fallback on error
          const fallback = FALLBACK_GAS_STATIONS[cityName];
          if (fallback) {
            console.log("[GasStation] Using fallback after error:", fallback.name);
            setNearestStation(fallback);
          } else {
            setNearestStation(null);
          }
        }
      }
    };

    fetchNearestStation();

    return () => {
      cancelled = true;
    };
  }, [selectedCity?.lat, selectedCity?.lon, selectedCity?.name]);

  // ========= LOAD SESSION + PROFILE =========
  useEffect(() => {
    async function loadUser() {
      setAuthStatus("loading");
      setProfileLoading(false);

      const { data: auth } = await authBridge.getUser();
      const user = auth.user;
      setSessionUser(user);

      if (!user) {
        setProfile(null);
        setAuthStatus("signed_out");
        return;
      }

      setAuthStatus("signed_in");
      setProfileLoading(true);
      try {
        const token = await authBridge.getAccessToken();
        let profileResult = token ? await loadProfileServerSide(token) : null;

        if (profileResult) {
          setProfile(profileResult);
        } else if (token) {
          // No profile exists — create one
          const anon = await generateUniqueUsername(supabase);
          profileResult = await createProfileServerSide(token, anon);
          setProfile(profileResult || { anon_name: anon, name_locked: false });
        }
      } catch (err) {
        console.error("[Voxlo] Profile load failed:", err);
      } finally {
        setProfileLoading(false);
      }
    }

    loadUser();

    // Listen for auth state changes (session refresh, sign in/out)
    const { data: { subscription } } = authBridge.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          const user = session?.user ?? null;
          setSessionUser(user);
          if (user) {
            setAuthStatus("signed_in");
            // Load profile via server-side endpoint (works in WKWebView)
            try {
              setProfileLoading(true);
              const token = await authBridge.getAccessToken();
              let profileResult = token ? await loadProfileServerSide(token) : null;
              if (profileResult) {
                setProfile(profileResult);
              } else if (token) {
                const anon = await generateUniqueUsername(supabase);
                profileResult = await createProfileServerSide(token, anon);
                setProfile(profileResult || { anon_name: anon, name_locked: false });
              }
            } catch (err) {
              console.error("[Voxlo] Profile load in onAuthStateChange failed:", err);
            } finally {
              setProfileLoading(false);
            }
          }
        } else if (event === "SIGNED_OUT") {
          setSessionUser(null);
          setProfile(null);
          setAuthStatus("signed_out");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for sign-in modal requests from child components (e.g., PollVoting)
  useEffect(() => {
    const handleShowSignIn = () => {
      setShowAuthModal(true);
    };

    window.addEventListener("showSignInModal", handleShowSignIn);
    return () => {
      window.removeEventListener("showSignInModal", handleShowSignIn);
    };
  }, []);

  // Identity is ready when signed in with a profile, OR if profile loading is taking too long
  // This prevents the "WAIT..." button from getting stuck forever
  const identityReady =
    authStatus === "signed_in" && !!sessionUser && !profileLoading && !!profile;
  
  // Safety timeout: if profileLoading is stuck for >5 seconds, force it to complete
  useEffect(() => {
    if (profileLoading && authStatus === "signed_in" && sessionUser) {
      const timeout = setTimeout(() => {
        console.warn("[Voxlo] Profile loading timeout - forcing ready state");
        setProfileLoading(false);
        if (!profile) {
          // Use a fallback profile so user can post
          setProfile({
            anon_name: `User${sessionUser.id.slice(0, 6)}`,
            name_locked: false,
          });
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [profileLoading, authStatus, sessionUser, profile]);

  useEffect(() => {
    const userId = sessionUser?.id;

    setShowFirstPulseModal(false);
    setHasShownOnboarding(false);
    setPulseCountResolved(false);

    if (!userId) {
      setOnboardingCompleted(false);
      return;
    }

    setOnboardingCompleted(readOnboardingCompleted(window.localStorage, userId));
  }, [sessionUser?.id]);

  // USER STREAK
  const loadStreak = useCallback(async () => {
    const userId = sessionUser?.id;

    if (!userId) {
      setStreakInfo(null);
      setUserPulseCount(0);
      setStreakLoading(false);
      setPulseCountResolved(false);
      return;
    }

    try {
      setStreakLoading(true);
      setPulseCountResolved(false);

      const { data, error, count } = await supabase
        .from("pulses")
        .select("created_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(365);

      if (error) {
        console.error("Error loading streak data:", error);
        return;
      }

      const rows = data || [];
      const nextCount = count ?? rows.length;
      setUserPulseCount(nextCount);
      setPulseCountResolved(true);

      if (nextCount > 0 && !onboardingCompleted) {
        writeOnboardingCompleted(window.localStorage, userId);
        setOnboardingCompleted(true);
      }

      if (rows.length === 0) {
        setStreakInfo({ currentStreak: 0, lastActiveDate: null });
        return;
      }

      const dateStrings = Array.from(
        new Set(
          rows.map((row: { created_at: string }) => {
            const d = new Date(row.created_at);
            return d.toLocaleDateString("en-CA");
          })
        )
      ).sort((a, b) => (a < b ? 1 : -1));

      const today = new Date();
      const todayStr = today.toLocaleDateString("en-CA");

      let streak = 0;
      let offsetDays = 0;

      function offsetDate(days: number) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toLocaleDateString("en-CA");
      }

      for (const dayStr of dateStrings) {
        const expected = offsetDate(offsetDays);

        if (dayStr === expected) {
          streak += 1;
          offsetDays += 1;
        } else {
          if (streak === 0 && dayStr === offsetDate(1) && todayStr !== dayStr) {
            streak = 1;
            offsetDays = 2;
          } else {
            break;
          }
        }
      }

      const lastActive = dateStrings[0] ?? null;

      setStreakInfo({
        currentStreak: streak,
        lastActiveDate: lastActive,
      });
    } catch (err) {
      console.error("Unexpected error loading streak:", err);
    } finally {
      setStreakLoading(false);
    }
  }, [sessionUser, onboardingCompleted]);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

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

  // ========= PULSES FETCH =========
  // FIXED: Extracted fetchPulses to component level so pull-to-refresh can await it directly.
  // Previously it was defined inside useEffect, causing a hang when Supabase took >800ms.
  const fetchPulses = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    // IMPORTANT: Don't clear pulses here - let the loading state show instead
    // This prevents the "No pulses" flash before data arrives
    setHasMorePulses(false);

    console.log("[Pulses] fetchPulses called for city:", city);

    try {
      // Use server-side API endpoint instead of Supabase JS client
      // The JS client hangs in Capacitor WKWebView
      const userLat = selectedCity?.lat;
      const userLon = selectedCity?.lon;
      const params = new URLSearchParams();
      if (userLat != null && userLon != null) {
        params.set("lat", String(userLat));
        params.set("lon", String(userLon));
      }
      params.set("city", city);
      params.set("limit", String(PULSES_PAGE_SIZE + 1));

      const apiUrl = `${getApiUrl("/api/pulses/feed")}?${params}`;
      console.log(`[Pulses] Fetching via API: ${apiUrl}`);
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `API error ${res.status}`);
      }

      const result = await res.json();
      const rawData: DBPulse[] = result.pulses || [];
      console.log(`[Pulses] API returned ${rawData.length} pulses`);

      let data: DBPulse[] | null = rawData;
      let error: { message: string } | null = null;

      if (error) {
        console.error("[Pulses] Error fetching pulses:", error.message);
        setErrorMsg("Could not load pulses. Try again in a bit.");
        setPulses([]);
      } else if (data) {
        console.log(`[Pulses] Fetched ${data.length} pulses from DB for "${city}"`);

        // Debug: log expiry info for first few pulses
        if (data.length > 0) {
          const now = new Date();
          data.slice(0, 3).forEach((p, i) => {
            const expiresAt = p.expires_at ? new Date(p.expires_at) : null;
            const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() - 60 * 60 * 1000 : false;
            console.log(`[Pulses] #${i + 1}: tag=${p.tag}, created=${p.created_at}, expires=${p.expires_at}, expired=${isExpired}`);
          });
        }

        const hasMore = data.length > PULSES_PAGE_SIZE;
        setHasMorePulses(hasMore);

        const pageData = hasMore ? data.slice(0, PULSES_PAGE_SIZE) : data;

        const mapped: Pulse[] = (pageData as DBPulse[]).map((row) => ({
          ...mapDBPulseToPulse(row),
          author: row.author || "Anonymous",
        }));
        setPulses(mapped);
      } else {
        console.log(`[Pulses] No data returned for "${city}" (data is null/undefined)`);
        // Explicit empty case
        setPulses([]);
      }
    } catch (fetchErr) {
      console.error("[Pulses] fetchPulses CAUGHT ERROR:", fetchErr);
      setErrorMsg(fetchErr instanceof Error ? fetchErr.message : "Unknown fetch error");
      setPulses([]);
    } finally {
      setLoading(false);
      setInitialPulsesFetched(true);
    }
  }, [city, selectedCity?.lat, selectedCity?.lon, supabase]);

  // Initial load + auto-refresh interval
  useEffect(() => {
    // Reset the flag when city changes to indicate we need to fetch again
    setInitialPulsesFetched(false);

    if (city) {
      fetchPulses();

      // Auto-refresh every 2 minutes to catch new bot posts and remove expired ones
      // This ensures users don't need to manually refresh to see new content
      const refreshInterval = setInterval(() => {
        console.log("[Pulses] Auto-refreshing feed...");
        fetchPulses();
      }, 2 * 60 * 1000); // 2 minutes

      return () => clearInterval(refreshInterval);
    }
  }, [city, fetchPulses]);

  // ========= PULL-TO-REFRESH HANDLER =========
  const handlePullToRefresh = useCallback(async () => {
    console.log("[PullToRefresh] Triggered manual refresh");
    await fetchPulses();
  }, [fetchPulses]);

  // ========= AUTO-SEED AND REFRESH STALE CITIES =========
  // When a city has no pulses OR content is stale, automatically generate fresh bot posts
  // This keeps the app feeling alive with continuous content generation
  const [autoSeedAttempted, setAutoSeedAttempted] = useState<string | null>(null);
  const [staleRefreshAttempted, setStaleRefreshAttempted] = useState<string | null>(null);

  // Constants for stale content detection
  const STALE_PULSE_THRESHOLD = 5; // Trigger refresh if fewer than this many pulses
  const STALE_AGE_HOURS = 1; // Trigger refresh if newest pulse is older than this

  const isSeedingRef = useRef(false);

  useEffect(() => {
    const triggerAutoSeed = async () => {
      // Use visible pulses for logic to ensure we don't count hidden/expired content
      // This ensures that if we have 50 old posts that are all hidden, we still trigger a refresh
      const validPulses = filterVisiblePulses(pulses);

      // Determine if this is a cold start (empty) or stale content situation
      // UPDATED: Treat < 5 pulses as "empty" to trigger auto-seed top-up
      const isEmpty = validPulses.length < 5;
      const isStale = !isEmpty && (
        validPulses.length < STALE_PULSE_THRESHOLD ||
        (validPulses.length > 0 && isContentStale(validPulses))
      );

      if (isSeedingRef.current) {
        console.log("[Content Refresh] Skipping - seeding already in progress");
        return;
      }

      // Check if content is stale (oldest non-expired pulse is too old)
      function isContentStale(pulsesToCheck: Pulse[]): boolean {
        if (pulsesToCheck.length === 0) return false;

        // Find the newest pulse
        const newestPulse = pulsesToCheck.reduce((newest, p) => {
          const pTime = new Date(p.createdAt).getTime();
          const newestTime = new Date(newest.createdAt).getTime();
          return pTime > newestTime ? p : newest;
        }, pulsesToCheck[0]);

        const newestAge = Date.now() - new Date(newestPulse.createdAt).getTime();
        const staleAgeMs = STALE_AGE_HOURS * 60 * 60 * 1000;

        return newestAge > staleAgeMs;
      }

      // Debug logging
      console.log("[Content Refresh] Checking conditions:", {
        city,
        initialPulsesFetched,
        totalPulses: pulses.length,
        visiblePulses: validPulses.length,
        isEmpty,
        isStale,
        autoSeedAttempted,
        staleRefreshAttempted,
        loading,
        ticketmasterLoading,
      });

      // Skip if no action needed
      if (!isEmpty && !isStale) {
        console.log("[Content Refresh] Skipping - city has fresh content");
        return;
      }

      // 1. Initial fetch must be complete
      if (!initialPulsesFetched) {
        console.log("[Content Refresh] Skipping - initial fetch not complete");
        return;
      }

      // 2. Check if we've already attempted for this city
      if (isEmpty && autoSeedAttempted === city) {
        console.log("[Content Refresh] Skipping - already attempted empty seed for this city");
        return;
      }
      if (isStale && staleRefreshAttempted === city) {
        console.log("[Content Refresh] Skipping - already attempted stale refresh for this city");
        return;
      }

      // 3. Not currently loading
      if (loading) {
        console.log("[Content Refresh] Skipping - still loading pulses");
        return;
      }

      // Wait for events AND weather to finish loading
      // This prevents using stale data from a previous city
      if (ticketmasterLoading) {
        console.log("[Content Refresh] Skipping - waiting for events to load");
        return;
      }
      if (weatherLoading) {
        console.log("[Content Refresh] Skipping - waiting for weather to load");
        return;
      }

      // CRITICAL: Verify weather data matches current city to prevent stale data
      // This catches the race condition when switching cities quickly
      const cityNamePart = city.split(",")[0].toLowerCase().trim();
      const weatherMatchesCity = weather?.cityName?.toLowerCase().includes(cityNamePart);

      if (weather && !weatherMatchesCity) {
        console.log("[Content Refresh] Skipping - weather data is stale (from different city)", {
          weatherCity: weather.cityName,
          currentCity: city,
        });
        return;
      }

      const refreshType = isEmpty ? "cold-start" : "stale-refresh";
      console.log(`[Content Refresh] Triggering ${refreshType} for:`, city);

      try {
        isSeedingRef.current = true;
        console.log(`[Content Refresh] ${refreshType} for ${city}...`);

        // For stale refresh, use the cron refresh endpoint; for cold-start, use auto-seed
        const endpoint = isEmpty ? "/api/auto-seed" : "/api/cron/refresh-content";
        const requestBody = isEmpty
          ? {
            city,
            // CRITICAL: Pass coordinates for universal intelligent bot support
            // This enables contextual polls, farmers markets, and weather-based
            // content for ANY city, not just pre-configured Texas cities
            lat: selectedCity?.lat,
            lon: selectedCity?.lon,
            events: ticketmasterEvents.slice(0, 3).map((e) => ({
              name: e.name,
              venue: e.venue,
              date: e.date,
              category: e.category,
            })),
            // Only include weather if it matches the current city
            weather: weather && weatherMatchesCity
              ? {
                description: weather.description,
                temp: weather.temp,
                icon: weather.icon,
              }
              : null,
          }
          : {
            city,
            force: false, // Let server decide if refresh is needed
          };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = await res.json();
        console.log(`[Content Refresh] ${refreshType} API Response:`, res.status, data);

        if (!res.ok) {
          console.error(`[Content Refresh] ${refreshType} API Error:`, data);
          // Don't mark as attempted so we can retry
          return;
        }

        // Mark as attempted only after successful API call
        if (isEmpty) {
          setAutoSeedAttempted(city);
        } else {
          setStaleRefreshAttempted(city);
        }

        // Handle postsCreated (from refresh endpoint) or created (from auto-seed)
        const postsCreated = data.postsCreated ?? data.created ?? 0;

        if (postsCreated === 0) {
          // Server reported no new posts created (e.g., city already has recent pulses)
          console.log(`[Content Refresh] Skipped - ${data.message || "city may already have recent pulses"}`);
        } else if (postsCreated > 0) {
          console.log(`[Content Refresh] SUCCESS! Created ${postsCreated} posts for ${city} (${refreshType})`);
          // Trigger main refresh to pick up new posts (uses coordinate-based query)
          // Re-fetch pulses to pick up newly seeded content
          await fetchPulses();
        }
      } catch (err) {
        console.error("[Content Refresh] Error:", err);
      } finally {
        isSeedingRef.current = false;
      }
    };

    triggerAutoSeed();
    // Note: We intentionally use pulses.length instead of pulses to avoid infinite loops
    // The stale check inside uses pulses directly but only runs when conditions are met
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, initialPulsesFetched, pulses.length, ticketmasterEvents, ticketmasterLoading, weather, weatherLoading, autoSeedAttempted, staleRefreshAttempted, loading, selectedCity?.lat, selectedCity?.lon]);

  // ========= FETCH AUTHOR STATS =========
  // Batch fetch level and rank for all unique authors when pulses change
  useEffect(() => {
    const fetchAuthorStats = async () => {
      // Get unique user IDs from pulses
      const userIds = [
        ...new Set(
          pulses
            .map((p) => p.user_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (userIds.length === 0) {
        setAuthorStats({});
        return;
      }

      try {
        const res = await fetch(
          `/api/gamification/batch-stats?userIds=${userIds.join(",")}`
        );
        if (res.ok) {
          const data = await res.json();
          setAuthorStats(data.stats || {});
        }
      } catch (err) {
        console.error("[fetchAuthorStats] Error:", err);
      }
    };

    if (pulses.length > 0) {
      fetchAuthorStats();
    }
  }, [pulses]);

  // ========= LOAD MORE PULSES =========
  const handleLoadMorePulses = async () => {
    if (loadingMore || !hasMorePulses || pulses.length === 0) return;

    setLoadingMore(true);

    const now = new Date();
    const start = startOfRecentWindow(now, 7);
    const loadMoreExpiryGrace = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const oldestPulse = pulses[pulses.length - 1];
    const cursor = oldestPulse.createdAt;

    try {
      // Use same column selection as initial fetch (with poll_options and lat/lon)
      let data: DBPulse[] | null = null;
      let error: { message: string } | null = null;

      const queryWithPolls = await supabase
        .from("pulses")
        .select("id, city, neighborhood, mood, tag, message, author, created_at, user_id, expires_at, is_bot, poll_options, lat, lon")
        .eq("city", city)
        .gte("created_at", start.toISOString())
        .lt("created_at", cursor)
        .or(`expires_at.is.null,expires_at.gt.${loadMoreExpiryGrace}`)
        .order("created_at", { ascending: false })
        .limit(PULSES_PAGE_SIZE + 1);

      if (queryWithPolls.error?.message?.includes("poll_options")) {
        const fallbackQuery = await supabase
          .from("pulses")
          .select("id, city, neighborhood, mood, tag, message, author, created_at, user_id, expires_at, is_bot, lat, lon")
          .eq("city", city)
          .gte("created_at", start.toISOString())
          .lt("created_at", cursor)
          .or(`expires_at.is.null,expires_at.gt.${loadMoreExpiryGrace}`)
          .order("created_at", { ascending: false })
          .limit(PULSES_PAGE_SIZE + 1);
        data = (fallbackQuery.data as DBPulse[]) ?? null;
        error = fallbackQuery.error;
      } else {
        data = (queryWithPolls.data as DBPulse[]) ?? null;
        error = queryWithPolls.error;
      }

      if (error) {
        console.error("Error loading more pulses:", error.message);
      } else if (data) {
        const hasMore = data.length > PULSES_PAGE_SIZE;
        setHasMorePulses(hasMore);

        const pageData = hasMore ? data.slice(0, PULSES_PAGE_SIZE) : data;

        const mapped: Pulse[] = (pageData as DBPulse[]).map((row) => ({
          ...mapDBPulseToPulse(row),
          author: row.author || "Anonymous",
        }));

        setPulses((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPulses = mapped.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newPulses];
        });
      }
    } catch (err) {
      console.error("Unexpected error loading more pulses:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ========= TRAFFIC =========
  useEffect(() => {
    if (!city) return;

    const fetchTraffic = async () => {
      try {
        setTrafficLoading(true);
        setTrafficError(null);

        // Fetch both AI-based traffic level AND live TomTom incidents in parallel
        // MOBILE FIX: Add aggressive 6-second timeout for mobile reliability
        const trafficUrl = getApiUrl(`/api/traffic?city=${encodeURIComponent(city)}`);
        const liveUrl = selectedCity?.lat && selectedCity?.lon
          ? getApiUrl(`/api/traffic-live?lat=${selectedCity.lat}&lon=${selectedCity.lon}`)
          : getApiUrl(`/api/traffic-live?city=${encodeURIComponent(city)}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const [trafficRes, liveRes] = await Promise.allSettled([
          fetch(trafficUrl, { signal: controller.signal }),
          fetch(liveUrl, { signal: controller.signal }),
        ]);

        clearTimeout(timeoutId);

        // Process AI-based traffic level
        let hasAiLevel = false;
        if (trafficRes.status === "fulfilled" && trafficRes.value.ok) {
          try {
            const data = await trafficRes.value.json();
            if (data?.level) {
              setTrafficLevel(data.level);
              setTrafficError(null);
              hasAiLevel = true;
            }
          } catch {
            // ignore JSON parse error
          }
        }

        // Process live TomTom incidents
        if (liveRes.status === "fulfilled" && liveRes.value.ok) {
          try {
            const liveData = await liveRes.value.json();
            if (liveData?.incidents) {
              setTrafficIncidents(liveData.incidents);
            }
            if (liveData?.hasRoadClosure !== undefined) {
              setHasRoadClosure(liveData.hasRoadClosure);
            }
            // Use TomTom level when AI-based level is unavailable
            if (!hasAiLevel && liveData?.level) {
              setTrafficLevel(liveData.level);
              setTrafficError(null);
            }
          } catch {
            // ignore JSON parse error for live data
          }
        }

        // If neither source provided a level, show error
        if (!hasAiLevel && trafficRes.status !== "fulfilled") {
          setTrafficError("Unable to load traffic right now.");
          setTrafficLevel(null);
        }
      } catch (err: unknown) {
        console.error("Error fetching traffic:", err);
        setTrafficError("Unable to load traffic right now.");
        setTrafficLevel(null);
      } finally {
        setTrafficLoading(false);
      }
    };

    fetchTraffic();
  }, [city, pulses.length, selectedCity?.lat, selectedCity?.lon]);

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

  async function handleLockUsername() {
    if (!sessionUser || !profile) return;

    try {
      setUsernameGenerating(true);
      setUsernameErrorMsg(null);

      const { error } = await supabase
        .from("profiles")
        .update({ name_locked: true })
        .eq("id", sessionUser.id);

      if (error) {
        console.error("Error locking username:", error);
        setUsernameErrorMsg("Could not lock name right now. Try again.");
        return;
      }

      setProfile((prev) =>
        prev ? { ...prev, name_locked: true } : prev
      );
    } catch (err) {
      console.error("Unexpected error locking username:", err);
      setUsernameErrorMsg("Could not lock name right now.");
    } finally {
      setUsernameGenerating(false);
    }
  }

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
      const { error } = await supabase
        .from("pulses")
        .delete()
        .eq("id", pulseId)
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting pulse:", error);
        setErrorMsg("Could not delete pulse. Please try again.");
        return;
      }

      setPulses((prev) => prev.filter((p) => p.id !== pulseId));
      setUserPulseCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Unexpected error deleting pulse:", err);
      setErrorMsg("Could not delete pulse. Please try again.");
    }
  }

  // ========= PASSWORD VALIDATION =========
  function validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < 8) {
      return { valid: false, error: "Password must be at least 8 characters" };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, error: "Password must contain at least one lowercase letter" };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: "Password must contain at least one uppercase letter" };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, error: "Password must contain at least one number" };
    }

    return { valid: true };
  }

  // ========= AUTH HANDLER =========
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();

    const email = authEmail.trim();
    const password = authPassword.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);

      if (authMode === "signup") {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          setAuthError(passwordValidation.error || "Password does not meet requirements.");
          setAuthLoading(false);
          return;
        }

        if (password !== authPasswordConfirm) {
          setAuthError("Passwords do not match.");
          setAuthLoading(false);
          return;
        }

        const { data: signUpData, error: signUpError } = await authBridge.signUp({
          email,
          password,
        });

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes("already registered") ||
            signUpError.message.toLowerCase().includes("already exists") ||
            signUpError.message.toLowerCase().includes("user already")) {
            setAuthError("This email is already registered. Please check your email for a confirmation link, or try signing in.");
            return;
          }
          setAuthError(signUpError.message || "Could not create account. Please try again.");
          return;
        }

        if (signUpData.user) {
          if (!signUpData.session) {
            setAuthError("Account created! Please check your email to confirm your account before signing in.");
            setAuthEmail("");
            setAuthPassword("");
            setAuthPasswordConfirm("");
            setAuthStatus("signed_out");
            return;
          }

          setSessionUser(signUpData.user);
          setAuthStatus("signed_in");
          setProfileLoading(true);

          try {
            const token = await authBridge.getAccessToken();
            let profileResult = token ? await loadProfileServerSide(token) : null;
            if (profileResult) {
              setProfile(profileResult);
            } else if (token) {
              const anon = await generateUniqueUsername(supabase);
              profileResult = await createProfileServerSide(token, anon);
              setProfile(profileResult || { anon_name: anon, name_locked: false });
            }
          } finally {
            setProfileLoading(false);
          }

          setAuthEmail("");
          setAuthPassword("");
          setAuthPasswordConfirm("");
          setShowAuthModal(false);
        }
      } else {
        const { data: signInData, error: signInError } = await authBridge.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setAuthError(signInError.message || "Invalid email or password.");
          return;
        }

        if (signInData.user) {
          setSessionUser(signInData.user);
          setAuthStatus("signed_in");
          setProfileLoading(true);

          try {
            const token = await authBridge.getAccessToken();
            let profileResult = token ? await loadProfileServerSide(token) : null;
            if (profileResult) {
              setProfile(profileResult);
            } else if (token) {
              const anon = await generateUniqueUsername(supabase);
              profileResult = await createProfileServerSide(token, anon);
              setProfile(profileResult || { anon_name: anon, name_locked: false });
            }
          } finally {
            setProfileLoading(false);
          }

          setAuthEmail("");
          setAuthPassword("");
          setAuthPasswordConfirm("");
          setShowAuthModal(false);
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      console.error("Auth error:", err);
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();

    const email = authEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      setAuthError("Please enter your email address.");
      return;
    }

    if (!emailRegex.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);
      setAuthSuccess(null);

      const { error } = await authBridge.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setAuthError(error.message || "Could not send reset email. Please try again.");
        return;
      }

      setAuthSuccess("Check your email for a password reset link.");
      setAuthEmail("");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      console.error("Forgot password error:", err);
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  // ========= AI USERNAME GENERATOR HANDLERS =========
  async function handleGenerateUsername() {
    const prompt = usernamePrompt.trim();
    if (!sessionUser) return;

    if (profile?.name_locked) {
      setUsernameErrorMsg("Your anonymous name is locked and can't be changed.");
      return;
    }

    const wordCount = prompt.split(/\s+/).filter(Boolean).length;
    if (wordCount < 3) {
      setUsernameErrorMsg("Use at least 3 words to describe your vibe.");
      return;
    }

    try {
      setUsernameGenerating(true);
      setUsernameErrorMsg(null);

      const res = await fetch(getApiUrl("/api/username"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok || !data.username) {
        throw new Error(data.error || "Could not generate username.");
      }

      const newName: string = data.username;

      setLastAnonName(profile?.anon_name || username || null);

      const updatedProfileName = newName;

      setProfile((prev) =>
        prev
          ? { ...prev, anon_name: updatedProfileName }
          : { anon_name: updatedProfileName }
      );
      setUsername(updatedProfileName);

      const userId = sessionUser.id;
      const { error } = await supabase
        .from("profiles")
        .update({ anon_name: updatedProfileName })
        .eq("id", userId);

      if (error) {
        console.error("Error updating profile anon_name:", error);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to generate a name right now.";
      console.error("Error generating username:", err);
      setUsernameErrorMsg(message);
    } finally {
      setUsernameGenerating(false);
    }
  }

  async function handleRevertUsername() {
    if (!sessionUser || !lastAnonName) return;

    try {
      setUsernameGenerating(true);
      setUsernameErrorMsg(null);

      setProfile((prev) =>
        prev ? { ...prev, anon_name: lastAnonName } : { anon_name: lastAnonName }
      );
      setUsername(lastAnonName);

      const { error } = await supabase
        .from("profiles")
        .update({ anon_name: lastAnonName })
        .eq("id", sessionUser.id);

      if (error) {
        console.error("Error reverting anon_name:", error);
      } else {
        setLastAnonName(null);
      }
    } catch (err) {
      console.error("Error reverting username:", err);
      setUsernameErrorMsg("Unable to revert name right now.");
    } finally {
      setUsernameGenerating(false);
    }
  }

  // ========= FILTER AND SORT PULSES BY DISTANCE =========
  // 1. Filter expired pulses (client-side safety net)
  // 2. Calculate distance from user's location
  // 3. Sort by distance: in-radius (< 10mi) first, then out-of-radius
  // 4. Apply tag filter

  const visiblePulses = filterVisiblePulses(pulses);

  // Debug: log filtering results
  if (pulses.length > 0 && visiblePulses.length !== pulses.length) {
    console.log(`[Pulses] filterVisiblePulses: ${pulses.length} → ${visiblePulses.length} (${pulses.length - visiblePulses.length} expired)`);
  }

  const afterRecentFilter = visiblePulses.filter((p) => isInRecentWindow(p.createdAt));
  if (visiblePulses.length > 0 && afterRecentFilter.length !== visiblePulses.length) {
    console.log(`[Pulses] isInRecentWindow filter: ${visiblePulses.length} → ${afterRecentFilter.length}`);
  }

  // Calculate distance for each pulse and sort by proximity
  const pulsesWithDistance = useMemo(() => {
    // Use geolocation if available, otherwise use selected city coordinates
    const userLat = geolocation.lat ?? selectedCity?.lat ?? null;
    const userLon = geolocation.lon ?? selectedCity?.lon ?? null;

    if (!userLat || !userLon) {
      // No location available - return pulses with null distance, sorted by time
      return afterRecentFilter.map((p) => ({ ...p, distanceMiles: null }));
    }

    // Calculate distance for each pulse
    const withDistance = afterRecentFilter.map((pulse) => {
      // Use pulse's stored coordinates if available
      const pulseLat = pulse.lat ?? null;
      const pulseLon = pulse.lon ?? null;

      let distanceMiles: number | null = null;

      if (pulseLat !== null && pulseLon !== null) {
        distanceMiles = calculateDistanceMiles(
          { lat: userLat, lon: userLon },
          { lat: pulseLat, lon: pulseLon }
        );
      }

      return { ...pulse, distanceMiles };
    });

    // Sort: in-radius first (by distance), then out-of-radius (by distance)
    // Within each group, maintain time-based order for same-distance pulses
    return withDistance.sort((a, b) => {
      const distA = a.distanceMiles;
      const distB = b.distanceMiles;
      const radiusMiles = RADIUS_CONFIG.PRIMARY_RADIUS_MILES;

      // Handle null distances - push to end
      if (distA === null && distB === null) return 0;
      if (distA === null) return 1;
      if (distB === null) return -1;

      // Categorize: in-radius vs out-of-radius
      const aInRadius = distA <= radiusMiles;
      const bInRadius = distB <= radiusMiles;

      // In-radius pulses come first
      if (aInRadius && !bInRadius) return -1;
      if (!aInRadius && bInRadius) return 1;

      // Within same category, sort by distance (closest first)
      return distA - distB;
    });
  }, [afterRecentFilter, geolocation.lat, geolocation.lon, selectedCity?.lat, selectedCity?.lon]);

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

  // ========= ADD PULSE =========
  const handleAddPulse = async () => {
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

    // Mood is now mandatory
    if (!mood) {
      setMoodValidationError("Please select a vibe");
      hasErrors = true;
    } else {
      setMoodValidationError(null);
    }

    // Tag/Category defaults to General if not selected
    if (!tag) {
      setTag(resolvedTag);
    }
    setTagValidationError(null);

    // Message is required (matches server validation)
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

    const authorName = profile.anon_name || username || "Anonymous";

    try {
      // Get a fresh access token via authBridge (works on both web and Capacitor)
      const accessToken = await authBridge.getAccessToken();

      if (!accessToken) {
        setErrorMsg("Sign in to post.");
        setShowAuthModal(true);
        return;
      }

      const res = await fetch(getApiUrl("/api/pulses"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          city,
          mood,
          tag: resolvedTag,
          message: trimmed,
          author: authorName,
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
        const message =
          data?.error || "Could not post your pulse. Please try again.";

        if (data?.code === "MODERATION_FAILED") {
          setValidationError(message);
          setShowValidationErrors(true);
          return;
        }

        if (res.status === 401) {
          setErrorMsg("Sign in to post.");
          setShowAuthModal(true);
          return;
        }

        setErrorMsg(message);
        return;
      }

      // Optimistically insert the created pulse into local state so the author sees it immediately,
      // even if realtime delivery is delayed or the websocket reconnects.
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

      // Close the pulse modal after successful post
      setShowPulseModal(false);

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
      console.error("Unexpected error creating pulse:", err);
      setErrorMsg("Could not post your pulse. Please try again.");
      return;
    }
  };

  const displayName = profile?.anon_name || username || "...";
  const currentStreak = streakInfo?.currentStreak ?? 0;

  // ========= TAB-SPECIFIC PULSE HANDLERS =========
  // These handle posting from the in-tab inputs (Traffic, Events, Local)
  type TabCategory = "Traffic" | "Events" | "General";

  const handleTabPulseSubmit = async (
    tabCategory: TabCategory,
    tabMood: string,
    tabMessage: string,
    setTabMood: (m: string) => void,
    setTabMessage: (m: string) => void
  ) => {
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

    // Mood is mandatory
    if (!tabMood) {
      setTabMoodValidationError("Please select a vibe");
      hasErrors = true;
    } else {
      setTabMoodValidationError(null);
    }

    // Message is required
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
      // Get a fresh access token via authBridge (works on both web and Capacitor)
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
        const message =
          data?.error || "Could not post your pulse. Please try again.";

        if (data?.code === "MODERATION_FAILED") {
          setTabMessageValidationError(message);
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

        setErrorMsg(message);
        setLoading(false);
        return;
      }

      // Optimistically insert the created pulse
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

      // Reset the tab-specific form
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
      console.error("Unexpected error creating tab pulse:", err);
      setErrorMsg("Could not post your pulse. Please try again.");
      setLoading(false);
    }
  };

  // Specific handlers for each tab
  const handleTrafficPulseSubmit = () => {
    handleTabPulseSubmit("Traffic", trafficMood, trafficMessage, setTrafficMood, setTrafficMessage);
  };

  const handleEventsPulseSubmit = () => {
    handleTabPulseSubmit("Events", eventsMood, eventsMessage, setEventsMood, setEventsMessage);
  };

  const handleLocalPulseSubmit = () => {
    handleTabPulseSubmit("General", localMood, localMessage, setLocalMood, setLocalMessage);
  };

  const recentPulseCount2h = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    return pulses.reduce((count, pulse) => {
      const createdAtMs = new Date(pulse.createdAt).getTime();
      if (Number.isNaN(createdAtMs)) return count;
      return createdAtMs >= cutoff ? count + 1 : count;
    }, 0);
  }, [pulses]);

  const localState = selectedCity?.state ?? lastValidCity.state ?? "";
  const localLat = selectedCity?.lat ?? lastValidCity.lat;
  const localLon = selectedCity?.lon ?? lastValidCity.lon;

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
      <div className="fixed inset-0 bg-[#09090b] -z-50" aria-hidden="true" />

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
          <main className="flex-1 flex justify-center px-4 py-6 pt-[max(3.5rem,calc(env(safe-area-inset-top)+0.75rem))]">
            <div className="w-full max-w-lg space-y-6">

              {/* VIEW BRANCHING: Dashboard (Pulse) vs Dedicated Tabs (Traffic/Events/Local/Status) */}
              {activeTab === "pulse" ? (
                /* --- DASHBOARD VIEW (HOME) --- */
                <div key="dashboard-tab" className="space-y-6">
                  {/* Top Bar: Header + Auth Action */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Header cityName={city} isLive={!loading} />
                    </div>

                    <div className="flex-shrink-0 pt-1">
                      {!sessionUser ? (
                        <button
                          onClick={() => setShowAuthModal(true)}
                          className="text-[10px] px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                          Sign in
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab("status")}
                          className="flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                          <XPProgressBadge
                            level={userLevel}
                            xp={userXp}
                            weeklyRank={userRank}
                          />
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400/70 max-w-[80px] truncate">
                            {displayName}
                          </span>
                        </button>
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
                    gasPrice={gasPrice}
                    gasStationName={nearestStation?.name}
                    onGasPriceClick={() => {
                      setLocalSection("gas");
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
                      className="mb-4 glass-card border border-red-500/30 bg-red-500/10 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-red-500/20 transition-all"
                    >
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">🚨</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Traffic Alert</h4>
                        <p className="text-sm font-bold text-white truncate">
                          {hasRoadClosure ? "Road closures nearby" : "Major incidents detected"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Live Vibes - Floating avatars of currently active moods */}
                  <LiveVibes city={city} onNavigateToLocal={() => {
                    setLocalSection("deals");
                    setActiveTab("local");
                  }} />

                  {/* Pulse Input & Feed (Main Home Content) */}
                  <div className="space-y-4 pt-4">
                    <div id="drop-a-pulse">
                      <PulseInput
                        ref={pulseTextareaRef}
                        mood={mood}
                        tag={tag}
                        message={message}
                        displayName={displayName}
                        isSignedIn={!!sessionUser}
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
                        <div className="bg-slate-800/40 border border-dashed border-slate-700/50 rounded-2xl p-10 text-center">
                          <p className="text-sm font-bold text-slate-400">No pulses yet for {city}. Be the first!</p>
                        </div>
                      ) : (
                        <>
                          {inRadiusPulses
                            .filter((pulse) => !happeningNowPulse || pulse.id !== happeningNowPulse.id)
                            .map((pulse) => (
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
                      isSignedIn={!!sessionUser}
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
                      isSignedIn={!!sessionUser}
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
                      section={localSection}
                      onSectionChange={setLocalSection}
                      userId={sessionUser?.id ?? null}
                      onSignInClick={() => setShowAuthModal(true)}
                      isSignedIn={!!sessionUser}
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
                      onSignOut={async () => {
                        await authBridge.signOut();
                        setSessionUser(null);
                        setProfile(null);
                        setAuthStatus("signed_out");
                      }}
                    />
                  )}
                </div>
              )}

              {errorMsg && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              {/* Disclaimer */}
              <div className="mt-8">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-center">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    <strong>Disclaimer:</strong> Voxlo displays user-submitted
                    content. Posts may be inaccurate, incomplete, or misleading. Do not
                    rely on this information for safety, travel, emergency, or
                    decision-making purposes. All posts reflect the views of individual
                    users, not the app&apos;s creators.
                  </p>
                </div>
              </div>

              {/* Attribution Footer */}
              <footer className="py-6 pb-32 text-center border-t border-slate-800 mt-6">
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-md mx-auto">
                    Voxlo aggregates real-time data from multiple sources to provide a hyperlocal experience.
                  </p>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span>Weather by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">Open-Meteo</a></span>
                    <span>•</span>
                    <span>Traffic by <a href="https://www.tomtom.com/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">TomTom</a></span>
                    <span>•</span>
                    <span>Maps & Geocoding by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">OpenStreetMap</a></span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span>Events via <a href="https://www.ticketmaster.com/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">Ticketmaster</a></span>
                    <span>•</span>
                    <span>Places by <a href="https://foursquare.com/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">Foursquare</a></span>
                    <span>•</span>
                    <span>Gas info by <a href="https://www.eia.gov/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">EIA</a></span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span>AI by <a href="https://openai.com/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">OpenAI</a> & <a href="https://www.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">Anthropic</a></span>
                    <span>•</span>
                    <span>Trust & Safety by <a href="https://perspectiveapi.com/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-400">Google Perspective</a></span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-4 flex justify-center gap-4">
                    <a href="/terms" className="text-slate-500 hover:text-emerald-400 transition">Terms of Service</a>
                    <a href="/privacy" className="text-slate-500 hover:text-emerald-400 transition">Privacy Policy</a>
                  </p>
                </div>
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
