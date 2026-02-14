"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  readOnboardingCompleted,
  writeOnboardingCompleted,
} from "@/lib/pulses";

type StreakInfo = {
  currentStreak: number;
  lastActiveDate: string | null;
};

export function useStreak(userId: string | undefined) {
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [, setStreakLoading] = useState(false);
  const [userPulseCount, setUserPulseCount] = useState(0);
  const [pulseCountResolved, setPulseCountResolved] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Reset on user change
  useEffect(() => {
    setPulseCountResolved(false);

    if (!userId) {
      setOnboardingCompleted(false);
      return;
    }

    setOnboardingCompleted(readOnboardingCompleted(window.localStorage, userId));
  }, [userId]);

  const loadStreak = useCallback(async () => {
    if (!userId) {
      setStreakInfo(null);
      setUserPulseCount(0);
      setStreakLoading(false);
      setPulseCountResolved(false);
      return;
    }

    try {
      setStreakLoading(true);
      setPulseCountResolved(false);

      const { data, error, count } = await supabase
        .from("pulses")
        .select("created_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(365);

      if (error) {
        console.error("Error loading streak data:", error);
        return;
      }

      const rows = data || [];
      const nextCount = count ?? rows.length;
      setUserPulseCount(nextCount);
      setPulseCountResolved(true);

      if (nextCount > 0 && !onboardingCompleted) {
        writeOnboardingCompleted(window.localStorage, userId);
        setOnboardingCompleted(true);
      }

      if (rows.length === 0) {
        setStreakInfo({ currentStreak: 0, lastActiveDate: null });
        return;
      }

      const dateStrings = Array.from(
        new Set(
          rows.map((row: { created_at: string }) => {
            const d = new Date(row.created_at);
            return d.toLocaleDateString("en-CA");
          })
        )
      ).sort((a, b) => (a < b ? 1 : -1));

      let streak = 0;
      let offsetDays = 0;

      function offsetDate(days: number) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toLocaleDateString("en-CA");
      }

      const todayStr = new Date().toLocaleDateString("en-CA");

      for (const dayStr of dateStrings) {
        const expected = offsetDate(offsetDays);

        if (dayStr === expected) {
          streak += 1;
          offsetDays += 1;
        } else {
          if (streak === 0 && dayStr === offsetDate(1) && todayStr !== dayStr) {
            streak = 1;
            offsetDays = 2;
          } else {
            break;
          }
        }
      }

      const lastActive = dateStrings[0] ?? null;

      setStreakInfo({
        currentStreak: streak,
        lastActiveDate: lastActive,
      });
    } catch (err) {
      console.error("Unexpected error loading streak:", err);
    } finally {
      setStreakLoading(false);
    }
  }, [userId, onboardingCompleted]);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  return {
    streakInfo,
    userPulseCount,
    setUserPulseCount,
    pulseCountResolved,
    setPulseCountResolved,
    onboardingCompleted,
    setOnboardingCompleted,
    loadStreak,
  };
}
