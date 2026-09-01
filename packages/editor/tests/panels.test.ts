// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readStoredCollapsed, storeCollapsed } from "../src/react/panels.js";

describe("collapsible panels (ADR-051)", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the collapsed state per side", () => {
    expect(readStoredCollapsed("rail")).toBeNull();
    storeCollapsed("rail", true);
    expect(readStoredCollapsed("rail")).toBe(true);
    expect(readStoredCollapsed("sidebar")).toBeNull();
    storeCollapsed("sidebar", false);
    expect(readStoredCollapsed("sidebar")).toBe(false);
    expect(localStorage.getItem("mdmx:rail-collapsed")).toBe("true");
  });

  it("treats anything but true/false as unset", () => {
    localStorage.setItem("mdmx:rail-collapsed", "yes");
    expect(readStoredCollapsed("rail")).toBeNull();
  });
});
