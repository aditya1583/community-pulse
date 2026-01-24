/**
 * Supabase Server Utilities
 * 
 * Safe getters for Supabase clients in API routes.
 * These prevent build-time crashes by only initializing at runtime.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cached clients to avoid creating new instances on every request
let _anonClient: SupabaseClient | null = null;
let _serviceClient: SupabaseClient | null = null;

/**
 * Get Supabase client with anon key (for read-only public operations)
 */
export function getSupabaseAnon(): SupabaseClient {
    if (_anonClient) return _anonClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    }

    _anonClient = createClient(supabaseUrl, supabaseAnonKey);
    return _anonClient;
}

/**
 * Get Supabase client with service role key (for privileged server operations)
 */
export function getSupabaseService(): SupabaseClient {
    if (_serviceClient) return _serviceClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    }

    _serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return _serviceClient;
}
