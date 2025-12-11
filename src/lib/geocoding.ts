export type GeocodedCity = {
  id: string;
  name: string;
  state?: string;
  country?: string;
  lat: number;
  lon: number;
  displayName: string;
};

export type GeocodeApiResponse = {
  results: GeocodedCity[];
  error?: string;
};

type OpenWeatherGeoResult = {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  state?: string;
};

export function formatDisplayName(
  name: string,
  state?: string | null,
  country?: string | null
): string {
  const parts = [name];
  if (state) parts.push(state);
  if (country) parts.push(country);
  return parts.join(", ");
}

export function mapOpenWeatherResult(result: OpenWeatherGeoResult): GeocodedCity {
  const displayName = formatDisplayName(
    result.name,
    result.state ?? undefined,
    result.country ?? undefined
  );

  return {
    id: `${result.name}-${result.state ?? "unknown"}-${result.country ?? "unknown"}-${result.lat}-${result.lon}`,
    name: result.name,
    state: result.state ?? undefined,
    country: result.country ?? undefined,
    lat: result.lat,
    lon: result.lon,
    displayName,
  };
}
