"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeocodeApiResponse, GeocodedCity } from "@/lib/geocoding";
import { getApiUrl } from "@/lib/api-config";

type Options = {
  minLength?: number;
  debounceMs?: number;
  limit?: number;
};

export function useGeocodingAutocomplete(options: Options = {}) {
  const { minLength = 3, debounceMs = 300, limit = 7 } = options;

  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodedCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const lastRequestId = useRef(0);
  // Flag to skip searches (used when setting input programmatically via geo/selection)
  // Uses a timestamp so it persists across multiple rapid re-renders
  const skipSearchUntil = useRef(0);

  useEffect(() => {
    // Check if we should skip this search (programmatic input)
    if (Date.now() < skipSearchUntil.current) {
      return;
    }

    const trimmed = inputValue.trim();

    if (trimmed.length < minLength) {
      setSuggestions([]);
      setNotFound(false);
      setError(null);
      setHighlightedIndex(-1);
      return;
    }

    const requestId = ++lastRequestId.current;
    const controller = new AbortController();

    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          getApiUrl(`/api/geocode?query=${encodeURIComponent(trimmed)}&limit=${limit}`),
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);
        const data = (await res.json()) as GeocodeApiResponse;

        if (!res.ok) {
          throw new Error(data.error || "Unable to search for cities right now.");
        }

        if (controller.signal.aborted || requestId !== lastRequestId.current) {
          return;
        }

        const results = data.results || [];
        setSuggestions(results);
        setNotFound(results.length === 0);
        setError(data.error ?? null);
        setHighlightedIndex(results.length ? 0 : -1);
        setOpen(true);
      } catch (err) {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) {
          // Even on abort, clear loading state to prevent stuck "Searching..."
          setLoading(false);
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "Unable to reach the geocoding service right now.";
        setError(message);
        setSuggestions([]);
        setNotFound(false);
        setHighlightedIndex(-1);
      } finally {
        if (!controller.signal.aborted && requestId === lastRequestId.current) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(timeoutId);
      // Clear loading state on cleanup to prevent stuck "Searching..."
      setLoading(false);
    };
  }, [inputValue, minLength, debounceMs, limit]);

  const selectCity = useCallback((city: GeocodedCity) => {
    // Skip searches for 1 second — prevents debounced searches from reopening dropdown
    skipSearchUntil.current = Date.now() + 1000;
    setInputValue(city.displayName);
    setSuggestions([]);
    setNotFound(false);
    setHighlightedIndex(-1);
    setOpen(false);
    setLoading(false);
    setError(null);
  }, []);

  const clearSuggestions = () => {
    setSuggestions([]);
    setNotFound(false);
    setHighlightedIndex(-1);
    setOpen(false);
  };

  const commitInput = () => {
    setOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setNotFound(false);
  };

  return {
    inputValue,
    setInputValue,
    suggestions,
    selectCity,
    loading,
    error,
    notFound,
    open,
    setOpen,
    highlightedIndex,
    setHighlightedIndex,
    clearSuggestions,
    commitInput,
  };
}
