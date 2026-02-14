"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getApiUrl } from "@/lib/api-config";
import type { Profile } from "@/hooks/useAuth";

interface UseUsernameOptions {
  sessionUser: { id: string } | null;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  username: string;
  setUsername: (u: string) => void;
}

export function useUsername({ sessionUser, profile, setProfile, username, setUsername }: UseUsernameOptions) {
  const [usernamePrompt, setUsernamePrompt] = useState("");
  const [usernameGenerating, setUsernameGenerating] = useState(false);
  const [usernameErrorMsg, setUsernameErrorMsg] = useState<string | null>(null);
  const [showUsernameEditor, setShowUsernameEditor] = useState(false);
  const [lastAnonName, setLastAnonName] = useState<string | null>(null);

  async function handleLockUsername() {
    if (!sessionUser || !profile) return;

    try {
      setUsernameGenerating(true);
      setUsernameErrorMsg(null);

      const { error } = await supabase
        .from("profiles")
        .update({ name_locked: true })
        .eq("id", sessionUser.id);

      if (error) {
        console.error("Error locking username:", error);
        setUsernameErrorMsg("Could not lock name right now. Try again.");
        return;
      }

      setProfile((prev) =>
        prev ? { ...prev, name_locked: true } : prev
      );
    } catch (err) {
      console.error("Unexpected error locking username:", err);
      setUsernameErrorMsg("Could not lock name right now.");
    } finally {
      setUsernameGenerating(false);
    }
  }

  async function handleGenerateUsername() {
    const prompt = usernamePrompt.trim();
    if (!sessionUser) return;

    if (profile?.name_locked) {
      setUsernameErrorMsg("Your anonymous name is locked and can't be changed.");
      return;
    }

    const wordCount = prompt.split(/\s+/).filter(Boolean).length;
    if (wordCount < 3) {
      setUsernameErrorMsg("Use at least 3 words to describe your vibe.");
      return;
    }

    try {
      setUsernameGenerating(true);
      setUsernameErrorMsg(null);

      const res = await fetch(getApiUrl("/api/username"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok || !data.username) {
        throw new Error(data.error || "Could not generate username.");
      }

      const newName: string = data.username;

      setLastAnonName(profile?.anon_name || username || null);

      const updatedProfileName = newName;

      setProfile((prev) =>
        prev
          ? { ...prev, anon_name: updatedProfileName }
          : { anon_name: updatedProfileName }
      );
      setUsername(updatedProfileName);

      const userId = sessionUser.id;
      const { error } = await supabase
        .from("profiles")
        .update({ anon_name: updatedProfileName })
        .eq("id", userId);

      if (error) {
        console.error("Error updating profile anon_name:", error);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to generate a name right now.";
      console.error("Error generating username:", err);
      setUsernameErrorMsg(message);
    } finally {
      setUsernameGenerating(false);
    }
  }

  async function handleRevertUsername() {
    if (!sessionUser || !lastAnonName) return;

    try {
      setUsernameGenerating(true);
      setUsernameErrorMsg(null);

      setProfile((prev) =>
        prev ? { ...prev, anon_name: lastAnonName } : { anon_name: lastAnonName }
      );
      setUsername(lastAnonName);

      const { error } = await supabase
        .from("profiles")
        .update({ anon_name: lastAnonName })
        .eq("id", sessionUser.id);

      if (error) {
        console.error("Error reverting anon_name:", error);
      } else {
        setLastAnonName(null);
      }
    } catch (err) {
      console.error("Error reverting username:", err);
      setUsernameErrorMsg("Unable to revert name right now.");
    } finally {
      setUsernameGenerating(false);
    }
  }

  return {
    usernamePrompt,
    setUsernamePrompt,
    usernameGenerating,
    usernameErrorMsg,
    showUsernameEditor,
    setShowUsernameEditor,
    lastAnonName,
    handleLockUsername,
    handleGenerateUsername,
    handleRevertUsername,
  };
}
