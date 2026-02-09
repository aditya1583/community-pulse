/**
 * Server-side auth client for Capacitor/WKWebView
 *
 * Replaces supabase.auth.* calls that hang in WKWebView.
 * Stores tokens in localStorage, refreshes via /api/auth/session.
 */
import { getApiUrl } from "./api-config";

const STORAGE_KEY = "voxlo_auth";

type StoredAuth = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp
  user: { id: string; email: string };
};

function getStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStored(auth: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearStored() {
  localStorage.removeItem(STORAGE_KEY);
}

async function callAuth(body: Record<string, unknown>) {
  const res = await fetch(getApiUrl("/api/auth/session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Auth failed");
  return data;
}

/**
 * Sign in with email/password. Stores tokens locally.
 */
export async function signIn(email: string, password: string) {
  const data = await callAuth({ action: "signIn", email, password });
  if (data.access_token) {
    setStored({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: data.user,
    });
  }
  return data;
}

/**
 * Sign up with email/password. Stores tokens if session returned.
 */
export async function signUp(email: string, password: string) {
  const data = await callAuth({ action: "signUp", email, password });
  if (data.access_token) {
    setStored({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: data.user,
    });
  }
  return data;
}

/**
 * Get a valid access token. Auto-refreshes if expired.
 * Returns null if not signed in.
 */
export async function getAccessToken(): Promise<string | null> {
  const stored = getStored();
  if (!stored) return null;

  // Check if token expires within 60 seconds
  const now = Math.floor(Date.now() / 1000);
  if (stored.expires_at && stored.expires_at - now > 60) {
    return stored.access_token;
  }

  // Token expired or expiring — refresh
  try {
    const data = await callAuth({ action: "refresh", refresh_token: stored.refresh_token });
    if (data.access_token) {
      setStored({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        user: data.user,
      });
      return data.access_token;
    }
  } catch {
    // Refresh failed — session is dead
    clearStored();
  }
  return null;
}

/**
 * Get current user from stored auth. Does NOT make a network call.
 * Use getAccessToken() first to ensure token is fresh.
 */
export function getUser(): { id: string; email: string } | null {
  const stored = getStored();
  return stored?.user || null;
}

/**
 * Check if user is signed in (has stored tokens).
 */
export function isSignedIn(): boolean {
  return getStored() !== null;
}

/**
 * Sign out — clear stored tokens.
 */
export function signOut() {
  clearStored();
}

/**
 * Reset password via server-side endpoint.
 */
export async function resetPassword(email: string) {
  return callAuth({ action: "resetPassword", email });
}
