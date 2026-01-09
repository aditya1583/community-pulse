"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // User should have a session from clicking the recovery link
      if (session) {
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
      }
    };

    checkSession();

    // Listen for auth state changes (recovery link creates a session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const validatePassword = (pwd: string): { valid: boolean; error?: string } => {
    if (pwd.length < 8) {
      return { valid: false, error: "Password must be at least 8 characters" };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { valid: false, error: "Password must contain an uppercase letter" };
    }
    if (!/[a-z]/.test(pwd)) {
      return { valid: false, error: "Password must contain a lowercase letter" };
    }
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, error: "Password must contain a number" };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(validation.error || "Invalid password");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password");
        return;
      }

      setSuccess(true);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Invalid/expired link
  if (isValidSession === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-white mb-2">Invalid or Expired Link</h1>
          <p className="text-slate-400 text-sm mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 bg-emerald-500 text-slate-950 font-medium text-sm rounded-lg hover:bg-emerald-400 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-semibold text-white mb-2">Password Updated!</h1>
          <p className="text-slate-400 text-sm mb-4">
            Your password has been successfully changed. Redirecting you to the app...
          </p>
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🔐</div>
          <h1 className="text-xl font-semibold text-white">Set New Password</h1>
          <p className="text-slate-400 text-sm mt-1">
            Choose a strong password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-xs text-slate-400 uppercase tracking-wide">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Enter new password"
              className="rounded-lg bg-slate-800/70 border border-slate-700/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent"
              disabled={loading}
              autoFocus
            />
            <p className="text-[10px] text-slate-500">
              Must be 8+ characters with uppercase, lowercase, and number
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-password" className="text-xs text-slate-400 uppercase tracking-wide">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="Confirm new password"
              className="rounded-lg bg-slate-800/70 border border-slate-700/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-medium text-sm rounded-lg shadow-lg shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-xs text-slate-400 hover:text-white text-center transition"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
