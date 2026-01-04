"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
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
  type AuthStatus,
} from "@/lib/pulses";
import { moderateContent } from "@/lib/moderation";
import { generateUniqueUsername } from "@/lib/username";

// New Neon Theme Components
import Header from "@/components/Header";
import CurrentVibeCard from "@/components/CurrentVibeCard";
import QuickStats from "@/components/QuickStats";
import TabNavigation from "@/components/TabNavigation";
import BottomNavigation from "@/components/BottomNavigation";
import AISummaryStories from "@/components/AISummaryStories";
import NewsTab from "@/components/NewsTab";
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
import type { LocalNewsResponse } from "@/types/news";
import { useGamification } from "@/hooks/useGamification";
import XPProgressBadge from "@/components/XPProgressBadge";
import { useGeolocation } from "@/hooks/useGeolocation";
import LocationPrompt from "@/components/LocationPrompt";

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

export default function Home() {
  // Core state
  const [city, setCity] = useState(DEFAULT_CITY.displayName);
  const [selectedCity, setSelectedCity] = useState<GeocodedCity | null>(
    DEFAULT_CITY
  );
  const [lastValidCity, setLastValidCity] = useState<GeocodedCity>(
    DEFAULT_CITY
  );
  const [tagFilter, setTagFilter] = useState("All");
  const [username, setUsername] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mood, setMood] = useState("");
  const [tag, setTag] = useState("");
  const [message, setMessage] = useState("");
  const [pulses, setPulses] = useState<Pulse[]>([]);
  // Track whether initial pulse fetch has completed (prevents "No pulses" flash)
  const [initialPulsesFetched, setInitialPulsesFetched] = useState(false);
  // Author stats for displaying level/rank on pulse cards
  const [authorStats, setAuthorStats] = useState<Record<string, { level: number; rank: number | null }>>({});

  // Tab state for new Neon theme
  const [activeTab, setActiveTab] = useState<TabId>("pulse");
  const [localSection, setLocalSection] = useState<LocalSection>("deals");
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
  const [useManualLocation, setUseManualLocation] = useState(false);

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

  // Auth form state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // News
  const [newsData, setNewsData] = useState<LocalNewsResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // Gas Prices (for quick view in Current Vibe section)
  const [gasPrice, setGasPrice] = useState<number | null>(null);

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
    const hasData = pulses.length > 0 || ticketmasterEvents.length > 0 || (newsData?.articles?.length ?? 0) > 0;

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

        // Prepare news data for the summary
        const newsForSummary = (newsData?.articles ?? []).slice(0, 5).map((a) => ({
          title: a.title,
          source: a.source,
        }));

        // Get weather condition if available
        const weatherCondition = weather
          ? `${weather.description}, ${Math.round(weather.temp)}F`
          : undefined;

        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city,
            context: "all",
            pulses,
            events: eventsForSummary,
            news: newsForSummary,
            trafficLevel,
            weatherCondition,
          }),
        });

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
  }, [city, pulses, ticketmasterEvents, newsData, trafficLevel, weather]);

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
          if (!row || row.city !== city) return;
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

        // Include news count for noteworthy happenings
        if (newsData?.articles?.length) {
          params.set("newsCount", String(newsData.articles.length));
        }

        const res = await fetch(`/api/city-mood?${params.toString()}`);
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
  }, [city, pulses.length, ticketmasterEvents.length, trafficLevel, weather, newsData?.articles?.length]);

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

        const res = await fetch("/api/weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city,
            lat: selectedCity?.lat,
            lon: selectedCity?.lon,
            country: selectedCity?.country,
            state: selectedCity?.state,
          }),
        });

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
        const res = await fetch(`/api/gas-prices?state=${encodeURIComponent(stateCode)}`);
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

  // ========= LOCAL NEWS =========
  useEffect(() => {
    if (!city.trim()) {
      setNewsData(null);
      setNewsError(null);
      return;
    }

    let cancelled = false;

    const fetchNews = async () => {
      try {
        setNewsLoading(true);
        setNewsError(null);

        const res = await fetch(`/api/local-news?city=${encodeURIComponent(city)}`);
        const data: LocalNewsResponse = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setNewsError("Unable to load news.");
          setNewsData(null);
          return;
        }

        setNewsData(data);
      } catch {
        if (!cancelled) {
          setNewsError("Unable to load news.");
          setNewsData(null);
        }
      } finally {
        if (!cancelled) {
          setNewsLoading(false);
        }
      }
    };

    fetchNews();

    return () => {
      cancelled = true;
    };
  }, [city]);

  // ========= LOAD SESSION + PROFILE =========
  useEffect(() => {
    async function loadUser() {
      setAuthStatus("loading");
      setProfileLoading(false);

      const { data: auth } = await supabase.auth.getUser();
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
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setProfile({
            anon_name: profileData.anon_name,
            name_locked: profileData.name_locked ?? false,
          });
        } else {
          const anon = await generateUniqueUsername(supabase);

          await supabase.from("profiles").insert({
            id: user.id,
            anon_name: anon,
            name_locked: false,
          });

          setProfile({
            anon_name: anon,
            name_locked: false,
          });
        }
      } finally {
        setProfileLoading(false);
      }
    }

    loadUser();

    // Listen for auth state changes (session refresh, sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          setSessionUser(session?.user ?? null);
          if (session?.user) {
            setAuthStatus("signed_in");
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

  const identityReady =
    authStatus === "signed_in" && !!sessionUser && !profileLoading && !!profile;

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
  useEffect(() => {
    const show = shouldShowFirstPulseOnboarding({
      authStatus,
      identityReady,
      pulseCountResolved,
      userPulseCount,
      onboardingCompleted,
      hasShownThisSession: hasShownOnboarding,
    });

    if (show) {
      setShowFirstPulseModal(true);
      setHasShownOnboarding(true);
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

        const res = await fetch(`/api/events?city=${encodeURIComponent(city)}`);

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

  // ========= LOCAL STORAGE: CITY =========
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedCity = localStorage.getItem("cp-city");
    if (!savedCity) return;

    try {
      const parsed = JSON.parse(savedCity) as StoredCity;
      if (parsed && parsed.displayName) {
        const restoredCity: GeocodedCity = {
          id:
            parsed.id ||
            `${parsed.displayName}-${parsed.lat ?? "unknown"}-${
              parsed.lon ?? "unknown"
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

        setCity(restoredCity.displayName);
        setCityInput(restoredCity.displayName);
        if (parsed.lat && parsed.lon) {
          setSelectedCity(restoredCity);
          setLastValidCity(restoredCity);
        }
        return;
      }
    } catch {
      // Fallback to treating the saved value as a plain string
    }

    setCity(savedCity);
    setCityInput(savedCity);
    setSelectedCity(null);
  }, [setCityInput, setLastValidCity, setSelectedCity, setCity]);

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
    // Skip if user chose manual mode
    if (useManualLocation) return;
    // Skip if geolocation doesn't have data yet
    if (!geolocation.lat || !geolocation.lon || !geolocation.displayName) return;
    // Skip if still loading
    if (geolocation.loading) return;

    // Build a GeocodedCity from geolocation
    const geoCity: GeocodedCity = {
      id: `geo-${geolocation.lat}-${geolocation.lon}`,
      name: geolocation.cityName || "Near You",
      state: geolocation.stateCode || undefined,
      lat: geolocation.lat,
      lon: geolocation.lon,
      displayName: geolocation.displayName,
    };

    // Update city state with geolocation data
    // Use applySuggestionSelection to set input without triggering autocomplete search
    applySuggestionSelection(geoCity);
    setCity(geoCity.displayName);
    setSelectedCity(geoCity);
    setLastValidCity(geoCity);
  }, [
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
      }
      return;
    }

    if (e.key === "Escape") {
      setShowCitySuggestions(false);
      clearSuggestions();
    }
  }

  // ========= PULSES FETCH =========
  // FIXED: Added initialPulsesFetched flag to prevent "No pulses" flash on initial load.
  // The issue was that setPulses([]) was called before fetch completed, causing a
  // momentary display of "No pulses yet" even when pulses existed in the database.
  useEffect(() => {
    // Reset the flag when city changes to indicate we need to fetch again
    setInitialPulsesFetched(false);

    const fetchPulses = async () => {
      setLoading(true);
      setErrorMsg(null);
      // IMPORTANT: Don't clear pulses here - let the loading state show instead
      // This prevents the "No pulses" flash before data arrives
      setHasMorePulses(false);

      const now = new Date();
      const start = startOfRecentWindow(now, 7);
      const end = startOfNextLocalDay(now);

      // Explicitly select only needed fields for privacy
      // user_id is included for ownership check (is this my pulse?) - it's a UUID, not PII
      const { data, error } = await supabase
        .from("pulses")
        .select("id, city, neighborhood, mood, tag, message, author, created_at, user_id, expires_at")
        .eq("city", city)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .limit(PULSES_PAGE_SIZE + 1);

      if (error) {
        console.error("Error fetching pulses:", error.message);
        setErrorMsg("Could not load pulses. Try again in a bit.");
        setPulses([]);
      } else if (data) {
        const hasMore = data.length > PULSES_PAGE_SIZE;
        setHasMorePulses(hasMore);

        const pageData = hasMore ? data.slice(0, PULSES_PAGE_SIZE) : data;

        const mapped: Pulse[] = (pageData as DBPulse[]).map((row) => ({
          ...mapDBPulseToPulse(row),
          author: row.author || "Anonymous",
        }));
        setPulses(mapped);
      } else {
        // Explicit empty case
        setPulses([]);
      }

      setLoading(false);
      setInitialPulsesFetched(true);
    };

    if (city) {
      fetchPulses();
    }
  }, [city]);

  // ========= AUTO-SEED EMPTY CITIES =========
  // When a city has no pulses, automatically generate contextual bot posts
  const [autoSeedAttempted, setAutoSeedAttempted] = useState<string | null>(null);

  useEffect(() => {
    const triggerAutoSeed = async () => {
      // Debug logging
      console.log("[Auto-Seed Client] Checking conditions:", {
        city,
        initialPulsesFetched,
        pulsesCount: pulses.length,
        autoSeedAttempted,
        loading,
        ticketmasterLoading,
      });

      // Only auto-seed if:
      // 1. Initial fetch is complete
      if (!initialPulsesFetched) {
        console.log("[Auto-Seed Client] Skipping - initial fetch not complete");
        return;
      }
      // 2. No pulses exist
      if (pulses.length > 0) {
        console.log("[Auto-Seed Client] Skipping - city has pulses:", pulses.length);
        return;
      }
      // 3. We haven't already tried for this city
      if (autoSeedAttempted === city) {
        console.log("[Auto-Seed Client] Skipping - already attempted for this city");
        return;
      }
      // 4. Not currently loading
      if (loading) {
        console.log("[Auto-Seed Client] Skipping - still loading pulses");
        return;
      }

      // Wait for events AND weather to finish loading
      // This prevents using stale data from a previous city
      if (ticketmasterLoading) {
        console.log("[Auto-Seed Client] Skipping - waiting for events to load");
        return;
      }
      if (weatherLoading) {
        console.log("[Auto-Seed Client] Skipping - waiting for weather to load");
        return;
      }

      // CRITICAL: Verify weather data matches current city to prevent stale data
      // This catches the race condition when switching cities quickly
      const cityNamePart = city.split(",")[0].toLowerCase().trim();
      const weatherMatchesCity = weather?.cityName?.toLowerCase().includes(cityNamePart);

      if (weather && !weatherMatchesCity) {
        console.log("[Auto-Seed Client] Skipping - weather data is stale (from different city)", {
          weatherCity: weather.cityName,
          currentCity: city,
        });
        return;
      }

      // Mark that we've attempted for this city
      console.log("[Auto-Seed Client] All conditions met! Triggering seed for:", city);
      setAutoSeedAttempted(city);

      try {
        console.log(`Auto-seeding content for ${city}...`);

        const res = await fetch("/api/auto-seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city,
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
          }),
        });

        const data = await res.json();
        console.log("[Auto-Seed Client] API Response:", res.status, data);

        if (!res.ok) {
          console.error("[Auto-Seed Client] API Error:", data);
          return;
        }

        if (data.created > 0) {
          console.log(`[Auto-Seed Client] SUCCESS! Created ${data.created} seed posts for ${city}`);
          // Refetch pulses to show the new posts
            const now = new Date();
            const start = startOfRecentWindow(now, 7);
            const end = startOfNextLocalDay(now);

            const { data: newData } = await supabase
              .from("pulses")
              .select("*")
              .eq("city", city)
              .gte("created_at", start.toISOString())
              .lt("created_at", end.toISOString())
              .order("created_at", { ascending: false })
              .limit(PULSES_PAGE_SIZE);

            if (newData) {
              const mapped: Pulse[] = (newData as DBPulse[]).map((row) => ({
                ...mapDBPulseToPulse(row),
                author: row.author || "Anonymous",
              }));
              setPulses(mapped);
            }
        }
      } catch (err) {
        console.error("Auto-seed error:", err);
      }
    };

    triggerAutoSeed();
  }, [city, initialPulsesFetched, pulses.length, ticketmasterEvents, ticketmasterLoading, weather, weatherLoading, autoSeedAttempted, loading]);

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

    const oldestPulse = pulses[pulses.length - 1];
    const cursor = oldestPulse.createdAt;

    try {
      const { data, error } = await supabase
        .from("pulses")
        .select("*")
        .eq("city", city)
        .gte("created_at", start.toISOString())
        .lt("created_at", cursor)
        .order("created_at", { ascending: false })
        .limit(PULSES_PAGE_SIZE + 1);

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

        const res = await fetch(`/api/traffic?city=${encodeURIComponent(city)}`);

        let data: { level?: TrafficLevel; error?: string } | null = null;
        try {
          data = await res.json();
        } catch {
          // ignore JSON parse error
        }

        if (!res.ok || !data?.level) {
          const message =
            (data && data.error) || "Unable to load traffic right now.";
          setTrafficError(message);
          setTrafficLevel(null);
          return;
        }

        setTrafficLevel(data.level);
        setTrafficError(null);
      } catch (err: unknown) {
        console.error("Error fetching traffic:", err);
        setTrafficError("Unable to load traffic right now.");
        setTrafficLevel(null);
      } finally {
        setTrafficLoading(false);
      }
    };

    fetchTraffic();
  }, [city, pulses.length]);

  // ========= CREATE EVENT HANDLER =========
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!city || !newEventTitle || !newEventTime) return;

    try {
      setCreatingEvent(true);
      setEventCreateError(null);

      const res = await fetch("/api/events", {
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

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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
            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", signUpData.user.id)
              .single();

            if (existingProfile) {
              setProfile({
                anon_name: existingProfile.anon_name,
                name_locked: existingProfile.name_locked ?? false,
              });
            } else {
              const anon = await generateUniqueUsername(supabase);
              const { error: insertError } = await supabase.from("profiles").insert({
                id: signUpData.user.id,
                anon_name: anon,
                name_locked: false,
              });

              if (insertError) {
                console.error("Error creating profile:", insertError);
                const { data: retryProfile } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", signUpData.user.id)
                  .single();

                if (retryProfile) {
                  setProfile({
                    anon_name: retryProfile.anon_name,
                    name_locked: retryProfile.name_locked ?? false,
                  });
                }
              } else {
                setProfile({
                  anon_name: anon,
                  name_locked: false,
                });
              }
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
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
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
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", signInData.user.id)
              .single();

            if (profileData) {
              setProfile({
                anon_name: profileData.anon_name,
                name_locked: profileData.name_locked ?? false,
              });
            } else {
              const anon = await generateUniqueUsername(supabase);
              const { error: insertError } = await supabase.from("profiles").insert({
                id: signInData.user.id,
                anon_name: anon,
                name_locked: false,
              });

              if (insertError) {
                console.error("Error creating profile on sign in:", insertError);
                const { data: retryProfile } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", signInData.user.id)
                  .single();

                if (retryProfile) {
                  setProfile({
                    anon_name: retryProfile.anon_name,
                    name_locked: retryProfile.name_locked ?? false,
                  });
                }
              } else {
                setProfile({
                  anon_name: anon,
                  name_locked: false,
                });
              }
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

      const res = await fetch("/api/username", {
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

  // ========= FILTER PULSES =========
  // Client-side expiry filtering as a safety net
  // This ensures expired pulses are hidden even if they weren't filtered server-side
  const visiblePulses = filterVisiblePulses(pulses);

  const filteredPulses = visiblePulses
    .filter((p) => isInRecentWindow(p.createdAt))
    .filter((p) => tagFilter === "All" || p.tag === tagFilter);

  // Traffic-tagged pulses for traffic tab (also filter expired)
  const trafficPulses = visiblePulses.filter((p) => p.tag === "Traffic");

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
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        setErrorMsg("Sign in to post.");
        setShowAuthModal(true);
        return;
      }

      const res = await fetch("/api/pulses", {
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

  const recentPulseCount2h = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    return pulses.reduce((count, pulse) => {
      const createdAtMs = new Date(pulse.createdAt).getTime();
      if (Number.isNaN(createdAtMs)) return count;
      return createdAtMs >= cutoff ? count + 1 : count;
    }, 0);
  }, [pulses]);

  const safeActiveTab: TabId = isTabId(activeTab) ? activeTab : "pulse";
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

  // If we need location prompt, show it instead of main app
  if (showLocationPrompt) {
    return (
      <LocationPrompt
        onRequestLocation={async () => {
          const success = await geolocation.requestLocation();
          return success;
        }}
        onUseManual={() => setUseManualLocation(true)}
        loading={geolocation.loading}
        error={geolocation.error}
      />
    );
  }

  return (
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                    setAuthPasswordConfirm("");
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    authMode === "signin"
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
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    authMode === "signup"
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-800/60 text-slate-400 hover:text-white"
                  }`}
                >
                  Create Account
                </button>
              </div>
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthError(null);
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

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
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
              </div>

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

              <button
                type="submit"
                disabled={authLoading}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-medium text-sm rounded-lg shadow-lg shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {authLoading ? "Please wait..." : authMode === "signup" ? "Create Account" : "Sign In"}
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                {authMode === "signup"
                  ? "We'll assign you a fun anonymous username after you create your account."
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

      <main className="flex-1 flex justify-center px-4 py-4">
        <div className="w-full max-w-lg space-y-4 stagger-reveal">
          {/* Auth/User bar */}
          {!sessionUser ? (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-medium shadow-lg shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500 transition"
              >
                Sign in
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end text-sm text-slate-400 gap-2">
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-2">
                  {/* XP Progress Badge - tap to view Status tab */}
                  {!gamificationLoading && userLevel > 0 && (
                    <XPProgressBadge
                      level={userLevel}
                      xp={userXp}
                      weeklyRank={userRank}
                      onClick={() => setActiveTab("status")}
                    />
                  )}
                  <span className="text-cyan-400">{displayName}</span>

                  {!profile?.name_locked ? (
                    <button
                      type="button"
                      onClick={() => setShowUsernameEditor((prev) => !prev)}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition"
                    >
                      Edit vibe name
                    </button>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                  )}
                </div>

                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setSessionUser(null);
                    setProfile(null);
                    setAuthStatus("signed_out");
                    setProfileLoading(false);
                  }}
                  className="text-[11px] text-slate-500 hover:text-emerald-300 underline-offset-2 hover:underline"
                >
                  Log out
                </button>
              </div>
            </div>
          )}

          {/* Username editor */}
          {sessionUser && showUsernameEditor && !profile?.name_locked && (
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-4 py-3 text-xs text-slate-200">
              <p className="text-[11px] text-slate-300 mb-2">
                Describe your vibe in <span className="font-semibold">3+ words</span>, and we&apos;ll craft a fun anonymous name for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  value={usernamePrompt}
                  onChange={(e) => setUsernamePrompt(e.target.value)}
                  placeholder="e.g. sleepy sarcastic overcaffeinated"
                  className="flex-1 rounded-lg bg-slate-900/70 border border-slate-700/50 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent"
                />
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={handleGenerateUsername}
                    disabled={
                      usernameGenerating ||
                      profile?.name_locked ||
                      usernamePrompt.trim().split(/\s+/).filter(Boolean).length < 3
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-medium text-[11px] rounded-lg shadow-lg shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <span>{usernameGenerating ? "Rolling..." : "Roll"}</span>
                  </button>
                  {lastAnonName && lastAnonName !== displayName && !profile?.name_locked && (
                    <button
                      type="button"
                      onClick={handleRevertUsername}
                      className="text-[11px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
                    >
                      Undo
                    </button>
                  )}
                  {!profile?.name_locked && (
                    <button
                      type="button"
                      onClick={handleLockUsername}
                      className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/25 transition"
                    >
                      Lock this name
                    </button>
                  )}
                </div>
              </div>
              {usernameErrorMsg && (
                <p className="mt-1 text-[11px] text-red-400">{usernameErrorMsg}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Current name: <span className="text-cyan-400">{displayName}</span>
              </p>
            </div>
          )}

          {/* City selector */}
          <div className="relative z-50">
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">
              City
            </label>
            <div className="relative">
              <input
                ref={cityInputRef}
                value={cityInput}
                onChange={handleCityInputChange}
                onKeyDown={handleCityInputKeyDown}
                onFocus={() =>
                  cityInput.trim().length >= 3 && setShowCitySuggestions(true)
                }
                className="w-full rounded-lg bg-slate-800/60 border border-slate-700/50 px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent"
                placeholder="Search any city (e.g., Austin, TX)"
              />
              {citySuggestionsLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                  Searching...
                </span>
              )}

              {renderCitySuggestionsMenu && (
                <>
                  {/* Backdrop: click-outside-to-close + ensures correct z-index stacking */}
                  <div
                    aria-hidden="true"
                    className={`fixed inset-0 z-40 transition-opacity duration-150 ${
                      cityDropdownOpen
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                    }`}
                    onClick={() => {
                      setShowCitySuggestions(false);
                      clearSuggestions();
                    }}
                  />

                  <div
                    ref={cityDropdownRef}
                    className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl max-h-64 overflow-y-auto transform transition duration-150 origin-top motion-reduce:transition-none ${
                      cityDropdownOpen
                        ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                        : "opacity-0 -translate-y-1 scale-[0.98] pointer-events-none"
                    }`}
                    role="listbox"
                    aria-label="City suggestions"
                    aria-hidden={!cityDropdownOpen}
                  >
                    {citySuggestions.map((suggestion, idx) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        tabIndex={cityDropdownOpen ? 0 : -1}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleCitySelect(suggestion)}
                        className={`w-full px-4 py-3 text-left text-sm transition flex items-center justify-between border-b border-slate-800 last:border-b-0 ${
                          highlightedIndex === idx
                            ? "bg-slate-800 text-emerald-200"
                            : "hover:bg-slate-800 text-slate-100"
                        }`}
                        role="option"
                        aria-selected={highlightedIndex === idx}
                      >
                        <span className="truncate">{suggestion.displayName}</span>
                        <span className="text-[10px] text-slate-400">
                          {suggestion.country || ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {citySuggestionsNotFound && !citySuggestionsLoading && (
                <p className="mt-1 text-[11px] text-amber-300">
                  We couldn&apos;t find that city. Try &quot;City, Country&quot; format.
                </p>
              )}
              {citySuggestionsError && (
                <p className="mt-1 text-[11px] text-red-400">
                  {citySuggestionsError} Keeping {lastValidCity.displayName}.
                </p>
              )}
            </div>
          </div>

          {/* Header */}
          <Header cityName={city} isLive={!loading} />

          {/* Current Vibe Card */}
          <CurrentVibeCard
            weather={weather}
            weatherLoading={weatherLoading}
            recentPulseCount={recentPulseCount2h}
            onDropPulse={handleDropPulseJump}
            cityMood={cityMood}
            cityMoodLoading={cityMoodLoading}
            gasPrice={gasPrice}
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
              setActiveTab("pulse");
              window.setTimeout(() => {
                document
                  .getElementById("mood-selector")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 100);
            }}
          />

          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} secondaryOnly />

          {/* AI Summary Stories - Swipeable quick brief */}
          <AISummaryStories
            activeTab={activeTab}
            summary={summary}
            summaryLoading={summaryLoading}
            summaryError={summaryError}
            pulsesCount={pulses.length}
            cityName={city}
            events={ticketmasterEvents}
            eventsLoading={ticketmasterLoading}
            eventsError={ticketmasterError}
            trafficLevel={trafficLevel}
            trafficLoading={trafficLoading}
            trafficError={trafficError}
            newsSummary={newsData?.aiSummary}
            newsLoading={newsLoading}
            newsError={newsError}
            newsCount={newsData?.articles?.length ?? 0}
            onNavigateTab={setActiveTab}
            vibeHeadline={cityMood?.vibeHeadline}
            vibeEmoji={cityMood?.dominantMood ?? undefined}
            temperature={weather?.temp}
          />

          {/* Live Vibes - Real-time crowd-sourced venue sentiment */}
          <LiveVibes city={city} onNavigateToLocal={() => {
            setLocalSection("deals");
            setActiveTab("local");
          }} />

          {/* Tab Content */}
          <div className="space-y-4">
            {(() => {
              switch (safeActiveTab) {
                case "events":
                  return (
                    <EventCard
                      events={ticketmasterEvents}
                      isLoading={ticketmasterLoading}
                      error={ticketmasterError}
                      hasLocation={!!(selectedCity?.lat && selectedCity?.lon)}
                      fallback={ticketmasterFallback}
                    />
                  );
                case "traffic":
                  return (
                    <TrafficContent
                      trafficLevel={trafficLevel}
                      trafficLoading={trafficLoading}
                      trafficError={trafficError}
                      trafficPulses={trafficPulses}
                      cityName={city}
                    />
                  );
                case "news":
                  return (
                    <NewsTab
                      city={city}
                      data={newsData}
                      loading={newsLoading}
                      error={newsError}
                    />
                  );
                case "local":
                  return (
                    <LocalTab
                      cityName={city}
                      state={localState}
                      lat={localLat}
                      lon={localLon}
                      section={localSection}
                      onSectionChange={setLocalSection}
                      userId={sessionUser?.id ?? null}
                      onSignInClick={() => setShowAuthModal(true)}
                    />
                  );
                case "status":
                  return (
                    <StatusTab
                      userId={sessionUser?.id ?? null}
                      city={city}
                    />
                  );
                case "pulse":
                default:
                  return (
                    <>
                      {/* Pulse Input */}
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

                      {errorMsg && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                          {errorMsg}
                        </p>
                      )}

                      {/* Filter chips */}
                      <div className="flex flex-wrap gap-2">
                        {TAGS.map((t) => (
                          <button
                            key={t}
                            onClick={() => setTagFilter(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                              tagFilter === t
                                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow shadow-emerald-500/40"
                                : "bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {/* Pulses list */}
                      {/* FIXED: Show loading state until initial fetch completes to prevent
                          the "No pulses yet" flash that was causing user confusion */}
                      <section className="space-y-3 pb-12">
                        {(loading || !initialPulsesFetched) && pulses.length === 0 ? (
                          <div className="bg-slate-800/60 border border-dashed border-slate-700/50 rounded-xl px-4 py-10 text-center text-sm text-slate-400">
                            Loading pulses for{" "}
                            <span className="font-semibold text-white">
                              {city}
                            </span>
                            ...
                          </div>
                        ) : filteredPulses.length === 0 ? (
                          <div className="bg-slate-800/60 border border-dashed border-slate-700/50 rounded-xl px-4 py-10 text-center text-sm text-slate-400">
                            No pulses yet for{" "}
                            <span className="font-semibold text-white">
                              {city}
                            </span>
                            . Be the first to set the vibe.
                          </div>
                        ) : (
                          <>
                            {filteredPulses.map((pulse) => (
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

                            {/* Load more button */}
                            {hasMorePulses && tagFilter === "All" && (
                              <div className="flex justify-center pt-4">
                                <button
                                  onClick={handleLoadMorePulses}
                                  disabled={loadingMore}
                                  className="px-6 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-700 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                  {loadingMore
                                    ? "Loading..."
                                    : "Load more pulses"}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </section>
                    </>
                  );
              }
            })()}
          </div>

          {/* Disclaimer */}
          <div className="mt-8">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-center">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <strong>Disclaimer:</strong> Community Pulse displays user-submitted
                content. Posts may be inaccurate, incomplete, or misleading. Do not
                rely on this information for safety, travel, emergency, or
                decision-making purposes. All posts reflect the views of individual
                users, not the app&apos;s creators.
              </p>
            </div>
          </div>

          {/* Attribution Footer */}
          <footer className="py-6 pb-32 text-center border-t border-slate-800 mt-6">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Weather by{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition"
              >
                Open-Meteo
              </a>
              {" | "}
              Events via{" "}
              <a
                href="https://www.ticketmaster.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition"
              >
                Ticketmaster
              </a>
              {" | "}
              News by{" "}
              <a
                href="https://gnews.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition"
              >
                GNews
              </a>
              {" | "}
              AI by{" "}
              <a
                href="https://www.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition"
              >
                Anthropic Claude
              </a>
            </p>
            <p className="text-[11px] text-slate-600 mt-2">
              <a
                href="/terms"
                className="text-slate-500 hover:text-emerald-400 transition"
              >
                Terms of Service
              </a>
              {" | "}
              <a
                href="/privacy"
                className="text-slate-500 hover:text-emerald-400 transition"
              >
                Privacy Policy
              </a>
            </p>
          </footer>
        </div>
      </main>

      {/* Bottom Navigation - Primary navigation with 44px touch targets */}
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
    </div>
  );
}
