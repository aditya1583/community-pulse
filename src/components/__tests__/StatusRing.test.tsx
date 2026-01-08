import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusRing, { StatusIndicator } from "@/components/StatusRing";

/**
 * StatusRing Component Tests
 *
 * Tests for the visual status ring component that displays user tier and level.
 */

describe("StatusRing", () => {
  describe("rendering", () => {
    it("renders children content", () => {
      render(
        <StatusRing>
          <span data-testid="child">😊</span>
        </StatusRing>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("renders with rank prop", () => {
      render(
        <StatusRing rank={5}>
          <span>😊</span>
        </StatusRing>
      );

      // Component should render without error
      expect(screen.getByText("😊")).toBeInTheDocument();
    });

    it("renders with null rank", () => {
      render(
        <StatusRing rank={null}>
          <span>😊</span>
        </StatusRing>
      );

      expect(screen.getByText("😊")).toBeInTheDocument();
    });
  });

  describe("level badge", () => {
    it("does not show level badge by default", () => {
      render(
        <StatusRing rank={5} level={10}>
          <span>😊</span>
        </StatusRing>
      );

      expect(screen.queryByText("10")).not.toBeInTheDocument();
    });

    it("shows level badge when showLevel is true", () => {
      render(
        <StatusRing rank={5} level={10} showLevel>
          <span>😊</span>
        </StatusRing>
      );

      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("does not show level badge for level 1 even with showLevel", () => {
      render(
        <StatusRing rank={null} level={1} showLevel>
          <span>😊</span>
        </StatusRing>
      );

      // Level 1 should not be displayed
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("shows level badge for level > 1 with showLevel on none tier", () => {
      render(
        <StatusRing rank={100} level={5} showLevel>
          <span>😊</span>
        </StatusRing>
      );

      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  describe("tier styling", () => {
    it("applies diamond tier styling for rank 1-3", () => {
      const { container } = render(
        <StatusRing rank={1}>
          <span>😊</span>
        </StatusRing>
      );

      // Diamond tier has shimmer animation
      expect(container.querySelector(".animate-shimmer")).toBeInTheDocument();
    });

    it("applies gold tier styling for rank 4-10", () => {
      const { container } = render(
        <StatusRing rank={5}>
          <span>😊</span>
        </StatusRing>
      );

      // Gold tier should have gradient styling (no shimmer)
      expect(container.querySelector(".animate-shimmer")).not.toBeInTheDocument();
    });

    it("applies none tier styling for rank > 50", () => {
      const { container } = render(
        <StatusRing rank={100}>
          <span>😊</span>
        </StatusRing>
      );

      // None tier has simple styling, no shimmer
      expect(container.querySelector(".animate-shimmer")).not.toBeInTheDocument();
    });
  });

  describe("size variants", () => {
    it("renders small size", () => {
      const { container } = render(
        <StatusRing size="sm">
          <span>😊</span>
        </StatusRing>
      );

      const ring = container.querySelector(".w-8");
      expect(ring).toBeInTheDocument();
    });

    it("renders medium size (default)", () => {
      const { container } = render(
        <StatusRing>
          <span>😊</span>
        </StatusRing>
      );

      const ring = container.querySelector(".w-10");
      expect(ring).toBeInTheDocument();
    });

    it("renders large size", () => {
      const { container } = render(
        <StatusRing size="lg">
          <span>😊</span>
        </StatusRing>
      );

      const ring = container.querySelector(".w-14");
      expect(ring).toBeInTheDocument();
    });
  });

  describe("custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <StatusRing className="custom-class">
          <span>😊</span>
        </StatusRing>
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });
  });

  describe("tier override", () => {
    it("uses tier override instead of calculating from rank", () => {
      const { container } = render(
        <StatusRing
          rank={100}
          tier={{
            name: "diamond",
            label: "Diamond",
            minRank: 1,
            maxRank: 3,
            ringColor: "from-cyan-300 via-white to-cyan-300",
            glowColor: "shadow-cyan-400/60",
            badgeColor: "bg-gradient-to-r from-cyan-400 to-white text-slate-900",
          }}
        >
          <span>😊</span>
        </StatusRing>
      );

      // Should have diamond shimmer despite rank being 100
      expect(container.querySelector(".animate-shimmer")).toBeInTheDocument();
    });
  });
});

describe("StatusIndicator", () => {
  describe("rendering", () => {
    it("returns null for none tier without level", () => {
      const { container } = render(<StatusIndicator rank={100} />);

      expect(container.firstChild).toBeNull();
    });

    it("shows level for none tier with level > 1", () => {
      render(<StatusIndicator rank={100} level={5} />);

      expect(screen.getByText("Lv.5")).toBeInTheDocument();
    });

    it("returns null for none tier with level 1", () => {
      const { container } = render(<StatusIndicator rank={100} level={1} />);

      expect(container.firstChild).toBeNull();
    });

    it("shows tier label for tiered users", () => {
      render(<StatusIndicator rank={5} />);

      expect(screen.getByText("Gold")).toBeInTheDocument();
    });

    it("shows tier label with level for tiered users", () => {
      render(<StatusIndicator rank={5} level={10} />);

      expect(screen.getByText("Gold")).toBeInTheDocument();
      expect(screen.getByText("Lv.10")).toBeInTheDocument();
    });

    it("does not show level 1 for tiered users", () => {
      render(<StatusIndicator rank={5} level={1} />);

      expect(screen.getByText("Gold")).toBeInTheDocument();
      expect(screen.queryByText("Lv.1")).not.toBeInTheDocument();
    });
  });

  describe("tier labels", () => {
    it("shows Diamond for rank 1-3", () => {
      render(<StatusIndicator rank={1} />);
      expect(screen.getByText("Diamond")).toBeInTheDocument();
    });

    it("shows Gold for rank 4-10", () => {
      render(<StatusIndicator rank={7} />);
      expect(screen.getByText("Gold")).toBeInTheDocument();
    });

    it("shows Silver for rank 11-25", () => {
      render(<StatusIndicator rank={15} />);
      expect(screen.getByText("Silver")).toBeInTheDocument();
    });

    it("shows Bronze for rank 26-50", () => {
      render(<StatusIndicator rank={30} />);
      expect(screen.getByText("Bronze")).toBeInTheDocument();
    });
  });

  describe("custom className", () => {
    it("applies custom className to level indicator", () => {
      const { container } = render(
        <StatusIndicator rank={100} level={5} className="custom-class" />
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("applies custom className to tier indicator", () => {
      const { container } = render(
        <StatusIndicator rank={5} className="custom-class" />
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });
  });
});
