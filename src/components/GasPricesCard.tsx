"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { GasPrices } from "./types";

type GasStation = {
  id: string;
  name: string;
  brand: string | null;
  address: string | null;
  distanceMiles: number;
  lat: number;
  lon: number;
  amenities: string[];
};

type GasPricesCardProps = {
  state: string;
  cityName?: string;
  lat?: number;
  lon?: number;
};

export default function GasPricesCard({ state, cityName, lat, lon }: GasPricesCardProps) {
  const [prices, setPrices] = useState<GasPrices | null>(null);
  const [stations, setStations] = useState<GasStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStations, setShowStations] = useState(false);

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/gas-prices?state=${encodeURIComponent(state)}`);
      const data = await response.json();

      if (data.error && !data.regular) {
        setError(data.error);
        setPrices(null);
      } else {
        setPrices(data);
      }
    } catch (err) {
      console.error("Error fetching gas prices:", err);
      setError("Unable to load gas prices");
      setPrices(null);
    } finally {
      setLoading(false);
    }
  }, [state]);

  const fetchStations = useCallback(async () => {
    if (!lat || !lon) return;

    try {
      setStationsLoading(true);
      const response = await fetch(`/api/gas-stations?lat=${lat}&lon=${lon}&limit=8`);
      const data = await response.json();

      if (data.stations) {
        setStations(data.stations);
      }
    } catch (err) {
      console.error("Error fetching stations:", err);
    } finally {
      setStationsLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Fetch closest station automatically on mount (for main card display)
  useEffect(() => {
    if (lat && lon && stations.length === 0) {
      fetchStations();
    }
  }, [lat, lon, fetchStations, stations.length]);

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  const getChangeIndicator = (change: number | null | undefined) => {
    if (!change || change === 0) return null;
    if (change > 0) {
      return (
        <span className="text-red-400 text-[10px] flex items-center">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          +{change.toFixed(2)}
        </span>
      );
    }
    return (
      <span className="text-emerald-400 text-[10px] flex items-center">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {change.toFixed(2)}
      </span>
    );
  };

  const openDirections = (station: GasStation) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <span className="text-lg">⛽</span>
          Gas Prices
          {prices?.regionName && (
            <span className="text-xs text-slate-400">({prices.regionName})</span>
          )}
        </h3>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center animate-pulse">
                <div className="h-4 w-12 mx-auto bg-slate-700/50 rounded mb-2" />
                <div className="h-6 w-14 mx-auto bg-slate-700/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">⛽</div>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchPrices}
            className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Prices Card */}
      {!loading && !error && prices && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          {/* Main Prices Grid */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Regular</p>
              <p className="text-lg font-bold text-white">{formatPrice(prices.regular)}</p>
              {getChangeIndicator(prices.regularChange)}
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Midgrade</p>
              <p className="text-lg font-bold text-slate-300">{formatPrice(prices.midgrade)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Premium</p>
              <p className="text-lg font-bold text-slate-300">{formatPrice(prices.premium)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Diesel</p>
              <p className="text-lg font-bold text-amber-400">{formatPrice(prices.diesel)}</p>
            </div>
          </div>

          {/* Averages Comparison */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-700/50 text-xs">
            {prices.stateAvg && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">State Avg:</span>
                <span className="text-slate-300 font-medium">{formatPrice(prices.stateAvg)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">National Avg:</span>
              <span className="text-slate-300 font-medium">{formatPrice(prices.nationalAvg)}</span>
            </div>
          </div>

          {/* Last Updated */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/30">
            <p className="text-[10px] text-slate-500">
              Updated {new Date(prices.lastUpdated).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              })}
            </p>
          </div>

          {/* Closest Station - Featured */}
          {stations.length > 0 && (
            <button
              onClick={() => openDirections(stations[0])}
              className="w-full mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between group hover:bg-slate-700/20 -mx-4 px-4 pb-1 rounded-b-xl transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-400 text-sm">⛽</span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-400">Closest Station</p>
                  <p className="text-sm font-medium text-white truncate max-w-[180px]">
                    {stations[0].name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-emerald-400 font-medium">
                  {stations[0].distanceMiles} mi
                </span>
                <svg
                  className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )}

          {/* Loading closest station */}
          {stationsLoading && stations.length === 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center gap-2 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50" />
              <div className="flex-1">
                <div className="h-3 w-20 bg-slate-700/50 rounded mb-1" />
                <div className="h-4 w-32 bg-slate-700/50 rounded" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nearby Stations Toggle */}
      {lat && lon && stations.length > 1 && (
        <button
          onClick={() => setShowStations(!showStations)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-white text-sm transition"
        >
          {showStations ? "Hide other stations" : `See ${stations.length - 1} more stations nearby`}
          <svg
            className={`w-4 h-4 transition-transform ${showStations ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Stations List */}
      {showStations && (
        <div className="space-y-2">
          {stationsLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 animate-pulse">
                  <div className="h-4 w-32 bg-slate-700/50 rounded mb-2" />
                  <div className="h-3 w-48 bg-slate-700/50 rounded" />
                </div>
              ))}
            </div>
          )}

          {!stationsLoading && stations.length === 0 && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-sm">No gas stations found nearby</p>
              <a
                href={`https://www.google.com/maps/search/gas+stations+near+${encodeURIComponent(cityName || state)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-emerald-400 hover:text-emerald-300"
              >
                Search on Google Maps →
              </a>
            </div>
          )}

          {!stationsLoading && stations.length > 1 && (
            <>
              {stations.slice(1).map((station) => (
                <button
                  key={station.id}
                  onClick={() => openDirections(station)}
                  className="w-full text-left bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 hover:border-emerald-500/30 hover:bg-slate-800/80 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-white text-sm truncate">
                        {station.name}
                      </h4>
                      {station.address && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {station.address}
                        </p>
                      )}
                      {station.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {station.amenities.slice(0, 3).map((amenity, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 text-[9px] bg-slate-700/50 text-slate-400 rounded"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-slate-400">
                        {station.distanceMiles} mi
                      </span>
                      <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                        Directions
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              <p className="text-center text-[10px] text-slate-500 pt-1">
                Station data from OpenStreetMap
              </p>
            </>
          )}
        </div>
      )}

      {/* EIA Attribution */}
      <div className="text-center">
        <p className="text-[10px] text-slate-500">
          Price data from{" "}
          <a
            href="https://www.eia.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-emerald-400 transition"
          >
            U.S. Energy Information Administration
          </a>
        </p>
      </div>
    </div>
  );
}
