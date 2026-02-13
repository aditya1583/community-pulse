"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { VENUE_VIBE_TYPES, VenueVibeAggregate, getVibeTypeInfo, VenueVibeType } from "./types";

type LocalPlace = {
  id: string;
  name: string;
  category: string;
  categoryIcon?: string;
  address: string;
  distance: number | null;
  rating?: number;
  price?: number;
  hours?: {
    isOpen: boolean;
    openNow: string;
  };
  photos?: string[];
  url?: string;
  phone?: string;
  lat: number;
  lon: number;
};

type LocalDealsSectionProps = {
  cityName: string;
  state: string;
  lat?: number;
  lon?: number;
  /** Whether user is signed in */
  isSignedIn?: boolean;
  /** Callback to show sign-in modal */
  onSignInClick?: () => void;
};

const DEAL_CATEGORIES = [
  { id: "all", label: "All", query: "", osmCategory: "all", emoji: "🏪" },
  { id: "coffee", label: "Coffee", query: "coffee", osmCategory: "coffee", emoji: "☕" },
  { id: "food", label: "Food", query: "restaurants", osmCategory: "restaurants", emoji: "🍽️" },
  { id: "bars", label: "Bars", query: "bars", osmCategory: "bars", emoji: "🍺" },
  { id: "groceries", label: "Grocery", query: "grocery", osmCategory: "grocery", emoji: "🛒" },
] as const;

// Category-based icons and colors for places without photos
const CATEGORY_ICONS: Record<string, { emoji: string; gradient: string }> = {
  // Coffee
  "Coffee Shop": { emoji: "☕", gradient: "from-amber-600 to-orange-700" },
  "Cafe": { emoji: "☕", gradient: "from-amber-600 to-orange-700" },
  "cafe": { emoji: "☕", gradient: "from-amber-600 to-orange-700" },
  // Restaurants
  "Restaurant": { emoji: "🍽️", gradient: "from-red-600 to-rose-700" },
  "restaurant": { emoji: "🍽️", gradient: "from-red-600 to-rose-700" },
  "Fast Food": { emoji: "🍔", gradient: "from-yellow-600 to-amber-700" },
  "fast_food": { emoji: "🍔", gradient: "from-yellow-600 to-amber-700" },
  // Bars
  "Bar": { emoji: "🍸", gradient: "from-purple-600 to-violet-700" },
  "bar": { emoji: "🍸", gradient: "from-purple-600 to-violet-700" },
  "Pub": { emoji: "🍺", gradient: "from-amber-700 to-yellow-800" },
  "pub": { emoji: "🍺", gradient: "from-amber-700 to-yellow-800" },
  "Nightclub": { emoji: "🎵", gradient: "from-indigo-600 to-purple-700" },
  "nightclub": { emoji: "🎵", gradient: "from-indigo-600 to-purple-700" },
  // Grocery
  "Supermarket": { emoji: "🛒", gradient: "from-emerald-600 to-green-700" },
  "supermarket": { emoji: "🛒", gradient: "from-emerald-600 to-green-700" },
  "Convenience Store": { emoji: "🏪", gradient: "from-blue-600 to-cyan-700" },
  "convenience": { emoji: "🏪", gradient: "from-blue-600 to-cyan-700" },
  "Grocery Store": { emoji: "🥬", gradient: "from-green-600 to-emerald-700" },
  "grocery": { emoji: "🥬", gradient: "from-green-600 to-emerald-700" },
  "greengrocer": { emoji: "🥬", gradient: "from-green-600 to-emerald-700" },
  // Other
  "Bakery": { emoji: "🥐", gradient: "from-orange-500 to-amber-600" },
  "bakery": { emoji: "🥐", gradient: "from-orange-500 to-amber-600" },
  "Ice Cream": { emoji: "🍦", gradient: "from-pink-500 to-rose-600" },
  "ice_cream": { emoji: "🍦", gradient: "from-pink-500 to-rose-600" },
};

type CategoryId = (typeof DEAL_CATEGORIES)[number]["id"];
type DataSource = "foursquare" | "openstreetmap" | null;

