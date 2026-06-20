import { describe, expect, it } from "vitest";
import type { ComponentSpec } from "@imdx/core";
import { filterComponents, groupByCategory, DEFAULT_CATEGORY } from "../src/react/rail-groups.js";

const specs: ComponentSpec[] = [
  { name: "Callout", category: "Content", description: "A note box", children: { policy: "rich-text" }, props: [] },
  { name: "Hero", category: "Marketing", description: "Big banner", children: { policy: "none" }, props: [] },
  { name: "Stat", category: "Data", children: { policy: "none" }, props: [] },
  { name: "Loose", children: { policy: "none" }, props: [] },
];

describe("filterComponents", () => {
  it("returns all for an empty/whitespace query", () => {
    expect(filterComponents(specs, "")).toHaveLength(4);
    expect(filterComponents(specs, "   ")).toHaveLength(4);
  });

  it("matches name, category, and description case-insensitively", () => {
    expect(filterComponents(specs, "hero").map((c) => c.name)).toEqual(["Hero"]);
    expect(filterComponents(specs, "data").map((c) => c.name)).toEqual(["Stat"]); // category
    expect(filterComponents(specs, "note box").map((c) => c.name)).toEqual(["Callout"]); // description
    expect(filterComponents(specs, "zzz")).toEqual([]);
  });
});

describe("groupByCategory", () => {
  it("groups by category preserving first-appearance order", () => {
    const groups = groupByCategory(specs);
    expect(groups.map(([c]) => c)).toEqual(["Content", "Marketing", "Data", DEFAULT_CATEGORY]);
    expect(groups[3]![1].map((c) => c.name)).toEqual(["Loose"]);
  });

  it("keeps multiple components within a category in order", () => {
    const two: ComponentSpec[] = [
      { name: "A", category: "X", children: { policy: "none" }, props: [] },
      { name: "B", category: "X", children: { policy: "none" }, props: [] },
    ];
    const groups = groupByCategory(two);
    expect(groups).toHaveLength(1);
    expect(groups[0]![1].map((c) => c.name)).toEqual(["A", "B"]);
  });
});
