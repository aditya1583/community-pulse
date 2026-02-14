"use client";

import React from "react";
import LocalDealsSection from "./LocalDealsSection";
import TabPulseInput from "./TabPulseInput";

type LocalTabProps = {
  cityName: string;
  state: string;
  lat?: number;
  lon?: number;
  userId?: string | null;
  onSignInClick?: () => void;
  isSignedIn?: boolean;
  identityReady?: boolean;
  displayName?: string;
  pulseLoading?: boolean;
  pulseMood?: string;
  pulseMessage?: string;
  moodValidationError?: string | null;
  messageValidationError?: string | null;
  showValidationErrors?: boolean;
  onMoodChange?: (mood: string) => void;
  onMessageChange?: (message: string) => void;
  onSubmit?: () => void;
};

export default function LocalTab({
  cityName,
  state,
  lat,
  lon,
  onSignInClick,
  isSignedIn = false,
  identityReady = false,
  displayName = "",
  pulseLoading = false,
  pulseMood = "",
  pulseMessage = "",
  moodValidationError = null,
  messageValidationError = null,
  showValidationErrors = false,
  onMoodChange,
  onMessageChange,
  onSubmit,
}: LocalTabProps) {
  return (
    <div className="space-y-4">
      {/* Drop a Local Pulse */}
      {onMoodChange && onMessageChange && onSubmit && onSignInClick && (
        <TabPulseInput
          category="General"
          cityName={cityName}
          mood={pulseMood}
          message={pulseMessage}
          displayName={displayName}
          isSignedIn={isSignedIn}
          identityReady={identityReady}
          loading={pulseLoading}
          moodValidationError={moodValidationError}
          messageValidationError={messageValidationError}
          showValidationErrors={showValidationErrors}
          onMoodChange={onMoodChange}
          onMessageChange={onMessageChange}
          onSubmit={onSubmit}
          onSignInClick={onSignInClick}
        />
      )}

      {/* Local Businesses & Places */}
      <LocalDealsSection
        cityName={cityName}
        state={state}
        lat={lat}
        lon={lon}
        isSignedIn={isSignedIn}
        onSignInClick={onSignInClick}
      />
    </div>
  );
}
