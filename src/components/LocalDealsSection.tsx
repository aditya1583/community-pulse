"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { LocalDeal } from "./types";

type LocalDealsSectionProps = {
  cityName: string;
  lat?: number;
  lon?: number;
};

const CATEGORIES = [
  { id: "all", label: "All", emoji: "🌟" },
  { id: "restaurants", label: "Food", emoji: "🍽️" },
  { id: "coffee", label: "Coffee", emoji: "☕" },
  { id: "bars", label: "Bars", emoji: "🍺" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "beauty", label: "Beauty", emoji: "💇" },
  { id: "fitness", label: "Fitness", emoji: "💪" },
];

export default function LocalDealsSection({
  cityName,
  lat,
  lon,
}: LocalDealsSectionProps) {
  const [deals, setDeals] = useState<LocalDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/local-deals?city=${encodeURIComponent(cityName)}&category=${selectedCategory}`;
      if (lat && lon) {
        url += `&lat=${lat}&lon=${lon}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.error && data.businesses.length === 0) {
        setError(data.error);
        setDeals([]);
      } else {
        setDeals(data.businesses || []);
      }
    } catch (err) {
      console.error("Error fetching deals:", err);
      setError("Unable to load local deals");
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [cityName, lat, lon, selectedCategory]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Render stars for rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="text-amber-400">★</span>);
    }
    if (hasHalf) {
      stars.push(<span key="half" className="text-amber-400/50">★</span>);
    }
    for (let i = stars.length; i < 5; i++) {
      stars.push(<span key={i} className="text-slate-600">★</span>);
    }

    return stars;
  };

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              selectedCategory === cat.id
                ? "bg-emerald-500 text-white"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 border border-slate-700/50"
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-slate-700/50 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 w-32 bg-slate-700/50 rounded mb-2" />
                  <div className="h-4 w-24 bg-slate-700/50 rounded mb-2" />
                  <div className="h-3 w-48 bg-slate-700/50 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">🏪</div>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchDeals}
            className="mt-3 text-xs text-emerald-400 hover:text-emerald-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && deals.length === 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-slate-400 text-sm">No deals found in this category</p>
          <p className="text-slate-500 text-xs mt-1">Try a different category or check back later</p>
        </div>
      )}

      {/* Deals Grid */}
      {!loading && !error && deals.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {deals.map((deal) => (
            <a
              key={deal.id}
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-emerald-500/30 transition"
            >
              <div className="flex gap-4">
                {/* Image */}
                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-700">
                  {deal.imageUrl ? (
                    <img
                      src={deal.imageUrl}
                      alt={deal.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      🏪
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white text-sm truncate">
                      {deal.name}
                    </h3>
                    <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      deal.isOpen
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {deal.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex text-xs">
                      {renderStars(deal.rating)}
                    </div>
                    <span className="text-xs text-slate-400">
                      {deal.rating.toFixed(1)} ({deal.reviewCount})
                    </span>
                    {deal.priceLevel && (
                      <span className="text-xs text-emerald-400 ml-1">
                        {deal.priceLevel}
                      </span>
                    )}
                  </div>

                  {/* Categories */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {deal.categories.slice(0, 2).map((cat, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 text-[10px] bg-slate-700/50 text-slate-400 rounded"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Address & Distance */}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                    <span className="truncate">{deal.address}</span>
                    {deal.distance && (
                      <span className="flex-shrink-0">. {deal.distance} mi</span>
                    )}
                  </div>

                  {/* Transaction badges */}
                  {deal.transactions.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {deal.transactions.includes("delivery") && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
                          Delivery
                        </span>
                      )}
                      {deal.transactions.includes("pickup") && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                          Pickup
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Yelp Attribution */}
      <div className="text-center pt-2">
        <p className="text-[10px] text-slate-500">
          Business data powered by{" "}
          <a
            href="https://www.yelp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-red-400 transition"
          >
            Yelp
          </a>
        </p>
      </div>
    </div>
  );
}
