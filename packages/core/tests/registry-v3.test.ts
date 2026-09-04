import { describe, expect, it } from "vitest";
import {
  MDMX_REGISTRY_VERSION,
  Registry,
  isPropVisible,
  type PropSpec,
  type RegistrySpec,
} from "../src/index.js";

const text = (name: string, showIf?: PropSpec["showIf"]): PropSpec => ({
  name,
  required: false,
  control: { type: "text" },
  ...(showIf ? { showIf } : {}),
});

describe("registry v3 (ADR-057)", () => {
  it("bumps the schema counter to 3", () => {
    expect(MDMX_REGISTRY_VERSION).toBe(3);
  });

  it("reads a v2 registry unchanged: no preview, no visibility rules", () => {
    const v2: RegistrySpec = {
      mdmxRegistryVersion: 2,
      components: [
        { name: "Callout", children: { policy: "rich-text" }, props: [text("title")], render: { mode: "live" } },
      ],
    };
    const registry = new Registry(v2);
    const callout = registry.get("Callout")!;
    expect(callout.preview).toBeUndefined();
    expect(callout.props[0]!.showIf).toBeUndefined();
    expect(isPropVisible(callout.props[0]!, {})).toBe(true);
  });

  it("carries preview (props + children text) and link placeholders", () => {
    const v3: RegistrySpec = {
      mdmxRegistryVersion: 3,
      components: [
        {
          name: "Button",
          children: { policy: "none" },
          props: [
            text("label"),
            { name: "href", required: false, control: { type: "link", placeholder: "https://…" } },
          ],
          preview: { label: "Get started" },
        },
        {
          name: "Tooltip",
          children: { policy: "rich-text" },
          props: [text("content")],
          preview: { content: "A tooltip", children: "Hover me" },
        },
      ],
    };
    const registry = new Registry(v3);
    expect(registry.get("Button")!.preview).toEqual({ label: "Get started" });
    expect(registry.get("Tooltip")!.preview?.children).toBe("Hover me");
    const href = registry.get("Button")!.props[1]!;
    expect(href.control).toEqual({ type: "link", placeholder: "https://…" });
  });
});

describe("isPropVisible (showIf)", () => {
  it("shows unconditionally without a rule", () => {
    expect(isPropVisible(text("a"), {})).toBe(true);
  });

  it("with eq: visible only when the governing prop equals the value", () => {
    const lines = text("lines", { prop: "shape", eq: "text" });
    expect(isPropVisible(lines, { shape: "text" })).toBe(true);
    expect(isPropVisible(lines, { shape: "rect" })).toBe(false);
    expect(isPropVisible(lines, {})).toBe(false);
  });

  it("without eq: visible when the governing prop is truthy", () => {
    const href = text("primaryHref", { prop: "primaryLabel" });
    expect(isPropVisible(href, { primaryLabel: "Go" })).toBe(true);
    expect(isPropVisible(href, { primaryLabel: "" })).toBe(false);
    expect(isPropVisible(href, { primaryLabel: false })).toBe(false);
    expect(isPropVisible(href, {})).toBe(false);
  });

  it("compares structurally for non-scalar eq values", () => {
    const p = text("x", { prop: "tags", eq: ["a", "b"] });
    expect(isPropVisible(p, { tags: ["a", "b"] })).toBe(true);
    expect(isPropVisible(p, { tags: ["b", "a"] })).toBe(false);
  });
});
