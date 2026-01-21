/**
 * NotificationSettings Component
 *
 * UI for managing Bat Signal notification preferences.
 * Allows users to:
 * - Enable/disable push notifications
 * - Toggle specific alert types (spikes, vibe shifts, keywords)
 * - Configure keyword alerts
 * - Set quiet hours
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePushNotifications, type NotificationPreferences } from "@/hooks/usePushNotifications";

type NotificationSettingsProps = {
  city: string;
  getAuthToken: () => Promise<string | null>;
  isAuthenticated: boolean;
  onClose?: () => void;
};

export default function NotificationSettings({
  city,
  getAuthToken,
  isAuthenticated,
  onClose,
}: NotificationSettingsProps) {
  const {
    isSupported,
    isLoading,
    permission,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications(city, getAuthToken);

  // Preferences state
  const [vibeShiftsEnabled, setVibeShiftsEnabled] = useState(true);
  const [spikeAlertsEnabled, setSpikeAlertsEnabled] = useState(true);
  const [keywordAlertsEnabled, setKeywordAlertsEnabled] = useState(false);
  const [alertKeywords, setAlertKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");

  // Load existing preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!isAuthenticated) return;

      const token = await getAuthToken();
      if (!token) return;

      try {
        const response = await fetch(
          `/api/notifications/preferences?city=${encodeURIComponent(city)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const { preferences } = await response.json();
          if (preferences) {
            setVibeShiftsEnabled(preferences.vibe_shifts_enabled ?? true);
            setSpikeAlertsEnabled(preferences.spike_alerts_enabled ?? true);
            setKeywordAlertsEnabled(preferences.keyword_alerts_enabled ?? false);
            setAlertKeywords(preferences.alert_keywords || []);
            if (preferences.quiet_hours_start && preferences.quiet_hours_end) {
              setQuietHoursEnabled(true);
              setQuietStart(preferences.quiet_hours_start);
              setQuietEnd(preferences.quiet_hours_end);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load preferences:", err);
      }
    }

    loadPreferences();
  }, [city, isAuthenticated, getAuthToken]);

  // Save preferences when they change
  const savePreferences = useCallback(async () => {
    if (!isAuthenticated) return;

    const token = await getAuthToken();
    if (!token) return;

    const preferences: NotificationPreferences = {
      vibe_shifts_enabled: vibeShiftsEnabled,
      spike_alerts_enabled: spikeAlertsEnabled,
      keyword_alerts_enabled: keywordAlertsEnabled,
      alert_keywords: alertKeywords,
      quiet_hours_start: quietHoursEnabled ? quietStart : null,
      quiet_hours_end: quietHoursEnabled ? quietEnd : null,
    };

    try {
      await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ city, ...preferences }),
      });
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
  }, [
    city,
    isAuthenticated,
    getAuthToken,
    vibeShiftsEnabled,
    spikeAlertsEnabled,
    keywordAlertsEnabled,
    alertKeywords,
    quietHoursEnabled,
    quietStart,
    quietEnd,
  ]);

  // Handle subscription toggle
  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const success = await subscribe({
        vibe_shifts_enabled: vibeShiftsEnabled,
        spike_alerts_enabled: spikeAlertsEnabled,
        keyword_alerts_enabled: keywordAlertsEnabled,
        alert_keywords: alertKeywords,
        quiet_hours_start: quietHoursEnabled ? quietStart : null,
        quiet_hours_end: quietHoursEnabled ? quietEnd : null,
      });
      if (!success) {
        // Error is handled by the hook
      }
    }
  };

  // Add a keyword
  const handleAddKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword && !alertKeywords.includes(keyword)) {
      const updated = [...alertKeywords, keyword];
      setAlertKeywords(updated);
      setNewKeyword("");
      // Save immediately
      setTimeout(savePreferences, 0);
    }
  };

  // Remove a keyword
  const handleRemoveKeyword = (keyword: string) => {
    const updated = alertKeywords.filter((k) => k !== keyword);
    setAlertKeywords(updated);
    setTimeout(savePreferences, 0);
  };

  const cityName = city.split(",")[0].trim();

  // Not supported message
  if (!isSupported) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Notifications</h3>
        <p className="text-gray-400 text-sm">
          Push notifications are not supported in this browser. Try using Chrome, Firefox, or Edge on desktop.
        </p>
      </div>
    );
  }

  // Permission denied message
  if (permission === "denied") {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Notifications Blocked</h3>
        <p className="text-gray-400 text-sm">
          Notification permission was denied. To enable notifications, you need to allow them in your browser settings.
        </p>
      </div>
    );
  }

  // Not authenticated message
  if (!isAuthenticated) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Bat Signal Alerts</h3>
        <p className="text-gray-400 text-sm mb-4">
          Get notified when something is happening in {cityName}. Sign in to enable notifications.
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="text-2xl">🦇</span>
          <span>
            Spike alerts, vibe shifts, and keyword tracking
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦇</span>
          <h3 className="text-lg font-semibold text-white">Bat Signal</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-400 p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Master toggle */}
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-800">
        <div>
          <p className="text-white font-medium">
            {isSubscribed ? `Watching ${cityName}` : `Watch ${cityName}`}
          </p>
          <p className="text-gray-500 text-sm">
            {isSubscribed
              ? "You will receive alerts for this city"
              : "Get notified when something happens"}
          </p>
        </div>
        <button
          onClick={handleToggleNotifications}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSubscribed ? "bg-cyan-500" : "bg-gray-700"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSubscribed ? "translate-x-6" : "translate-x-1"
              }`}
          />
        </button>
      </div>

      {/* Alert type toggles */}
      <div className="space-y-4 mb-6">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Alert Types
        </h4>

        {/* Spike Alerts */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Spike Alerts</p>
            <p className="text-gray-500 text-xs">
              Something is happening (200%+ activity spike)
            </p>
          </div>
          <button
            onClick={() => {
              setSpikeAlertsEnabled(!spikeAlertsEnabled);
              setTimeout(savePreferences, 0);
            }}
            disabled={!isSubscribed}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${spikeAlertsEnabled && isSubscribed ? "bg-cyan-500" : "bg-gray-700"
              } ${!isSubscribed ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${spikeAlertsEnabled ? "translate-x-5" : "translate-x-1"
                }`}
            />
          </button>
        </div>

        {/* Vibe Shifts */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Vibe Shifts</p>
            <p className="text-gray-500 text-xs">
              The city mood changed significantly
            </p>
          </div>
          <button
            onClick={() => {
              setVibeShiftsEnabled(!vibeShiftsEnabled);
              setTimeout(savePreferences, 0);
            }}
            disabled={!isSubscribed}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${vibeShiftsEnabled && isSubscribed ? "bg-cyan-500" : "bg-gray-700"
              } ${!isSubscribed ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${vibeShiftsEnabled ? "translate-x-5" : "translate-x-1"
                }`}
            />
          </button>
        </div>

        {/* Keyword Alerts */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Keyword Alerts</p>
            <p className="text-gray-500 text-xs">
              Multiple people mention specific topics
            </p>
          </div>
          <button
            onClick={() => {
              setKeywordAlertsEnabled(!keywordAlertsEnabled);
              setTimeout(savePreferences, 0);
            }}
            disabled={!isSubscribed}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${keywordAlertsEnabled && isSubscribed ? "bg-cyan-500" : "bg-gray-700"
              } ${!isSubscribed ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${keywordAlertsEnabled ? "translate-x-5" : "translate-x-1"
                }`}
            />
          </button>
        </div>
      </div>

      {/* Keyword configuration */}
      {keywordAlertsEnabled && isSubscribed && (
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-3">Watch Keywords</h4>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              placeholder="e.g., police, fire, accident"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleAddKeyword}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>

          {alertKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {alertKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-full text-sm text-gray-300"
                >
                  {keyword}
                  <button
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-xs">
              Add keywords to get alerted when 3+ people mention them
            </p>
          )}
        </div>
      )}

      {/* Quiet Hours */}
      {isSubscribed && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white text-sm font-medium">Quiet Hours</p>
              <p className="text-gray-500 text-xs">
                Don&apos;t send notifications during these times
              </p>
            </div>
            <button
              onClick={() => {
                setQuietHoursEnabled(!quietHoursEnabled);
                setTimeout(savePreferences, 0);
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${quietHoursEnabled ? "bg-cyan-500" : "bg-gray-700"
                }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${quietHoursEnabled ? "translate-x-5" : "translate-x-1"
                  }`}
              />
            </button>
          </div>

          {quietHoursEnabled && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={quietStart}
                onChange={(e) => {
                  setQuietStart(e.target.value);
                  setTimeout(savePreferences, 0);
                }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              />
              <span className="text-gray-500">to</span>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => {
                  setQuietEnd(e.target.value);
                  setTimeout(savePreferences, 0);
                }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          )}
        </div>
      )}

      {/* Info text */}
      <p className="text-gray-500 text-xs">
        Bat Signal alerts you when something noteworthy happens in {cityName}.
        We never spam - you only get notified when there is something worth knowing.
      </p>
    </div>
  );
}
