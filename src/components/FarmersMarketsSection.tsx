"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { FarmersMarket } from "./types";

type FarmersMarketsSectionProps = {
  cityName: string;
  state?: string;
  lat?: number;
  lon?: number;
};

export default function FarmersMarketsSection({
  cityName,
  state,
  lat,
  lon,
}: FarmersMarketsSectionProps) {
  const [markets, setMarkets] = useState<FarmersMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchUrl, setSearchUrl] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"usda" | "foursquare" | "osm" | null>(null);

  const fetchMarkets = useCallback(async () => {
    console.log(`[FarmersMarkets] Fetching markets for ${cityName}, ${state}, coords: ${lat},${lon}`);
    try {
      setLoading(true);
      setError(null);
      setSearchUrl(null);
      setDataSource(null);

      let url = `/api/farmers-markets?city=${encodeURIComponent(cityName)}`;
      if (state) url += `&state=${encodeURIComponent(state)}`;
      if (lat && lon) url += `&lat=${lat}&lon=${lon}`;

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      console.log("[FarmersMarkets] API response:", data);

      if (data.searchUrl) {
        setSearchUrl(data.searchUrl);
      }

      if (data.error && (!data.markets || data.markets.length === 0)) {
        setError(data.error);
        setMarkets([]);
      } else {
        setMarkets(data.markets || []);
        if (data.source) {
          setDataSource(data.source);
        }
      }
    } catch (err) {
      console.error("Error fetching markets:", err);
      setError("Unable to load farmers markets");
      setSearchUrl(`https://www.google.com/maps/search/farmers+markets+near+${encodeURIComponent(cityName)}`);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [cityName, state, lat, lon]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <span className="text-lg">🥬</span>
          Farmers Markets Near You
        </h3>
        <button
          onClick={fetchMarkets}
          disabled={loading}
          className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 animate-pulse">
              <div className="flex items-start justify-between mb-2">
                <div className="h-5 w-40 bg-slate-700/50 rounded" />
                <div className="h-5 w-20 bg-slate-700/50 rounded" />
              </div>
              <div className="h-4 w-32 bg-slate-700/50 rounded mb-2" />
              <div className="h-3 w-48 bg-slate-700/50 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">🌽</div>
          <p className="text-slate-400 text-sm mb-3">No farmers markets found in the USDA database for this area.</p>
          {searchUrl && (
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm rounded-lg transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search on Google Maps
            </a>
          )}
          <button
            onClick={fetchMarkets}
            className="block mx-auto mt-3 text-xs text-slate-500 hover:text-slate-400"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && markets.length === 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-slate-400 text-sm mb-3">No farmers markets found in the USDA database for this area.</p>
          <a
            href={`https://www.google.com/maps/search/farmers+markets+near+${encodeURIComponent(cityName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search on Google Maps
          </a>
        </div>
      )}

      {/* Markets List */}
      {!loading && !error && markets.length > 0 && (
        <div className="space-y-3">
          {markets.map((market) => (
            <div
              key={market.id}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-emerald-500/30 transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-white text-sm">
                  {market.name}
                </h4>
                {market.isOpenToday && (
                  <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Open Today
                  </span>
                )}
              </div>

              {/* Schedule */}
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{market.schedule}</span>
              </div>

              {/* Address - Clickable to Google Maps */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(market.name + ' ' + market.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-slate-500 mb-3 hover:text-emerald-400 transition group"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="truncate">{market.address}</span>
                {market.distance && (
                  <span className="flex-shrink-0 text-slate-400">. {market.distance.toFixed(1)} mi</span>
                )}
                <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>

              {/* Products */}
              <div className="flex flex-wrap gap-1.5">
                {market.products.slice(0, 5).map((product, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full"
                  >
                    {product}
                  </span>
                ))}
              </div>

              {/* Links - Always show Directions */}
              <div className="flex gap-3 mt-3 pt-3 border-t border-slate-700/50">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(market.name + ' ' + market.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                  Directions
                </a>
                {market.website && (
                  <a
                    href={market.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 6.364l4.5 4.5a4.5 4.5 0 006.364-6.364l-1.757-1.757" />
                    </svg>
                    Website
                  </a>
                )}
                {market.facebook && (
                  <a
                    href={market.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data Source Attribution */}
      {markets.length > 0 && (
        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-500">
            Market data from{" "}
            {dataSource === "osm" ? (
              <a
                href="https://www.openstreetmap.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition"
              >
                OpenStreetMap
              </a>
            ) : dataSource === "foursquare" ? (
              <a
                href="https://foursquare.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition"
              >
                Foursquare
              </a>
            ) : (
              <a
                href="https://www.usdalocalfoodportal.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 transition"
              >
                USDA Local Food Directories
              </a>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
