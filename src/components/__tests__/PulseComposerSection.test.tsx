import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PulseComposerSection from "../PulseComposerSection";
import { isPulseFormComplete } from "@/lib/pulseValidation";

const baseProps = {
  moods: ["😊", "😐"],
  tags: ["General", "Traffic"],
  mood: null as string | null,
  tag: "",
  message: "",
  validationError: null as string | null,
  moodError: null as string | null,
  tagError: null as string | null,
  posting: false,
  canPost: false,
  displayName: "Tester",
  showFirstPulsePrompt: false,
  showFirstPulseCelebration: false,
  onFirstPulseStart: vi.fn(),
  onDismissPrompt: vi.fn(),
  onCloseCelebration: vi.fn(),
  onMoodSelect: vi.fn(),
  onTagSelect: vi.fn(),
  onMessageChange: vi.fn(),
  onSubmit: vi.fn(),
  textareaRef: React.createRef<HTMLTextAreaElement>(),
};

describe("PulseComposerSection", () => {
  it("keeps the post button visually disabled when the form is incomplete", () => {
    render(<PulseComposerSection {...baseProps} />);

    const button = screen.getByTestId("post-pulse-button");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the first-time prompt when requested", () => {
    render(
      <PulseComposerSection
        {...baseProps}
        showFirstPulsePrompt
        canPost={false}
      />
    );

    expect(screen.getByTestId("first-pulse-prompt")).toBeInTheDocument();
    expect(screen.getByText(/Drop your first pulse/i)).toBeVisible();
  });

  it("shows the first-pulse celebration message", () => {
    render(
      <PulseComposerSection
        {...baseProps}
        showFirstPulseCelebration
        canPost={false}
      />
    );

    expect(screen.getByTestId("first-pulse-celebration")).toBeInTheDocument();
    expect(
      screen.getByText(/unlocked your first badge/i)
    ).toBeInTheDocument();
  });
});

describe("pulse validation helpers", () => {
  it("requires mood, tag, and message to be present", () => {
    expect(isPulseFormComplete(null, null, "")).toBe(false);
    expect(isPulseFormComplete("😊", null, "Hello")).toBe(false);
    expect(isPulseFormComplete("😊", "General", " ")).toBe(false);
    expect(isPulseFormComplete("😊", "General", "Hello")).toBe(true);
  });
});
