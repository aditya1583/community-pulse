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
    // Use station name + address for better UX (shows business name, not coordinates)
    const destination = station.address
      ? `${station.name} ${station.address}`
      : `${station.lat},${station.lon}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl shadow-inner border border-amber-500/20">
            ⛽
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Gas Prices</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {prices?.regionName || state} Market
            </p>
          </div>
        </div>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-[0.15em] rounded-xl border border-white/5 transition-all duration-300 disabled:opacity-30"
        >
          {loading ? "Syncing..." : "Refresh"}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="glass-card premium-border rounded-3xl p-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center animate-pulse">
                <div className="h-3 w-10 mx-auto bg-white/5 rounded-full mb-3" />
                <div className="h-6 w-14 mx-auto bg-white/5 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="glass-card border border-red-500/20 bg-red-500/5 rounded-3xl p-8 text-center space-y-4">
          <div className="text-4xl opacity-50">⚠️</div>
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest">{error}</p>
          <button
            onClick={fetchPrices}
            className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/20 transition-all"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Prices Card */}
      {!loading && !error && prices && (
        <div className="glass-card premium-border rounded-[2.5rem] p-6 space-y-6">
          {/* Main Prices Grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Regular", price: prices.regular, change: prices.regularChange, color: "text-white" },
              { label: "Mid", price: prices.midgrade, color: "text-slate-300" },
              { label: "Prem", price: prices.premium, color: "text-slate-300" },
              { label: "Diesel", price: prices.diesel, color: "text-amber-400" },
            ].map((item, idx) => (
              <div key={idx} className="text-center space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                <p className={`text-xl font-black tracking-tighter ${item.color}`}>
                  {formatPrice(item.price)}
                </p>
                {item.change !== undefined && getChangeIndicator(item.change)}
              </div>
            ))}
          </div>

          {/* Comparables */}
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-white/5">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">State Average</span>
              <span className="text-xs font-bold text-slate-400">{prices.stateAvg ? formatPrice(prices.stateAvg) : "N/A"}</span>
            </div>
            <div className="flex flex-col items-center border-l border-white/5">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">National Avg</span>
              <span className="text-xs font-bold text-slate-400">{prices.nationalAvg ? formatPrice(prices.nationalAvg) : "N/A"}</span>
            </div>
          </div>

          {/* Closest Station - Featured */}
          {stations.length > 0 && (
            <button
              onClick={() => openDirections(stations[0])}
              className="group relative overflow-hidden w-full p-4 bg-black/40 hover:bg-black/60 rounded-3xl border border-white/5 transition-all duration-500 text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-500">⛽</div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest mb-0.5">Closest Station</p>
                    <p className="text-[13px] font-bold text-white tracking-tight truncate max-w-[160px]">
                      {stations[0].name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black text-emerald-400 mb-1">{stations[0].distanceMiles} mi</span>
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Tap for Directions</span>
                </div>
              </div>
            </button>
          )}

          {/* Loading closest station */}
          {stationsLoading && stations.length === 0 && (
            <div className="h-20 bg-white/5 rounded-3xl animate-pulse" />
          )}

          <div className="flex justify-center">
            <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">
              Market Update: {new Date(prices.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        </div>
      )}

      {/* Nearby Stations Toggle */}
      {lat && lon && stations.length > 1 && (
        <button
          onClick={() => setShowStations(!showStations)}
          className="w-full py-4 glass-card border border-white/5 hover:border-white/10 rounded-2xl text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2"
        >
          {showStations ? "Collapse Directory" : `View ${stations.length - 1} More Local Stations`}
          <svg
            className={`w-4 h-4 transition-transform duration-500 ${showStations ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Stations List */}
      {showStations && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
          {!stationsLoading && stations.length > 1 && (
            <>
              {stations.slice(1).map((station) => (
                <button
                  key={station.id}
                  onClick={() => openDirections(station)}
                  className="group w-full flex items-center justify-between p-4 glass-card premium-border rounded-2xl hover:bg-white/5 transition-all duration-300 text-left"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="text-[13px] font-bold text-white tracking-tight truncate border-b border-white/5 pb-1 mb-2 group-hover:border-emerald-500/30 transition-colors">
                      {station.name}
                    </h4>
                    {station.address && (
                      <p className="text-[11px] font-medium text-slate-500 truncate mb-2">
                        {station.address}
                      </p>
                    )}
                    {station.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {station.amenities.slice(0, 3).map((amenity, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-black/40 text-slate-600 rounded-md border border-white/5"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors text-center">
                      <span className="text-[10px] font-black text-emerald-400 block">{station.distanceMiles}</span>
                      <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">Miles</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-600 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
              <div className="text-center pt-2">
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em]">Mapping by OpenStreetMap Contributors</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* EIA Attribution */}
      <div className="text-center pt-2">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
          Price intelligence by{" "}
          <a
            href="https://www.eia.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-emerald-400 transition-colors"
          >
            U.S. EIA
          </a>
        </p>
      </div>
    </div>
  );
}
