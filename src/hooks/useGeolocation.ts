"use client";

import { useState, useEffect, useCallback } from "react";

export type GeolocationState = {
  /** User's latitude */
  lat: number | null;
  /** User's longitude */
  lon: number | null;
  /** Reverse-geocoded city name (e.g., "Leander, TX") */
  cityName: string | null;
  /** State code (e.g., "TX") */
  stateCode: string | null;
  /** Full address for display */
  displayName: string | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Permission status */
  permissionStatus: "prompt" | "granted" | "denied" | "unavailable";
};

export type GeolocationActions = {
  /** Request location permission and get coordinates */
  requestLocation: () => Promise<boolean>;
  /** Clear location and reset to manual mode */
  clearLocation: () => void;
};

const STORAGE_KEY = "community-pulse-location";

type StoredLocation = {
  lat: number;
  lon: number;
  cityName: string;
  stateCode: string;
  displayName: string;
  timestamp: number;
};

/**
 * useGeolocation Hook
 *
 * Handles device geolocation with:
 * - Permission request flow
 * - Reverse geocoding to get city/state
 * - LocalStorage persistence (24h cache)
 * - Graceful fallbacks
 */
export function useGeolocation(): GeolocationState & GeolocationActions {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lon: null,
    cityName: null,
    stateCode: null,
    displayName: null,
    loading: true,
    error: null,
    permissionStatus: "prompt",
  });

  // Check for stored location on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredLocation = JSON.parse(stored);
        // Check if cache is still valid (24 hours)
        const isValid = Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000;
        if (isValid) {
          setState({
            lat: parsed.lat,
            lon: parsed.lon,
            cityName: parsed.cityName,
            stateCode: parsed.stateCode,
            displayName: parsed.displayName,
            loading: false,
            error: null,
            permissionStatus: "granted",
          });
          return;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // Check permission status
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        loading: false,
        permissionStatus: "unavailable",
        error: "Geolocation not supported",
      }));
      return;
    }

    // Check current permission without prompting
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setState(prev => ({
          ...prev,
          loading: false,
          permissionStatus: result.state as "prompt" | "granted" | "denied",
        }));

        // If already granted, get location automatically
        if (result.state === "granted") {
          requestLocationInternal();
        }
      }).catch(() => {
        setState(prev => ({ ...prev, loading: false }));
      });
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Internal function to get location
  const requestLocationInternal = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: "Geolocation not supported by your browser",
        permissionStatus: "unavailable",
      }));
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          // Reverse geocode to get city name
          try {
            const geoResult = await reverseGeocode(latitude, longitude);

            const locationData: StoredLocation = {
              lat: latitude,
              lon: longitude,
              cityName: geoResult.city,
              stateCode: geoResult.state,
              displayName: `${geoResult.city}, ${geoResult.state}`,
              timestamp: Date.now(),
            };

            // Store in localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(locationData));

            setState({
              lat: latitude,
              lon: longitude,
              cityName: geoResult.city,
              stateCode: geoResult.state,
              displayName: locationData.displayName,
              loading: false,
              error: null,
              permissionStatus: "granted",
            });

            resolve(true);
          } catch (geoError) {
            // Even if reverse geocoding fails, we have coordinates
            const locationData: StoredLocation = {
              lat: latitude,
              lon: longitude,
              cityName: "Your Area",
              stateCode: "",
              displayName: "Near You",
              timestamp: Date.now(),
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(locationData));

            setState({
              lat: latitude,
              lon: longitude,
              cityName: "Your Area",
              stateCode: "",
              displayName: "Near You",
              loading: false,
              error: null,
              permissionStatus: "granted",
            });

            resolve(true);
          }
        },
        (error) => {
          let errorMessage = "Unable to get location";
          let status: GeolocationState["permissionStatus"] = "denied";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied";
              status = "denied";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location unavailable";
              status = "unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              status = "prompt";
              break;
          }

          setState(prev => ({
            ...prev,
            loading: false,
            error: errorMessage,
            permissionStatus: status,
          }));

          resolve(false);
        },
        {
          enableHighAccuracy: false, // Don't need GPS precision, cell/wifi is fine
          timeout: 10000,
          maximumAge: 5 * 60 * 1000, // Accept 5-minute old position
        }
      );
    });
  }, []);

  // Public request function
  const requestLocation = useCallback(async (): Promise<boolean> => {
    return requestLocationInternal();
  }, [requestLocationInternal]);

  // Clear stored location
  const clearLocation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      lat: null,
      lon: null,
      cityName: null,
      stateCode: null,
      displayName: null,
      loading: false,
      error: null,
      permissionStatus: "prompt",
    });
  }, []);

  return {
    ...state,
    requestLocation,
    clearLocation,
  };
}

/**
 * Reverse geocode coordinates to city/state
 * Uses OpenStreetMap Nominatim (free, no API key)
 */
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; state: string }> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
    {
      headers: {
        "User-Agent": "CommunityPulse/1.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Geocoding failed");
  }

  const data = await response.json();
  const address = data.address || {};

  // Extract city (try multiple fields)
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    "Unknown";

  // Extract state code
  const stateCode = address["ISO3166-2-lvl4"]?.split("-")[1] || address.state || "";

  return { city, state: stateCode };
}

export default useGeolocation;
