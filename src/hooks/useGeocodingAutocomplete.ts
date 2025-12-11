"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeApiResponse, GeocodedCity } from "@/lib/geocoding";

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

  useEffect(() => {
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
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/geocode?query=${encodeURIComponent(trimmed)}&limit=${limit}`,
          { signal: controller.signal }
        );

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
        if (controller.signal.aborted) return;
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
    };
  }, [inputValue, minLength, debounceMs, limit]);

  const selectCity = (city: GeocodedCity) => {
    setInputValue(city.displayName);
    setSuggestions([]);
    setNotFound(false);
    setHighlightedIndex(-1);
    setOpen(false);
  };

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
