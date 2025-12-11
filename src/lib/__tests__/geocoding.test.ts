import { describe, expect, it } from "vitest";
import { formatDisplayName, mapOpenWeatherResult } from "@/lib/geocoding";

describe("geocoding helpers", () => {
  it("formats display names with state and country codes", () => {
    expect(formatDisplayName("Austin", "TX", "US")).toBe("Austin, TX, US");
    expect(formatDisplayName("Hyderabad", null, "IN")).toBe("Hyderabad, IN");
    expect(formatDisplayName("Nairobi")).toBe("Nairobi");
  });

  it("maps OpenWeather results into app shape", () => {
    const mapped = mapOpenWeatherResult({
      name: "Austin",
      state: "Texas",
      country: "US",
      lat: 30.2672,
      lon: -97.7431,
    });

    expect(mapped.displayName).toBe("Austin, Texas, US");
    expect(mapped.lat).toBeCloseTo(30.2672);
    expect(mapped.lon).toBeCloseTo(-97.7431);
    expect(mapped.id).toContain("Austin");
  });
});
