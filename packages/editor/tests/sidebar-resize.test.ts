// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clampSidebarWidth,
  readStoredWidth,
  storeSidebarWidth,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
} from "../src/react/sidebar-resize.js";

beforeEach(() => {
  localStorage.clear();
});

describe("clampSidebarWidth", () => {
  it("clamps below min and above max, rounds within", () => {
    expect(clampSidebarWidth(10)).toBe(MIN_SIDEBAR_WIDTH);
    expect(clampSidebarWidth(99999)).toBe(MAX_SIDEBAR_WIDTH);
    expect(clampSidebarWidth(380.6)).toBe(381);
  });

  it("falls back to min for non-finite input", () => {
    expect(clampSidebarWidth(NaN)).toBe(MIN_SIDEBAR_WIDTH);
    expect(clampSidebarWidth(Infinity)).toBe(MIN_SIDEBAR_WIDTH);
  });

  it("honours custom bounds", () => {
    expect(clampSidebarWidth(500, 300, 400)).toBe(400);
    expect(clampSidebarWidth(100, 300, 400)).toBe(300);
  });
});

describe("storeSidebarWidth / readStoredWidth", () => {
  it("returns null when nothing is stored", () => {
    expect(readStoredWidth()).toBeNull();
  });

  it("round-trips a clamped width", () => {
    storeSidebarWidth(420);
    expect(readStoredWidth()).toBe(420);
  });

  it("clamps an out-of-range stored value on read", () => {
    localStorage.setItem("imdx:sidebar-width", "99999");
    expect(readStoredWidth()).toBe(MAX_SIDEBAR_WIDTH);
  });

  it("returns null for a non-numeric stored value", () => {
    localStorage.setItem("imdx:sidebar-width", "wide");
    expect(readStoredWidth()).toBeNull();
  });
});
