import { createClient, SupabaseClient } from "@supabase/supabase-js";

// For static export builds where env vars might not be available at build time,
// we create a lazy-initialized client that only runs at runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create a placeholder for build time, real client at runtime
let _supabase: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        // Lazy initialization - only create client when actually used
        if (!_supabase) {
            if (!supabaseUrl || !supabaseAnonKey) {
                // During static export build, return a no-op
                if (typeof window === "undefined") {
                    console.warn("[Supabase] Skipping client creation during build (no env vars)");
                    return () => Promise.resolve({ data: null, error: null });
                }
                throw new Error("Supabase URL and Anon Key are required at runtime");
            }
            _supabase = createClient(supabaseUrl, supabaseAnonKey);
        }
        return _supabase[prop as keyof SupabaseClient];
    },
});
