/**
 * Auth Bridge — unified auth interface that works on both web and Capacitor
 *
 * On web: uses Supabase JS client directly (works fine)
 * On Capacitor/WKWebView: routes through server-side /api/auth/session
 *
 * This is a drop-in replacement. Import { authBridge } and use it
 * instead of supabase.auth.* everywhere.
 */
import { supabase } from "../../lib/supabaseClient";
import * as serverAuth from "./serverAuth";
import { getApiUrl } from "./api-config";

function isCapacitor(): boolean {
  return typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();
}

export const authBridge = {
  /**
   * Sign in with email/password
   */
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    if (isCapacitor()) {
      try {
        const data = await serverAuth.signIn(email, password);
        return {
          data: {
            user: { id: data.user.id, email: data.user.email } as any,
            session: { access_token: data.access_token } as any,
          },
          error: null,
        };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    }
    return supabase.auth.signInWithPassword({ email, password });
  },

  /**
   * Sign up with email/password
   */
  async signUp({ email, password }: { email: string; password: string }) {
    if (isCapacitor()) {
      try {
        const data = await serverAuth.signUp(email, password);
        return {
          data: {
            user: data.user ? { id: data.user.id, email: data.user.email } as any : null,
            session: data.access_token ? { access_token: data.access_token } as any : null,
          },
          error: null,
        };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    }
    return supabase.auth.signUp({ email, password });
  },

  /**
   * Get current user
   */
  async getUser() {
    if (isCapacitor()) {
      const user = serverAuth.getUser();
      if (user) {
        return { data: { user: { id: user.id, email: user.email } as any }, error: null };
      }
      return { data: { user: null }, error: { message: "Not signed in" } };
    }
    return supabase.auth.getUser();
  },

  /**
   * Get a valid access token (refreshes if needed)
   */
  async getAccessToken(): Promise<string | null> {
    if (isCapacitor()) {
      return serverAuth.getAccessToken();
    }
    // Web: refresh then get session
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.access_token) return refreshed.session.access_token;
    } catch { /* fall through */ }
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    } catch {
      return null;
    }
  },

  /**
   * Listen for auth state changes
   * On Capacitor: polls localStorage; on web: uses Supabase realtime
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (isCapacitor()) {
      // On Capacitor, check stored auth and fire initial state
      const user = serverAuth.getUser();
      if (user) {
        setTimeout(() => callback("SIGNED_IN", { user }), 0);
      } else {
        setTimeout(() => callback("SIGNED_OUT", null), 0);
      }
      // Return a no-op unsubscribe
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },

  /**
   * Sign out
   */
  async signOut() {
    if (isCapacitor()) {
      serverAuth.signOut();
      return { error: null };
    }
    return supabase.auth.signOut();
  },

  /**
   * Reset password
   */
  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    if (isCapacitor()) {
      try {
        await serverAuth.resetPassword(email);
        return { error: null };
      } catch (err: any) {
        return { error: { message: err.message } };
      }
    }
    return supabase.auth.resetPasswordForEmail(email, options);
  },

  /**
   * Check if signed in (synchronous, no network)
   */
  isSignedIn(): boolean {
    if (isCapacitor()) {
      return serverAuth.isSignedIn();
    }
    // On web, we can't easily check synchronously — return true and let async verify
    return true;
  },
};
