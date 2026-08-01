import { describe, expect, it } from "vitest";
import type { RegistrySpec } from "@mdmx/core";
import { mergeStudioSpecs, type StudioComponentDef } from "../src/index.js";

const base: RegistrySpec = {
  mdmxRegistryVersion: 1,
  components: [
    { name: "Callout", children: { policy: "rich-text" }, props: [] },
    { name: "Promo", children: { policy: "none" }, props: [] },
  ],
};

function def(name: string): StudioComponentDef {
  return {
    mdmxStudioVersion: 1,
    name,
    props: [],
    template: { tag: "div", children: [{ text: name }] },
  };
}

describe("mergeStudioSpecs (the code-beats-studio rule)", () => {
  it("adds studio components the registry doesn't define", () => {
    const merged = mergeStudioSpecs(base, [def("Banner")]);
    expect(merged.components.map((c) => c.name)).toEqual(["Callout", "Promo", "Banner"]);
  });

  it("lets a code component shadow a studio definition of the same name", () => {
    const merged = mergeStudioSpecs(base, [def("Promo")]);
    expect(merged.components).toHaveLength(2);
    // The code spec survives untouched — ejecting to TSX shadows the JSON.
    expect(merged.components.find((c) => c.name === "Promo")).toBe(base.components[1]);
  });

  it("keeps the first of two studio definitions with the same name", () => {
    const merged = mergeStudioSpecs(base, [def("Banner"), def("Banner")]);
    expect(merged.components.filter((c) => c.name === "Banner")).toHaveLength(1);
  });

  it("returns the input spec untouched when there is nothing to merge", () => {
    expect(mergeStudioSpecs(base, [])).toBe(base);
  });
});
