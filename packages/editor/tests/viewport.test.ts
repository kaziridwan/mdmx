// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_VIEWPORT,
  VIEWPORT_MODES,
  canvasWidth,
  canvasWidthCss,
  canvasZoom,
  isViewportMode,
  readStoredViewport,
  storeViewport,
} from "../src/react/viewport.js";

describe("viewport modes (ADR-036 / ADR-051)", () => {
  beforeEach(() => localStorage.clear());

  it("fit is the default: the pane's own width at zoom 1", () => {
    expect(DEFAULT_VIEWPORT).toBe("fit");
    expect(VIEWPORT_MODES[0]).toBe("fit");
    expect(canvasWidth("fit")).toBeNull();
    expect(canvasWidthCss("fit")).toBe("100%");
    expect(canvasZoom("fit", 536)).toBe(1);
    expect(canvasZoom("fit", 0)).toBe(1);
  });

  it("device modes zoom down to fit the pane, never up", () => {
    expect(canvasWidthCss("desktop")).toBe("1280px");
    // The 0.5-era default: a 1280px desktop canvas in a ~536px pane.
    expect(canvasZoom("desktop", 536)).toBe(0.394);
    expect(canvasZoom("mobile", 800)).toBe(1);
    expect(canvasZoom("tablet", 800)).toBe(1);
    expect(canvasZoom("desktop", 100)).toBe(0.2); // floor
    expect(canvasZoom("desktop", 0)).toBe(1); // unknown pane: no zoom yet
    expect(canvasZoom("desktop", Number.NaN)).toBe(1);
  });

  it("persists a chosen mode and rejects junk", () => {
    expect(readStoredViewport()).toBeNull();
    storeViewport("tablet");
    expect(readStoredViewport()).toBe("tablet");
    localStorage.setItem("mdmx:viewport", "widescreen");
    expect(readStoredViewport()).toBeNull();
    expect(isViewportMode("fit")).toBe(true);
    expect(isViewportMode("desktop")).toBe(true);
    expect(isViewportMode("")).toBe(false);
    expect(isViewportMode(1280)).toBe(false);
  });
});
