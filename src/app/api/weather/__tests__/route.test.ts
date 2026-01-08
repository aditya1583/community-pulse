import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Weather API Route Tests
 *
 * Tests for the /api/weather endpoint
 */

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks
import { POST } from "../route";

describe("/api/weather", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: Record<string, unknown>): Request {
    return new Request("http://localhost/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  describe("parameter validation", () => {
    it("returns 400 when city is missing", async () => {
      const request = createRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("City is required");
    });

    it("returns 400 when city is empty string", async () => {
      const request = createRequest({ city: "" });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("City is required");
    });

    it("returns 400 when city is whitespace", async () => {
      const request = createRequest({ city: "   " });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("City is required");
    });
  });

  describe("geocoding", () => {
    it("geocodes city when coordinates not provided", async () => {
      // Mock geocoding response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { latitude: 30.2672, longitude: -97.7431 },
            ],
          }),
      });

      // Mock weather response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            current: {
              temperature_2m: 85,
              apparent_temperature: 90,
              weather_code: 0,
            },
          }),
      });

      const request = createRequest({ city: "Austin" });
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Verify geocoding was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("geocoding-api.open-meteo.com")
      );
    });

    it("returns 404 when city not found", async () => {
      // Mock geocoding response with no results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const request = createRequest({ city: "NonExistentCity12345" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("City not found");
    });

    it("skips geocoding when coordinates provided", async () => {
      // Only mock weather response (no geocoding needed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            current: {
              temperature_2m: 75,
              apparent_temperature: 78,
              weather_code: 2,
            },
          }),
      });

      const request = createRequest({
        city: "Austin",
        lat: 30.2672,
        lon: -97.7431,
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Should only call weather API, not geocoding
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.open-meteo.com/v1/forecast")
      );
    });
  });

  describe("weather response", () => {
    it("returns formatted weather data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            current: {
              temperature_2m: 85.5,
              apparent_temperature: 90.3,
              weather_code: 0,
            },
          }),
      });

      const request = createRequest({
        city: "Austin, TX",
        lat: 30.2672,
        lon: -97.7431,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        temp: 86, // Rounded from 85.5
        feelsLike: 90, // Rounded from 90.3
        description: "Clear sky",
        icon: "01d",
        cityName: "Austin", // Extracted from "Austin, TX"
      });
    });

    it("handles various weather codes", async () => {
      const testCases = [
        { code: 0, description: "Clear sky" },
        { code: 2, description: "Partly cloudy" },
        { code: 61, description: "Slight rain" },
        { code: 95, description: "Thunderstorm" },
        { code: 71, description: "Slight snow" },
      ];

      for (const { code, description } of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              current: {
                temperature_2m: 70,
                apparent_temperature: 72,
                weather_code: code,
              },
            }),
        });

        const request = createRequest({
          city: "TestCity",
          lat: 30,
          lon: -97,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(data.description).toBe(description);
      }
    });

    it("handles unknown weather code", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            current: {
              temperature_2m: 70,
              apparent_temperature: 72,
              weather_code: 999, // Unknown code
            },
          }),
      });

      const request = createRequest({
        city: "TestCity",
        lat: 30,
        lon: -97,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.description).toBe("Unknown");
      expect(data.icon).toBe("01d"); // Default icon
    });
  });

  describe("caching", () => {
    it("sets cache headers on successful response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            current: {
              temperature_2m: 70,
              apparent_temperature: 72,
              weather_code: 0,
            },
          }),
      });

      const request = createRequest({
        city: "Austin",
        lat: 30.2672,
        lon: -97.7431,
      });
      const response = await POST(request);

      expect(response.headers.get("Cache-Control")).toBe(
        "public, s-maxage=900, stale-while-revalidate=1800"
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 when weather service fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Service unavailable" }),
      });

      const request = createRequest({
        city: "Austin",
        lat: 30.2672,
        lon: -97.7431,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Weather service error");
    });

    it("returns 500 when weather response has no current data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const request = createRequest({
        city: "Austin",
        lat: 30.2672,
        lon: -97.7431,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Weather service error");
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = createRequest({
        city: "Austin",
        lat: 30.2672,
        lon: -97.7431,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Network error");
    });

    it("handles JSON parse errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const request = createRequest({
        city: "Austin",
        lat: 30.2672,
        lon: -97.7431,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
    });
  });
});
