"use client";

import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { getApiUrl } from "@/lib/api-config";

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
 * Check if running in Capacitor native app
 */
function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * useGeolocation Hook
 *
 * Handles device geolocation with:
 * - Capacitor Geolocation plugin for native apps
 * - Browser navigator.geolocation for web
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

    // Check initial permission status
    checkPermissionStatus();
  }, []);

  // Check permission status without requesting
  const checkPermissionStatus = useCallback(async () => {
    if (isNativeApp()) {
      // Use Capacitor permission check
      try {
        const status = await Geolocation.checkPermissions();
        const permissionState = status.location === "granted" ? "granted"
          : status.location === "denied" ? "denied"
            : "prompt";

        setState(prev => ({
          ...prev,
          loading: false,
          permissionStatus: permissionState,
        }));

        // If already granted, get location automatically
        if (permissionState === "granted") {
          requestLocationInternal();
        }
      } catch {
        setState(prev => ({ ...prev, loading: false }));
      }
    } else {
      // Web: Check navigator.geolocation
      if (!navigator.geolocation) {
        setState(prev => ({
          ...prev,
          loading: false,
          permissionStatus: "unavailable",
          error: "Geolocation not supported",
        }));
        return;
      }

      // Check permissions via Permissions API (if available)
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          setState(prev => ({
            ...prev,
            loading: false,
            permissionStatus: result.state as "prompt" | "granted" | "denied",
          }));

          // If already granted, get location automatically
          if (result.state === "granted") {
            requestLocationInternal();
          }
        } catch {
          setState(prev => ({ ...prev, loading: false }));
        }
      } else {
        // No Permissions API, assume "prompt" state
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, []);

  // Internal function to get location
  const requestLocationInternal = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let latitude: number;
      let longitude: number;

      if (isNativeApp()) {
        // Use Capacitor Geolocation plugin
        console.log("[Geolocation] Using Capacitor plugin");

        // Request permission first
        const permissionStatus = await Geolocation.requestPermissions();
        if (permissionStatus.location !== "granted") {
          setState(prev => ({
            ...prev,
            loading: false,
            error: "Location permission denied",
            permissionStatus: "denied",
          }));
          return false;
        }

        // Get current position
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000, // Accept 5-minute old position
        });

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        // Use browser navigator.geolocation
        console.log("[Geolocation] Using browser API");

        if (!navigator.geolocation) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: "Geolocation not supported by your browser",
            permissionStatus: "unavailable",
          }));
          return false;
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 5 * 60 * 1000,
          });
        });

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      // Reverse geocode to get city name
      console.log(`[Geolocation] Got coords: ${latitude}, ${longitude}`);
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

      return true;
    } catch (error: unknown) {
      console.error("[Geolocation] Error:", error);

      let errorMessage = "Unable to get location";
      let status: GeolocationState["permissionStatus"] = "denied";

      if (error instanceof GeolocationPositionError) {
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
      } else if (error instanceof Error) {
        errorMessage = error.message;
        // Keep generic denied status for Capacitor errors
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        permissionStatus: status,
      }));

      return false;
    }
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
 * Primary: internal OpenWeather-powered API
 * Fallback: Nominatim (free, no API key required)
 */
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; state: string }> {
  // Try our internal API first
  try {
    const response = await fetch(getApiUrl(`/api/geocode/reverse?lat=${lat}&lon=${lon}`));
    if (response.ok) {
      const data = await response.json();
      if (data.name && data.name !== "Unknown") {
        return { city: data.name, state: data.state || "" };
      }
    }
  } catch (error) {
    console.warn("[Geolocation] Primary reverse geocode failed:", error);
  }

  // Fallback: Nominatim (free, works without API key)
  try {
    console.log("[Geolocation] Trying Nominatim fallback...");
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { "Accept": "application/json" } }
    );
    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
      const state = addr.state || "";
      // Extract state code (e.g., "Texas" -> "TX") or use first 2 chars
      const stateCode = addr["ISO3166-2-lvl4"]?.split("-")[1] || state.substring(0, 2).toUpperCase();
      if (city) {
        return { city, state: stateCode };
      }
    }
  } catch (error) {
    console.warn("[Geolocation] Nominatim fallback failed:", error);
  }

  // Last resort: use coordinate-based display instead of misleading "Current Location"
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return { city: `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`, state: "" };
}

export default useGeolocation;
