"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { GasPrices } from "./types";

type GasPricesCardProps = {
  state: string;
};

export default function GasPricesCard({ state }: GasPricesCardProps) {
  const [prices, setPrices] = useState<GasPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Format price
  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  // Get change indicator
  const getChangeIndicator = (change: number | undefined) => {
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
            {/* Regular */}
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Regular</p>
              <p className="text-lg font-bold text-white">{formatPrice(prices.regular)}</p>
              {getChangeIndicator(prices.regularChange)}
            </div>

            {/* Midgrade */}
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Midgrade</p>
              <p className="text-lg font-bold text-slate-300">{formatPrice(prices.midgrade)}</p>
            </div>

            {/* Premium */}
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Premium</p>
              <p className="text-lg font-bold text-slate-300">{formatPrice(prices.premium)}</p>
            </div>

            {/* Diesel */}
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
          <p className="text-[10px] text-slate-500 mt-3 text-center">
            Updated {new Date(prices.lastUpdated).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            })}
          </p>
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
