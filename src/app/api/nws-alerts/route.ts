import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type NWSAlertSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
type NWSAlertUrgency = "Immediate" | "Expected" | "Future" | "Past" | "Unknown";

export interface NWSAlert {
  id: string;
  event: string;
  severity: NWSAlertSeverity;
  urgency: NWSAlertUrgency;
  headline: string;
  description: string;
  instruction: string;
  onset: string | null;
  expires: string | null;
  senderName: string;
}

interface NWSFeatureProperties {
  id?: string;
  event?: string;
  severity?: string;
  urgency?: string;
  parameters?: { NWSheadline?: string[] };
  headline?: string;
  description?: string;
  instruction?: string;
  onset?: string;
  expires?: string;
  senderName?: string;
}

interface NWSFeature {
  id?: string;
  properties?: NWSFeatureProperties;
}

interface NWSResponse {
  features?: NWSFeature[];
}

function normalizeSeverity(s: string | undefined): NWSAlertSeverity {
  if (s === "Extreme" || s === "Severe" || s === "Moderate" || s === "Minor") return s;
  return "Unknown";
}

function normalizeUrgency(u: string | undefined): NWSAlertUrgency {
  if (u === "Immediate" || u === "Expected" || u === "Future" || u === "Past") return u;
  return "Unknown";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
      {
        headers: {
          "User-Agent": "(voxlo.app, contact@voxlo.app)",
          Accept: "application/geo+json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    const data: NWSResponse = await res.json();
    const features = data.features ?? [];

    const alerts: NWSAlert[] = features.map((feature: NWSFeature) => {
      const p = feature.properties ?? {};
      const rawId = feature.id ?? p.id ?? "";
      // Extract just the last segment of the URN for a shorter ID
      const id = rawId.split("/").pop() ?? rawId;

      const rawHeadline =
        p.parameters?.NWSheadline?.[0] ?? p.headline ?? "";
      const description = p.description ?? "";
      const instruction = p.instruction ?? "";

      return {
        id,
        event: p.event ?? "Unknown Event",
        severity: normalizeSeverity(p.severity),
        urgency: normalizeUrgency(p.urgency),
        headline: rawHeadline.slice(0, 200),
        description: description.slice(0, 300),
        instruction: instruction.slice(0, 200),
        onset: p.onset ?? null,
        expires: p.expires ?? null,
        senderName: p.senderName ?? "",
      };
    });

    return NextResponse.json(alerts, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  }
}
