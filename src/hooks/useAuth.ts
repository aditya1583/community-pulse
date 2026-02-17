"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { authBridge } from "@/lib/authBridge";
import { generateUniqueUsername } from "@/lib/username";
import { getApiUrl } from "@/lib/api-config";
import type { AuthStatus } from "@/lib/pulses";

export type Profile = {
  anon_name: string;
  name_locked?: boolean | null;
};

/** Load profile via server-side endpoint (works in WKWebView) or Supabase JS fallback */
async function loadProfileServerSide(accessToken: string): Promise<{ anon_name: string; name_locked: boolean } | null> {
  try {
    const res = await fetch(getApiUrl("/api/auth/profile"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.profile) {
      return { anon_name: data.profile.anon_name, name_locked: data.profile.name_locked ?? false };
    }
    return null;
  } catch {
    return null;
  }
}

async function createProfileServerSide(accessToken: string, anonName: string): Promise<{ anon_name: string; name_locked: boolean } | null> {
  try {
    const res = await fetch(getApiUrl("/api/auth/profile"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ anon_name: anonName }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.profile) {
      return { anon_name: data.profile.anon_name, name_locked: data.profile.name_locked ?? false };
    }
    return null;
  } catch {
    return null;
  }
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

export function useAuth() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [profileLoading, setProfileLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [needsUsernameChoice, setNeedsUsernameChoice] = useState(false);

  // ========= LOAD SESSION + PROFILE =========
  useEffect(() => {
    async function loadUser() {
      setAuthStatus("loading");
      setProfileLoading(false);

      const { data: auth } = await authBridge.getUser();
      const user = auth.user;
      setSessionUser(user);

      if (!user) {
        setProfile(null);
        setAuthStatus("signed_out");
        return;
      }

      setAuthStatus("signed_in");
      setProfileLoading(true);
      try {
        const token = await authBridge.getAccessToken();
        let profileResult = token ? await loadProfileServerSide(token) : null;

        if (profileResult) {
          setProfile(profileResult);
          if (!profileResult.name_locked) setNeedsUsernameChoice(true);
        } else if (token) {
          const anon = await generateUniqueUsername(supabase);
          profileResult = await createProfileServerSide(token, anon);
          setProfile(profileResult || { anon_name: anon, name_locked: false });
          setNeedsUsernameChoice(true);
        }
      } catch (err) {
        console.error("[Voxlo] Profile load failed:", err);
      } finally {
        setProfileLoading(false);
      }
    }

    loadUser();

    const { data: { subscription } } = authBridge.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          const user = session?.user ?? null;
          setSessionUser(user);
          if (user) {
            setAuthStatus("signed_in");
            try {
              setProfileLoading(true);
              const token = await authBridge.getAccessToken();
              let profileResult = token ? await loadProfileServerSide(token) : null;
              if (profileResult) {
                setProfile(profileResult);
                if (!profileResult.name_locked) setNeedsUsernameChoice(true);
              } else if (token) {
                const anon = await generateUniqueUsername(supabase);
                profileResult = await createProfileServerSide(token, anon);
                setProfile(profileResult || { anon_name: anon, name_locked: false });
                setNeedsUsernameChoice(true);
              }
            } catch (err) {
              console.error("[Voxlo] Profile load in onAuthStateChange failed:", err);
            } finally {
              setProfileLoading(false);
            }
          }
        } else if (event === "SIGNED_OUT") {
          setSessionUser(null);
          setProfile(null);
          setAuthStatus("signed_out");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for sign-in modal requests from child components
  useEffect(() => {
    const handleShowSignIn = () => {
      setShowAuthModal(true);
    };
    window.addEventListener("showSignInModal", handleShowSignIn);
    return () => {
      window.removeEventListener("showSignInModal", handleShowSignIn);
    };
  }, []);

  // Handle deep link from email verification (voxlo://auth/callback#access_token=...)
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appUrlOpen", async ({ url }) => {
          if (url.includes("auth/callback")) {
            const hashIndex = url.indexOf("#");
            if (hashIndex !== -1) {
              const hash = url.substring(hashIndex + 1);
              const params = new URLSearchParams(hash);
              const accessToken = params.get("access_token");
              const refreshToken = params.get("refresh_token");
              if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (!error) {
                  console.log("[Voxlo] Deep link auth success");
                  window.location.reload();
                }
              }
            }
          }
        });
        cleanup = () => listener.remove();
      } catch {
        // Not in Capacitor environment — ignore
      }
    })();
    return () => cleanup?.();
  }, []);

  // Safety timeout: if profileLoading is stuck for >5 seconds, force it to complete
  useEffect(() => {
    if (profileLoading && authStatus === "signed_in" && sessionUser) {
      const timeout = setTimeout(() => {
        console.warn("[Voxlo] Profile loading timeout - forcing ready state");
        setProfileLoading(false);
        setProfile(prev => prev ?? {
          anon_name: `User${sessionUser.id.slice(0, 6)}`,
          name_locked: false,
        });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [profileLoading, authStatus, sessionUser]);

  // ========= AUTH HANDLER =========
  const handleAuth = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const email = authEmail.trim();
    const password = authPassword.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);

      if (authMode === "signup") {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          setAuthError(passwordValidation.error || "Password does not meet requirements.");
          setAuthLoading(false);
          return;
        }

        if (password !== authPasswordConfirm) {
          setAuthError("Passwords do not match.");
          setAuthLoading(false);
          return;
        }

        const { data: signUpData, error: signUpError } = await authBridge.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes("already registered") ||
            signUpError.message.toLowerCase().includes("already exists") ||
            signUpError.message.toLowerCase().includes("user already")) {
            setAuthError("This email is already registered. Please check your email for a confirmation link, or try signing in.");
            return;
          }
          setAuthError(signUpError.message || "Could not create account. Please try again.");
          return;
        }

        if (signUpData.user) {
          const identities = (signUpData.user as { identities?: unknown[] }).identities;
          const createdAt = signUpData.user.created_at ? new Date(signUpData.user.created_at).getTime() : 0;
          const isOldAccount = createdAt > 0 && (Date.now() - createdAt) > 60_000;
          const emptyIdentities = Array.isArray(identities) && identities.length === 0;

          if (emptyIdentities || (isOldAccount && !signUpData.session)) {
            setAuthError("This email is already registered. Please sign in instead.");
            setAuthMode("signin");
            setAuthPasswordConfirm("");
            setAuthLoading(false);
            return;
          }

          if (!signUpData.session) {
            setAuthError("Account created! Please check your email to confirm your account before signing in.");
            setAuthEmail("");
            setAuthPassword("");
            setAuthPasswordConfirm("");
            setAuthStatus("signed_out");
            return;
          }

          setSessionUser(signUpData.user);
          setAuthStatus("signed_in");
          setAuthEmail("");
          setAuthPassword("");
          setAuthPasswordConfirm("");
          setShowAuthModal(false);
        }
      } else {
        const signInPromise = authBridge.signInWithPassword({
          email,
          password,
        });
        
        // Timeout after 15 seconds to prevent infinite hang
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Sign-in timed out. Please try again.")), 15000)
        );
        
        const { data: signInData, error: signInError } = await Promise.race([signInPromise, timeoutPromise]) as any;

        if (signInError) {
          setAuthError(signInError.message || "Invalid email or password.");
          return;
        }

        if (signInData?.user) {
          setSessionUser(signInData.user);
          setAuthStatus("signed_in");
          setAuthEmail("");
          setAuthPassword("");
          setAuthPasswordConfirm("");
          setShowAuthModal(false);
        } else {
          setAuthError("Sign-in failed. Please check your credentials.");
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      console.error("Auth error:", err);
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail, authPassword, authPasswordConfirm, authMode]);

  const handleForgotPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const email = authEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      setAuthError("Please enter your email address.");
      return;
    }

    if (!emailRegex.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);
      setAuthSuccess(null);

      const { error } = await authBridge.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setAuthError(error.message || "Could not send reset email. Please try again.");
        return;
      }

      setAuthSuccess("Check your email for a password reset link.");
      setAuthEmail("");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      console.error("Forgot password error:", err);
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail]);

  return {
    sessionUser,
    setSessionUser,
    profile,
    setProfile,
    authStatus,
    setAuthStatus,
    profileLoading,
    setProfileLoading,
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authPasswordConfirm,
    setAuthPasswordConfirm,
    authLoading,
    setAuthLoading,
    authError,
    setAuthError,
    authSuccess,
    setAuthSuccess,
    needsUsernameChoice,
    setNeedsUsernameChoice,
    handleAuth,
    handleForgotPassword,
  };
}