// Get category icon info with fallback
function getCategoryIcon(category: string): { emoji: string; gradient: string } {
  return CATEGORY_ICONS[category] || { emoji: "🏪", gradient: "from-slate-600 to-slate-700" };
}

// Store for venue vibes (simple cache to avoid repeated fetches)
type VenueVibesCache = Record<string, { vibes: VenueVibeAggregate[]; fetchedAt: number }>;

// Client-side places cache (15-min in-memory, 1-hour localStorage) — avoids slow API re-fetches
const PLACES_CACHE_TTL_MS = 15 * 60 * 1000;
const LS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for localStorage
type PlacesCacheEntry = { places: LocalPlace[]; source: DataSource; fetchedAt: number };
const placesCache: Record<string, PlacesCacheEntry> = {};

function getPlacesCacheKey(lat: number, lon: number, category: string): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)},${category}`;
}

function savePlacesToLocalStorage(key: string, entry: PlacesCacheEntry): void {
  try {
    localStorage.setItem(`places_${key}`, JSON.stringify(entry));
  } catch { /* quota exceeded, ignore */ }
}

function getPlacesFromLocalStorage(key: string): PlacesCacheEntry | null {
  try {
    const raw = localStorage.getItem(`places_${key}`);
    if (!raw) return null;
    const entry: PlacesCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt < LS_CACHE_TTL_MS) return entry;
    return null;
  } catch { return null; }
}

function getCachedPlaces(lat: number, lon: number, category: string): PlacesCacheEntry | null {
  const key = getPlacesCacheKey(lat, lon, category);
  // Check in-memory first
  const memEntry = placesCache[key];
  if (memEntry && Date.now() - memEntry.fetchedAt < PLACES_CACHE_TTL_MS) {
    return memEntry;
  }
  // Fall back to localStorage
  const lsEntry = getPlacesFromLocalStorage(key);
  if (lsEntry) {
    placesCache[key] = lsEntry; // promote to memory
    return lsEntry;
  }
  return null;
}

export default function LocalDealsSection({
  cityName,
  state,
  lat,
  lon,
  isSignedIn = false,
  onSignInClick,
}: LocalDealsSectionProps) {
  const router = useRouter();
  const [places, setPlaces] = useState<LocalPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [dataSource, setDataSource] = useState<DataSource>(null);
  const [venueVibes, setVenueVibes] = useState<VenueVibesCache>({});

  const fetchPlaces = useCallback(async (category: CategoryId) => {
    if (!lat || !lon) {
      console.log("[LocalDeals] No coordinates available, lat:", lat, "lon:", lon);
      setError("Location required - please enable location services");
      setLoading(false);
      return;
    }

    console.log(`[LocalDeals] Fetching places for category: ${category}, coords: ${lat},${lon}`);

    // Check client-side cache first
    const cached = getCachedPlaces(lat, lon, category);
    if (cached) {
      console.log(`[LocalDeals] Cache hit: ${cached.places.length} places (${Math.round((Date.now() - cached.fetchedAt) / 1000)}s old)`);
      setPlaces(cached.places);
      setDataSource(cached.source);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDataSource(null);
    // Clear places array to prevent stale data from showing during re-fetch
    setPlaces([]);

    const categoryConfig = DEAL_CATEGORIES.find(c => c.id === category);

    // Use OSM as the primary data source with retry logic
    const osmParams = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      category: categoryConfig?.osmCategory || "all",
      limit: "12",
      radius: "3000", // ~1.9 miles — keeps results feeling truly local
    });

    interface OSMPlace {
      id: string;
      name: string;
      category: string;
      address: string;
      distance: number;
      lat: number;
      lon: number;
      phone?: string;
      website?: string;
    }

    const attemptFetch = async (): Promise<LocalPlace[] | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`/api/osm/places?${osmParams.toString()}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        if (data.places?.length > 0) {
          return (data.places as OSMPlace[]).map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            address: p.address,
            distance: p.distance,
            lat: p.lat,
            lon: p.lon,
            phone: p.phone,
            url: p.website,
          }));
        }
        return null;
      } catch {
        clearTimeout(timeoutId);
        return null;
      }
    };

    try {
      console.log("[LocalDeals] Trying OSM API...");
      let osmPlaces = await attemptFetch();

      // Retry once on failure
      if (!osmPlaces) {
        console.log("[LocalDeals] First attempt failed, retrying...");
        osmPlaces = await attemptFetch();
      }

      if (osmPlaces && osmPlaces.length > 0) {
        console.log(`[LocalDeals] OSM returned ${osmPlaces.length} places`);
        const cacheKey = getPlacesCacheKey(lat, lon, category);
        const entry: PlacesCacheEntry = { places: osmPlaces, source: "openstreetmap", fetchedAt: Date.now() };
        placesCache[cacheKey] = entry;
        savePlacesToLocalStorage(cacheKey, entry);
        setPlaces(osmPlaces);
        setDataSource("openstreetmap");
        setError(null);
      } else {
        // Both attempts failed — try localStorage fallback (stale data better than nothing)
        const cacheKey = getPlacesCacheKey(lat, lon, category);
        const stale = getPlacesFromLocalStorage(cacheKey);
        if (stale) {
          console.log("[LocalDeals] Using stale localStorage cache as fallback");
          setPlaces(stale.places);
          setDataSource(stale.source);
          setError(null);
        } else {
          setError("No places found nearby");
          setPlaces([]);
        }
      }
    } catch (err) {
      console.error("[LocalDeals] OSM fetch failed:", err);
      // Final fallback: localStorage
      const cacheKey = getPlacesCacheKey(lat, lon, category);
      const stale = getPlacesFromLocalStorage(cacheKey);
      if (stale) {
        setPlaces(stale.places);
        setDataSource(stale.source);
        setError(null);
      } else {
        setError("Unable to load places - please try again");
        setPlaces([]);
      }
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  // Fetch vibes for a venue (with caching)
  // Uses venue name as the key since that's the canonical identifier for vibes
  // Note: Using functional update pattern to avoid dependency on venueVibes
  const fetchVenueVibes = useCallback(async (venueName: string) => {
    // We need to check cache via ref or inside the setState callback
    // For now, let's use a simpler approach that doesn't cause re-renders
    try {
      // Query by venue_name - this matches how vibes are stored and queried on detail pages
      const res = await fetch(`/api/venue-vibe?venue_name=${encodeURIComponent(venueName)}`);
      const data = await res.json();
      const vibes = data.vibes || [];

      setVenueVibes(prev => {
        // Check cache inside the functional update to avoid stale closure issues
        const cached = prev[venueName];
        if (cached && Date.now() - cached.fetchedAt < 120000) {
          // Already cached and fresh, don't update
          return prev;
        }
        return {
          ...prev,
          [venueName]: { vibes, fetchedAt: Date.now() }
        };
      });

      return vibes;
    } catch (error) {
      console.error("Error fetching venue vibes:", error);
      return [];
    }
  }, []);

  // Fetch vibes for all places when places change
  useEffect(() => {
    if (places.length > 0) {
      // Fetch vibes for first 6 places (visible ones) using venue name
      places.slice(0, 6).forEach(place => {
        fetchVenueVibes(place.name);
      });
    }
  }, [places, fetchVenueVibes]);

  useEffect(() => {
    fetchPlaces(activeCategory);
  }, [activeCategory, fetchPlaces]);

  const handleCategoryChange = (category: CategoryId) => {
    setActiveCategory(category);
  };

  // Get the top vibe for a venue (by name)
  const getTopVibe = (venueName: string): VenueVibeAggregate | null => {
    const cached = venueVibes[venueName];
    return cached?.vibes?.[0] || null;
  };

  // Navigate to venue detail page (requires sign-in to share vibes)
  const openVenueDetail = (place: LocalPlace) => {
    // Check if user is signed in first
    if (!isSignedIn) {
      // Prompt to sign in instead of navigating
      if (onSignInClick) {
        onSignInClick();
      }
      return;
    }

    // Create URL-friendly slug from venue name
    const slug = place.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    // Pass venue data via URL params for venues not in DB
    const params = new URLSearchParams({
      id: slug,
      name: place.name,
      category: place.category || "",
      address: place.address || "",
      lat: place.lat?.toString() || "",
      lon: place.lon?.toString() || "",
    });

    router.push(`/venue/?${params.toString()}`);
  };

  const formatDistance = (meters: number | null) => {
    if (meters === null) return null;
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  };

  const renderPriceLevel = (price?: number) => {
    if (!price) return null;
    return (
      <span className="text-emerald-400 text-xs">
        {"$".repeat(price)}
        <span className="text-slate-600">{"$".repeat(4 - price)}</span>
      </span>
    );
  };

  const renderRating = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        <span className="text-amber-400 text-xs">★</span>
        <span className="text-slate-300 text-xs">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {DEAL_CATEGORIES.map((category) => {
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryChange(category.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${isActive
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
            >
              <span>{category.emoji}</span>
              <span>{category.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-slate-700/50 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-slate-700/50 rounded" />
                  <div className="h-3 w-1/2 bg-slate-700/50 rounded" />
                  <div className="h-3 w-2/3 bg-slate-700/50 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">🏪</div>
          <p className="text-slate-400 text-sm">{error}</p>
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(
              DEAL_CATEGORIES.find(c => c.id === activeCategory)?.query || "places"
            )}+near+${encodeURIComponent(cityName || "me")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-emerald-400 hover:text-emerald-300"
          >
            Search on Google Maps →
          </a>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && places.length === 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-slate-400 text-sm">
            No places found for this category
          </p>
          <button
            onClick={() => fetchPlaces(activeCategory)}
            className="mt-3 text-xs text-emerald-400 hover:text-emerald-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Places Grid */}
      {!loading && !error && places.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...places].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999)).map((place, index) => {
            const topVibe = getTopVibe(place.name);
            const vibeInfo = topVibe ? getVibeTypeInfo(topVibe.vibeType as VenueVibeType) : null;

            return (
              <button
                key={`${place.id}-${place.name}-${index}`}
                onClick={() => openVenueDetail(place)}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 hover:border-emerald-500/30 hover:bg-slate-800/80 transition group text-left w-full"
              >
                <div className="flex gap-3">
                  {/* Image or Icon */}
                  {(() => {
                    const iconInfo = getCategoryIcon(place.category);
                    return (
                      <div className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${place.photos?.[0] ? "" : `bg-gradient-to-br ${iconInfo.gradient}`
                        }`}>
                        {place.photos?.[0] ? (
                          <img
                            src={place.photos[0]}
                            alt={place.name}
                            className="w-full h-full object-cover"
                          />
                        ) : place.categoryIcon ? (
                          <img
                            src={place.categoryIcon}
                            alt={place.category}
                            className="w-8 h-8"
                          />
                        ) : (
                          <span className="text-2xl drop-shadow-md">{iconInfo.emoji}</span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-white text-sm truncate">
                        {place.name}
                      </h4>
                      {/* Vibe badge - the key visual indicator */}
                      {topVibe && vibeInfo && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full shrink-0 group-hover:bg-violet-500/30 transition">
                          <span>{vibeInfo.emoji}</span>
                          <span className="hidden sm:inline">{vibeInfo.label}</span>
                          {topVibe.count > 1 && (
                            <span className="text-violet-400/60">+{topVibe.count - 1}</span>
                          )}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {place.category}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {renderRating(place.rating)}
                      {renderPriceLevel(place.price)}
                      {place.hours && (
                        <span
                          className={`text-xs ${place.hours.isOpen ? "text-emerald-400" : "text-slate-500"
                            }`}
                        >
                          {place.hours.isOpen ? "Open" : "Closed"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      {place.address && place.address !== "Address unknown" && (
                        <p className="text-[10px] text-slate-500 truncate max-w-[140px]">
                          {place.address}
                        </p>
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        {place.distance !== null && (
                          <span className="text-[10px] text-slate-400">
                            {formatDistance(place.distance)}
                          </span>
                        )}
                        {/* Subtle prompt to share vibe */}
                        {!vibeInfo && (
                          <span className="text-[10px] text-emerald-500/70 group-hover:text-emerald-400 transition">
                            share vibe
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Attribution — minimal, full details in /legal */}
    </div>
  );
}
