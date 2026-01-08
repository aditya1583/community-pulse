import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatCard from "@/components/StatCard";

/**
 * StatCard Component Tests
 *
 * Tests for the reusable stat card component used in dashboards.
 */

describe("StatCard", () => {
  const defaultProps = {
    icon: <span data-testid="test-icon">📊</span>,
    value: "42",
    label: "Test Stat",
    onClick: vi.fn(),
  };

  describe("rendering", () => {
    it("renders icon, value, and label", () => {
      render(<StatCard {...defaultProps} />);

      expect(screen.getByTestId("test-icon")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("Test Stat")).toBeInTheDocument();
    });

    it("renders numeric values", () => {
      render(<StatCard {...defaultProps} value={100} />);

      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("renders string values", () => {
      render(<StatCard {...defaultProps} value="Active" />);

      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has accessible button role", () => {
      render(<StatCard {...defaultProps} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("uses default aria-label combining label and value", () => {
      render(<StatCard {...defaultProps} />);

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "Test Stat: 42"
      );
    });

    it("uses custom aria-label when provided", () => {
      render(
        <StatCard
          {...defaultProps}
          ariaLabel="Custom accessible label"
        />
      );

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "Custom accessible label"
      );
    });
  });

  describe("interaction", () => {
    it("calls onClick when clicked", () => {
      const onClick = vi.fn();
      render(<StatCard {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByRole("button"));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", () => {
      const onClick = vi.fn();
      render(
        <StatCard {...defaultProps} onClick={onClick} isClickable={false} />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(onClick).not.toHaveBeenCalled();
    });

    it("button is disabled when isClickable is false", () => {
      render(<StatCard {...defaultProps} isClickable={false} />);

      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("button is enabled by default", () => {
      render(<StatCard {...defaultProps} />);

      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  describe("accent colors", () => {
    it("applies emerald accent by default", () => {
      const { container } = render(<StatCard {...defaultProps} />);

      // Check that the button has hover classes for emerald
      const button = container.querySelector("button");
      expect(button?.className).toContain("emerald");
    });

    it("applies purple accent when specified", () => {
      const { container } = render(
        <StatCard {...defaultProps} accentColor="purple" />
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("purple");
    });

    it("applies amber accent when specified", () => {
      const { container } = render(
        <StatCard {...defaultProps} accentColor="amber" />
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("amber");
    });
  });

  describe("disabled state styling", () => {
    it("applies opacity when not clickable", () => {
      const { container } = render(
        <StatCard {...defaultProps} isClickable={false} />
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("opacity-60");
    });

    it("uses cursor-default when not clickable", () => {
      const { container } = render(
        <StatCard {...defaultProps} isClickable={false} />
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("cursor-default");
    });

    it("uses cursor-pointer when clickable", () => {
      const { container } = render(<StatCard {...defaultProps} />);

      const button = container.querySelector("button");
      expect(button?.className).toContain("cursor-pointer");
    });
  });
});
