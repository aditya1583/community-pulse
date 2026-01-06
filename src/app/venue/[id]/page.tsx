"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import VenueDetailPage from "@/components/VenueDetailPage";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function VenuePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const venueId = params.id as string;

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);

  // Load user session
  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionUser(session?.user ?? null);
    };
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSessionUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch venue data
  useEffect(() => {
    const fetchVenue = async () => {
      if (!venueId) return;

      setLoading(true);
      setError(null);

      try {
        // Try to fetch from partner_venues first (for partner venues with extra data)
        const { data: partnerVenue, error: partnerError } = await supabase
          .from("partner_venues")
          .select("*")
          .eq("slug", venueId)
          .single();

        if (partnerVenue && !partnerError) {
          setVenue({ ...partnerVenue, isPartner: true });
        } else {
          // Check for URL params (passed from Explore cards)
          const name = searchParams.get("name");
          const category = searchParams.get("category");
          const address = searchParams.get("address");
          const lat = searchParams.get("lat");
          const lon = searchParams.get("lon");

          if (name) {
            // Build venue from URL params
            setVenue({
              id: venueId,
              name: name,
              category: category || undefined,
              address: address || undefined,
              lat: lat ? parseFloat(lat) : undefined,
              lon: lon ? parseFloat(lon) : undefined,
              isPartner: false,
            });
          } else {
            // Fallback: construct from slug
            const displayName = venueId
              .split("-")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            setVenue({
              id: venueId,
              name: displayName,
              isPartner: false,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching venue:", err);
        setError("Failed to load venue");
      } finally {
        setLoading(false);
      }
    };

    fetchVenue();
  }, [venueId, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400 animate-pulse">Loading venue...</div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">{error || "Venue not found"}</div>
        <button
          onClick={() => router.back()}
          className="text-emerald-400 underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <VenueDetailPage
      venue={venue}
      userId={sessionUser?.id ?? null}
      onBack={() => router.back()}
      onSignInClick={() => {
        // Redirect to home with auth modal trigger
        router.push("/?auth=true");
      }}
    />
  );
}

// Wrap with Suspense for useSearchParams
export default function VenuePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400 animate-pulse">Loading venue...</div>
      </div>
    }>
      <VenuePageContent />
    </Suspense>
  );
}
