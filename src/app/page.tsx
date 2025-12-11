"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { useGeocodingAutocomplete } from "@/hooks/useGeocodingAutocomplete";
import type { GeocodedCity } from "@/lib/geocoding";

const MAX_MESSAGE_LENGTH = 240;

// Replace these placeholders with your own list
const BANNED_WORDS = ["badword1", "badword2", "badword3"];

function isCleanMessage(text: string) {
  const lowered = text.toLowerCase();
  return !BANNED_WORDS.some((w) => lowered.includes(w));
}

type WeatherInfo = {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
  cityName: string;
};

type Pulse = {
  id: number;
  city: string;
  mood: string;
  tag: string;
  message: string;
  author: string;
  createdAt: string;
};

// GLOBAL POSTING STEAK

type StreakInfo = {
  currentStreak: number;
  lastActiveDate: string | null;
};


// Saved Favorites
type FavoritePulseId = number;

// Real-time Live Updates
type DBPulse = {
  id: number;
  city: string;
  mood: string;
  tag: string;
  message: string;
  author: string;
  created_at: string;
};

function mapDBPulseToPulse(row: DBPulse): Pulse {
  return {
    id: row.id,
    city: row.city,
    mood: row.mood,
    tag: row.tag,
    message: row.message,
    author: row.author,
    createdAt: row.created_at,
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

// NEWS
type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

type NewsData = {
  articles: NewsArticle[];
  sourceCity: string;
  originalCity: string;
  isNearbyFallback: boolean;
  notConfigured?: boolean;
};

// CITY MOOD
type MoodScore = {
  mood: string;
  count: number;
  percent: number;
};

const TAGS = ["All", "Traffic", "Weather", "Events", "General"];
const MOODS = ["😊", "😐", "😢", "😡", "😴", "🤩"];

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

function generateFunUsername() {
  const moods = [
    "Chill",
    "Spicy",
    "Sleepy",
    "Curious",
    "Salty",
    "Hyper",
    "Zen",
    "Chaotic",
  ];
  const animals = [
    "Coyote",
    "Otter",
    "Panda",
    "Falcon",
    "Capybara",
    "Llama",
    "Raccoon",
    "Fox",
  ];

  const mood = moods[Math.floor(Math.random() * moods.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10–99

  return `${mood} ${animal} ${num}`;
}

type Profile = {
  anon_name: string;
  name_locked?: boolean | null;
};



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
  const [mood, setMood] = useState("😊");
  const [tag, setTag] = useState("General");
  const [message, setMessage] = useState("");
  const [pulses, setPulses] = useState<Pulse[]>([]);

  // Auth + anon profile
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  // const [profile, setProfile] = useState<{ anon_name: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);


  // USER STREAK

  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const [userPulseCount, setUserPulseCount] = useState(0);


  // Saved Favorites
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

  // Events state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventTime, setNewEventTime] = useState(""); // datetime-local value
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventCreateError, setEventCreateError] = useState<string | null>(null);

  // Traffic
  const [trafficLevel, setTrafficLevel] =
    useState<"Light" | "Moderate" | "Heavy" | null>(null);
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
  const [cityMood, setCityMood] = useState<{
    dominantMood: string | null;
    scores: MoodScore[];
    pulseCount: number;
  } | null>(null);
  const [cityMoodLoading, setCityMoodLoading] = useState(false);
  const [cityMoodError, setCityMoodError] = useState<string | null>(null);

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

  // News
  const [news, setNews] = useState<NewsData | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // ========= AI SUMMARY =========
  useEffect(() => {
    if (pulses.length === 0) {
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

        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city,
            pulses,
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
  }, [city, pulses]);

  // ========= REAL-TIME FEED =========
useEffect(() => {
  if (!city) return;

  const channel = supabase
    .channel("pulses-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "pulses",
        filter: `city=eq.${city}`,
      },
      (payload) => {
        const row = payload.new as DBPulse;
        if (!row || row.city !== city) return;

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
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [city, setPulses]);  // DO NOT CHANGE THIS


  // ========= CITY MOOD =========
  useEffect(() => {
    if (!city) return;

    async function fetchCityMood() {
      try {
        setCityMoodLoading(true);
        setCityMoodError(null);

        const res = await fetch(
          `/api/city-mood?city=${encodeURIComponent(city)}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch city mood");
        }

        const data = await res.json();
        setCityMood({
          dominantMood: data.dominantMood,
          scores: data.scores || [],
          pulseCount: data.pulseCount || 0,
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
  }, [city, pulses.length]);

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

  // ========= NEWS FETCH =========
  useEffect(() => {
    if (!city) return;

    async function fetchNews() {
      try {
        setNewsLoading(true);
        setNewsError(null);

        const res = await fetch(`/api/news?city=${encodeURIComponent(city)}`);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to fetch news");
        }

        const data: NewsData = await res.json();
        setNews(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load news right now.";
        console.error("Error fetching news:", err);
        setNewsError(message);
        setNews(null);
      } finally {
        setNewsLoading(false);
      }
    }

    fetchNews();
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

  // ========= LOAD SESSION + PROFILE =========
    useEffect(() => {
    async function loadUser() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      setSessionUser(user);

      if (!user) return;

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
        const anon = generateFunUsername();

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
    }

    loadUser();
  }, []);


// USER STREAK
const loadStreak = useCallback(async () => {
  const userId = sessionUser?.id;

  if (!userId) {
    setStreakInfo(null);
    setUserPulseCount(0);
    setStreakLoading(false);
    return;
  }

  try {
    setStreakLoading(true);

    // Grab up to 365 days of posts for this user
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
    setUserPulseCount(count ?? rows.length);

    if (rows.length === 0) {
      setStreakInfo({ currentStreak: 0, lastActiveDate: null });
      return;
    }

    // Convert to local YYYY-MM-DD strings & dedupe
    const dateStrings = Array.from(
      new Set(
        rows.map((row: { created_at: string }) => {
          const d = new Date(row.created_at);
          // ISO-like local date (yyyy-mm-dd)
          return d.toLocaleDateString("en-CA");
        })
      )
    ).sort((a, b) => (a < b ? 1 : -1)); // newest first

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
}, [sessionUser]);

useEffect(() => {
  loadStreak();
}, [loadStreak]);



  // ========= LOAD FAVORITES FOR USER =========
useEffect(() => {
  // derive a stable userId for this effect run
  const userId = sessionUser?.id;

  // If not logged in, clear favorites
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
        .eq("user_id", userId); // use userId, not sessionUser.id

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
      // Ignore storage errors in environments where localStorage is blocked
    }
  }, [city, selectedCity]);

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

  // ========= LOCAL STORAGE: USERNAME (REMOVED - NOW REQUIRES AUTH) =========
  // Username is now only assigned after authentication via profile
  // No more localStorage fallback to prevent confusion

  // ========= PULSES FETCH =========
  useEffect(() => {
    const fetchPulses = async () => {
      setLoading(true);
      setErrorMsg(null);
      setPulses([]);

      const { data, error } = await supabase
        .from("pulses")
        .select("*")
        .eq("city", city)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pulses:", error.message);
        setErrorMsg("Could not load pulses. Try again in a bit.");
        setPulses([]);
      } else if (data) {
        const mapped: Pulse[] = (data as DBPulse[]).map((row) => ({
          id: row.id,
          city: row.city,
          mood: row.mood,
          tag: row.tag,
          message: row.message,
          author: row.author || "Anonymous",
          createdAt: new Date(row.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setPulses(mapped);
      }

      setLoading(false);
    };

    if (city) {
      fetchPulses();
    }
  }, [city]);

  // ========= TRAFFIC =========
  useEffect(() => {
    if (!city) return;

    const fetchTraffic = async () => {
      try {
        setTrafficLoading(true);
        setTrafficError(null);

        const res = await fetch(`/api/traffic?city=${encodeURIComponent(city)}`);

        let data: { level?: "Light" | "Moderate" | "Heavy"; error?: string } | null =
          null;
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
        // If body is empty or not JSON, keep data = null
      }

      if (!res.ok) {
        const msg =
          (data && data.error) ||
          `Failed to create event (status ${res.status})`;
        throw new Error(msg);
      }

      if (data && data.event) {
        setEvents((prev) => [data.event, ...prev]);
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
  // Capture userId once so TS knows it won't change in this function
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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    // Validation
    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);

      if (authMode === "signup") {
        // ===== SIGN UP MODE =====

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          setAuthError(passwordValidation.error || "Password does not meet requirements.");
          setAuthLoading(false);
          return;
        }

        // Check password confirmation
        if (password !== authPasswordConfirm) {
          setAuthError("Passwords do not match.");
          setAuthLoading(false);
          return;
        }

        // Attempt sign up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          // Check if error is about user already existing
          if (signUpError.message.toLowerCase().includes("already registered") ||
              signUpError.message.toLowerCase().includes("already exists") ||
              signUpError.message.toLowerCase().includes("user already")) {
            setAuthError("This email is already registered. Please check your email for a confirmation link, or try signing in.");
            return;
          }
          setAuthError(signUpError.message || "Could not create account. Please try again.");
          return;
        }

        // Check if this is a new signup or a resent confirmation
        // Supabase returns user but may have already sent confirmation email
        if (signUpData.user) {
          // Check if user session is not immediately available (needs confirmation)
          if (!signUpData.session) {
            // Email confirmation required
            setAuthError("Account created! Please check your email to confirm your account before signing in.");
            setAuthEmail("");
            setAuthPassword("");
            setAuthPasswordConfirm("");
            return;
          }

          // User is immediately signed in (email confirmation disabled)
          setSessionUser(signUpData.user);

          // Check if profile already exists
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", signUpData.user.id)
            .single();

          if (existingProfile) {
            // Profile exists, just load it
            setProfile({
              anon_name: existingProfile.anon_name,
              name_locked: existingProfile.name_locked ?? false,
            });
          } else {
            // Create new profile with random username
            const anon = generateFunUsername();
            const { error: insertError } = await supabase.from("profiles").insert({
              id: signUpData.user.id,
              anon_name: anon,
              name_locked: false,
            });

            if (insertError) {
              console.error("Error creating profile:", insertError);
              // If insert failed, try to fetch existing profile one more time
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

          // Clear form and close modal
          setAuthEmail("");
          setAuthPassword("");
          setAuthPasswordConfirm("");
          setShowAuthModal(false);
        }
      } else {
        // ===== SIGN IN MODE =====

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

          // Load or create profile
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
            // Create profile if it doesn't exist (legacy users)
            const anon = generateFunUsername();
            const { error: insertError } = await supabase.from("profiles").insert({
              id: signInData.user.id,
              anon_name: anon,
              name_locked: false,
            });

            if (insertError) {
              console.error("Error creating profile on sign in:", insertError);
              // If insert failed, profile might already exist, try to fetch it
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

          // Clear form and close modal
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

      // Remember previous name so user can undo
      setLastAnonName(profile?.anon_name || username || null);

      const updatedProfileName = newName;

      setProfile((prev) =>
        prev
          ? { ...prev, anon_name: updatedProfileName }
          : { anon_name: updatedProfileName }
      );
      setUsername(updatedProfileName);

      // Persist to Supabase profile
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
  const filteredPulses = pulses.filter(
    (p) => tagFilter === "All" || p.tag === tagFilter
  );

  // ========= ADD PULSE =========
  const handleAddPulse = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    if (!isCleanMessage(trimmed)) {
      setValidationError("Pulse contains disallowed language.");
      return;
    }

    setErrorMsg(null);
    setValidationError(null);

    const authorName = profile?.anon_name || username || "Anonymous";

    const { data, error } = await supabase
      .from("pulses")
      .insert([
        {
          city,
          mood,
          tag,
          message: trimmed,
          author: authorName,
          user_id: sessionUser?.id ?? null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error inserting pulse:", error.message);
      setErrorMsg("Could not post your pulse. Please try again.");
      return;
    }

    if (data) {
      // Realtime listener will add it to the list
      setMessage("");

      if (sessionUser) {
        await loadStreak();
      }
    }
  };

  const displayName = profile?.anon_name || username || "…";
  const currentStreak = streakInfo?.currentStreak ?? 0;
  const streakLabel = streakLoading
    ? "Checking streak…"
    : !sessionUser
      ? "Sign in to track streaks"
      : currentStreak > 0
        ? `Streak: ${currentStreak} day${currentStreak === 1 ? "" : "s"} 🔥`
        : "Start a streak today!";

  const badges = [
    {
      id: "first-pulse",
      name: "First Pulse",
      description: "Post 1 pulse",
      unlocked: userPulseCount >= 1,
    },
    {
      id: "steady-vibes",
      name: "Steady Vibes",
      description: "Maintain a 3-day streak",
      unlocked: currentStreak >= 3,
    },
  ];

  const unlockedBadges = badges.filter((b) => b.unlocked).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAuthModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                    setAuthPasswordConfirm("");
                  }}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
                    authMode === "signin"
                      ? "bg-pink-500 text-slate-950"
                      : "bg-slate-950/50 text-slate-400 hover:text-slate-200"
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
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
                    authMode === "signup"
                      ? "bg-pink-500 text-slate-950"
                      : "bg-slate-950/50 text-slate-400 hover:text-slate-200"
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
                className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
              >
                ×
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
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
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
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
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
                    className="rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                    disabled={authLoading}
                  />
                </div>
              )}

              {authError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-2xl px-3 py-2">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-2xl bg-pink-500 px-4 py-2.5 text-sm font-medium text-slate-950 shadow-lg shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
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

      <main className="flex-1 flex justify-center px-4 py-6">
        <div className="w-full max-w-4xl space-y-6">
          {/* Auth button in top right */}
        {!sessionUser ? (
          <div className="flex justify-end">
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-sm px-4 py-2 rounded-2xl bg-pink-500 text-slate-950 font-medium shadow-lg shadow-pink-500/30 hover:bg-pink-400 transition"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end text-sm text-slate-400 ml-4 gap-2">
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-2">
                <span>{displayName}</span>

                {!profile?.name_locked ? (
                  <button
                    type="button"
                    onClick={() => setShowUsernameEditor((prev) => !prev)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:border-pink-400 hover:text-pink-300 transition"
                  >
                    🎲 Edit vibe name
                  </button>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                    <span>🔒</span>
                  </span>
                )}

              </div>

              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSessionUser(null);
                  setProfile(null);
                }}
                className="text-[11px] text-slate-500 hover:text-pink-300 underline"
              >
                Log out
              </button>
            </div>
          </div>
        )}

        {sessionUser && showUsernameEditor && !profile?.name_locked && (
          <div className="mt-3 mx-4 rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3 text-xs text-slate-200">
            <p className="text-[11px] text-slate-300 mb-2">
              Describe your vibe in <span className="font-semibold">3+ words</span>, and we&apos;ll craft a fun anonymous name for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                value={usernamePrompt}
                onChange={(e) => setUsernamePrompt(e.target.value)}
                placeholder="e.g. sleepy sarcastic overcaffeinated"
                className="flex-1 rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
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
                  className="inline-flex items-center gap-1 rounded-2xl bg-pink-500 px-3 py-1.5 text-[11px] font-medium text-slate-950 shadow-lg shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <span>{usernameGenerating ? "Rolling…" : "Roll"}</span>
                  <span>🎲</span>
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
                    className="text-[11px] px-2 py-1 rounded-2xl bg-emerald-500/15 border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/25 transition"
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
              Current name: <span className="text-slate-100">{displayName}</span>
            </p>
          </div>
        )}

<header className="rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 p-[1px] shadow-lg">
  <div className="rounded-3xl bg-slate-950/90 px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    {/* Left side: title + tagline */}
    <div>
      <h1 className="text-3xl font-semibold tracking-tight flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span>
          Community <span className="text-pink-400">Pulse</span>
        </span>
        <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 uppercase tracking-wide">
          Beta
        </span>
      </h1>
      <p className="text-sm text-slate-300 mt-1">
        Real-time vibes from your city. No doom scroll, just quick pulses.
      </p>
    </div>

    {/* Right side: city selector with autocomplete */}
    <div className="flex flex-col sm:items-end gap-2 relative">
      <label className="text-xs text-slate-400 uppercase tracking-wide">
        City
      </label>
      <div className="relative w-full sm:w-64">
        <input
          ref={cityInputRef}
          value={cityInput}
          onChange={handleCityInputChange}
          onKeyDown={handleCityInputKeyDown}
          onFocus={() =>
            cityInput.trim().length >= 3 && setShowCitySuggestions(true)
          }
          className="w-full rounded-2xl bg-slate-900 border border-slate-700 px-3 py-1.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
          placeholder="Search any city (e.g., Hyderabad)"
        />
        {citySuggestionsLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
            Searching…
          </span>
        )}
        {showCitySuggestions && citySuggestions.length > 0 && (
          <div
            ref={cityDropdownRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {citySuggestions.map((suggestion, idx) => (
              <button
                key={suggestion.id}
                type="button"
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleCitySelect(suggestion)}
                className={`w-full px-3 py-2 text-left text-sm transition flex items-center justify-between ${
                  highlightedIndex === idx
                    ? "bg-slate-800 text-pink-200"
                    : "hover:bg-slate-800 text-slate-100"
                }`}
              >
                <span>{suggestion.displayName}</span>
                <span className="text-[10px] text-slate-400">
                  {suggestion.country || "🌍"}
                </span>
              </button>
            ))}
          </div>
        )}
        {citySuggestionsNotFound && !citySuggestionsLoading && (
          <p className="mt-1 text-[11px] text-amber-300">
            We couldn’t find that city yet. Try typing &quot;City, Country&quot;
            (e.g., &quot;Hyderabad, IN&quot;).
          </p>
        )}
        {citySuggestionsError && (
          <p className="mt-1 text-[11px] text-red-400">
            {citySuggestionsError} Keeping {lastValidCity.displayName}.
          </p>
        )}
      </div>
    </div>
  </div>
</header>

        {/* Info widgets grid - Weather, Mood, Traffic */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Weather widget */}
          <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              Weather in {weather?.cityName || city}
            </p>
            {weatherLoading ? (
              <p className="text-sm text-slate-400">Fetching latest weather…</p>
            ) : weather ? (
              <>
                <span className="text-4xl mb-2">
                  {(() => {
                    const map: Record<string, string> = {
                      "01d": "☀️",
                      "01n": "🌕",
                      "02d": "🌤️",
                      "02n": "☁️🌙",
                      "03d": "⛅",
                      "03n": "☁️",
                      "04d": "☁️",
                      "04n": "☁️",
                      "09d": "🌧️",
                      "09n": "🌧️",
                      "10d": "🌦️",
                      "10n": "🌧️🌙",
                      "11d": "⛈️",
                      "11n": "🌩️",
                      "13d": "❄️",
                      "13n": "❄️🌙",
                      "50d": "🌫️",
                      "50n": "🌫️🌙",
                    };
                    return map[weather.icon] || "🌍";
                  })()}
                </span>
                <p className="text-lg text-slate-100 font-semibold">
                  {Math.round(weather.temp)}°F
                </p>
                <p className="text-xs text-slate-400">
                  Feels like {Math.round(weather.feelsLike)}°F
                </p>
                <p className="text-xs text-slate-400 capitalize mt-1">
                  {weather.description}
                </p>
              </>
            ) : weatherError ? (
              <p className="text-xs text-red-400">{weatherError}</p>
            ) : (
              <p className="text-xs text-slate-500">Weather data not available yet.</p>
            )}
          </section>

          {/* City Mood Meter */}
          <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              City mood in {city || "your city"}
            </p>
            {cityMoodLoading ? (
              <p className="text-sm text-slate-400">Reading the vibes…</p>
            ) : cityMoodError ? (
              <p className="text-sm text-red-400">{cityMoodError}</p>
            ) : !cityMood || cityMood.pulseCount === 0 ? (
              <p className="text-sm text-slate-400">Not enough recent pulses to read the mood.</p>
            ) : (
              <>
                <span className="text-4xl mb-2">
                  {cityMood.dominantMood || "😐"}
                </span>
                <p className="text-sm text-slate-100">
                  From <span className="font-semibold">{cityMood.pulseCount}</span> recent pulses
                </p>
                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                  {cityMood.scores.slice(0, 3).map((item) => (
                    <div
                      key={item.mood}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 border border-slate-700/60"
                    >
                      <span className="text-xs">{item.mood}</span>
                      <span className="text-slate-300">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Traffic snapshot widget */}
          <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              Traffic in {city || "your city"}
            </p>
            {trafficLoading ? (
              <p className="text-sm text-slate-400">Estimating traffic…</p>
            ) : trafficError ? (
              <p className="text-sm text-red-400">{trafficError}</p>
            ) : trafficLevel ? (
              <>
                {trafficLevel === "Light" && (
                  <>
                    <span className="text-4xl mb-2">🟢</span>
                    <p className="text-lg text-slate-100 font-semibold">Light traffic</p>
                  </>
                )}
                {trafficLevel === "Moderate" && (
                  <>
                    <span className="text-4xl mb-2">🟡</span>
                    <p className="text-lg text-slate-100 font-semibold">Moderate traffic</p>
                  </>
                )}
                {trafficLevel === "Heavy" && (
                  <>
                    <span className="text-4xl mb-2">🔴</span>
                    <p className="text-lg text-slate-100 font-semibold">Heavy traffic</p>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">Not enough recent data yet.</p>
            )}
          </section>
        </div>

        {/* Local News Section */}
        <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <span className="text-base">📰</span>
              Local News
              {news?.isNearbyFallback && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  from {news.sourceCity}
                </span>
              )}
            </h2>
            <span className="text-[10px] text-slate-500">
              Powered by NewsAPI.org
            </span>
          </div>

          {newsLoading ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-sm text-slate-400">Fetching local news...</p>
            </div>
          ) : newsError ? (
            <p className="text-sm text-red-400 py-4">{newsError}</p>
          ) : news?.notConfigured ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              News feature coming soon
            </p>
          ) : news && news.articles.length > 0 ? (
            <div className="space-y-2">
              {news.articles.slice(0, 5).map((article, index) => (
                <a
                  key={index}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-2.5 hover:border-pink-500/60 hover:shadow-pink-500/20 transition group"
                >
                  <div className="flex gap-3">
                    {article.urlToImage && (
                      <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-800">
                        <img
                          src={article.urlToImage}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm text-slate-100 font-medium line-clamp-2 group-hover:text-pink-300 transition">
                        {article.title}
                      </h3>
                      {article.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {article.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        <span>{article.source.name}</span>
                        <span>•</span>
                        <span>
                          {new Date(article.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">
              No local news available
            </p>
          )}
        </section>

        {/* New Pulse Card */}
        <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-100">
              Drop a <span className="text-pink-400">pulse</span>
            </h2>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {loading ? "Loading…" : "Live board"}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-2">
            <div className="text-xs sm:text-sm text-slate-200">{streakLabel}</div>

            <details className="group text-xs text-slate-300 w-full sm:w-auto">
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none">
                <span>Badges</span>
                <span className="text-[10px] text-slate-400">
                  ({unlockedBadges}/{badges.length})
                </span>
                <span className="text-sm">🏅</span>
              </summary>

              <div className="mt-2 flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`flex items-start gap-2 rounded-2xl border px-3 py-2 ${
                      badge.unlocked
                        ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-800 bg-slate-900/70 text-slate-300"
                    }`}
                  >
                    <span className="text-lg">
                      {badge.unlocked ? "✨" : "🔒"}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-100">
                        {badge.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {badge.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {!sessionUser ? (
            <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-4 py-8 text-center">
              <p className="text-sm text-slate-300 mb-3">
                Sign in to drop pulses and track your streak
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-pink-500 px-5 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-pink-500/30 hover:bg-pink-400 transition"
              >
                <span>Sign in to post</span>
                <span>→</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 items-center">
                {/* Mood picker */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Mood</span>
                  <div className="flex gap-1.5 bg-slate-950/70 border border-slate-800 rounded-2xl px-2 py-1">
                    {MOODS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMood(m)}
                        className={`text-lg px-1.5 rounded-2xl transition ${
                          mood === m
                            ? "bg-slate-800 scale-110"
                            : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tag select */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Tag</span>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                  >
                    <option>Traffic</option>
                    <option>Weather</option>
                    <option>Events</option>
                    <option>General</option>
                  </select>
                </div>
              </div>

              {/* Message input */}
              <div className="space-y-3">
                <textarea
                  value={message}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length > MAX_MESSAGE_LENGTH) return;
                    setMessage(value);
                    setValidationError(null);
                  }}
                  rows={3}
                  className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent resize-none"
                  placeholder="What's the vibe right now? (e.g., 'Commute is smooth on 183, sunset looks insane.')"
                />
                <div className="flex items-center justify-between text-[11px] mt-1">
                  <span className="text-slate-500">
                    {message.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                  {validationError && (
                    <span className="text-red-400">{validationError}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Posting as{" "}
                    <span className="text-slate-200">{displayName}</span>. Pulses
                    are public. Keep it kind & useful.
                  </span>
                  <button
                    onClick={handleAddPulse}
                    disabled={!message.trim() || loading}
                    className="inline-flex items-center gap-1 rounded-2xl bg-pink-500 px-4 py-1.5 text-xs font-medium text-slate-950 shadow-lg shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <span>Post pulse</span> <span>⚡</span>
                  </button>
                </div>
              </div>
            </>
          )}
          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-2xl px-3 py-2 mt-1">
              {errorMsg}
            </p>
          )}
        </section>

        {/* AI Summary Section */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-200">
              AI Summary for {city}
            </h2>
            <span className="text-[11px] text-slate-400">
              {summaryLoading
                ? "Summarizing recent pulses…"
                : "Auto-generated from recent pulses"}
            </span>
          </div>

          {summaryError && (
            <p className="text-xs text-red-400">{summaryError}</p>
          )}

          {summary ? (
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
              {summary}
            </p>
          ) : !summaryLoading && pulses.length === 0 ? (
            <p className="text-xs text-slate-500">
              No pulses yet. Start posting to see an AI summary here.
            </p>
          ) : null}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={`px-3 py-1.5 rounded-2xl text-xs border transition ${
                tagFilter === t
                  ? "bg-pink-500 text-slate-950 border-pink-400 shadow shadow-pink-500/40"
                  : "bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Show upcoming events when "Events" tab is active */}
        {tagFilter === "Events" && (
          <div className="space-y-2 pb-4">
            {events.length === 0 ? (
              <p className="text-xs text-slate-500">
                No upcoming events yet for {city}. Create one above.
              </p>
            ) : (
              events.map((ev) => {
                const start = new Date(ev.starts_at);
                const timeStr = start.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                });

                const mapsUrl = ev.location
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      ev.location
                    )}`
                  : null;

                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      if (mapsUrl) window.open(mapsUrl, "_blank");
                    }}
                    className="w-full flex justify-between items-start rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-left hover:border-pink-500/60 hover:shadow-pink-500/20 transition"
                  >
                    <div>
                      <p className="text-sm text-slate-100 font-medium">
                        {ev.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {timeStr}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                    </div>
                    {ev.category && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/30">
                        {ev.category}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Pulses list */}
        <section className="space-y-3 pb-12">
          {loading && pulses.length === 0 ? (
            <div className="rounded-3xl bg-slate-900/70 border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
              Loading pulses for{" "}
              <span className="font-semibold text-slate-100">{city}</span>…
            </div>
          ) : filteredPulses.length === 0 ? (
            <div className="rounded-3xl bg-slate-900/70 border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
              No pulses yet for{" "}
              <span className="font-semibold text-slate-100">{city}</span>. Be
              the first to set the vibe.
            </div>
          ) : (
            filteredPulses.map((pulse) => (
              <article
                key={pulse.id}
                className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 flex gap-3 hover:border-pink-500/60 hover:shadow-pink-500/20 transition"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-950/80 flex items-center justify-center text-2xl">
                    {pulse.mood}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-pink-300 bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 rounded-full">
                    {pulse.tag}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <p className="text-sm text-slate-100 leading-snug">
                    {pulse.message}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="text-slate-300">{pulse.author}</span>

                    <div className="flex items-center gap-3">
                      {/* Favorite star */}
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(pulse.id)}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-yellow-300 transition"
                      >
                        <span className="text-base leading-none">
                          {favoritePulseIds.includes(pulse.id) ? "★" : "☆"}
                        </span>
                      </button>

                      <span>
                        {pulse.city} · {pulse.createdAt}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Disclaimer */}
        <div className="mt-16 flex justify-center">
          <div className="inline-block bg-slate-900/70 border border-slate-700 rounded-2xl px-4 py-3 max-w-xl text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong>Disclaimer:</strong> Community Pulse displays user-submitted
              content. Posts may be inaccurate, incomplete, or misleading. Do not
              rely on this information for safety, travel, emergency, or
              decision-making purposes. All posts reflect the views of individual
              users, not the app’s creators. By using this service, you agree
              that Community Pulse is not responsible for any actions taken based
              on user content.
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
  );
}
