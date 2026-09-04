import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  it("defaults describe the conventional mount", () => {
    const c = resolveConfig();
    expect(c.mountPath).toBe("/mdmx");
    expect(c.basePath).toBe("/api/mdmx");
    expect(c.registryPath).toBe(".mdmx/registry.json");
    // The canvas carries the scaffolded article class by convention (ADR-050).
    expect(c.contentClassName).toBe("mdmx-page");
  });

  it("explicit options override, including an empty content class", () => {
    const c = resolveConfig({ contentClassName: "prose", title: "Docs" });
    expect(c.contentClassName).toBe("prose");
    expect(c.title).toBe("Docs");
    expect(resolveConfig({ contentClassName: "" }).contentClassName).toBe("");
  });
});
