import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGeocodingAutocomplete } from "@/hooks/useGeocodingAutocomplete";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ results: [] }),
  } as unknown as Response);
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useGeocodingAutocomplete", () => {
  it("debounces geocoding calls", async () => {
    const { result } = renderHook(() =>
      useGeocodingAutocomplete({ debounceMs: 300, minLength: 3 })
    );

    act(() => {
      result.current.setInputValue("Lo");
    });
    await act(async () => {
      await sleep(200);
    });
    expect(mockFetch).not.toHaveBeenCalled();

    act(() => {
      result.current.setInputValue("Lon");
    });
    await act(async () => {
      await sleep(320);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/geocode?query=Lon");
  });

  it("surfaces a no results state when the API returns nothing", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText("city-search");
    await user.type(input, "Hyd");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("No matching cities")
    );
  });
});

function Harness() {
  const { inputValue, setInputValue, notFound } = useGeocodingAutocomplete({
    debounceMs: 0,
    minLength: 3,
  });

  return (
    <div>
      <input
        aria-label="city-search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      {notFound && <div role="alert">No matching cities</div>}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
