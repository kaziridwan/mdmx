import { describe, expect, it } from "vitest";
import {
  interpolatedProps,
  parseStudioComponent,
  studioComponentPath,
  studioComponentToSpec,
  validateStudioComponent,
  type StudioComponentDef,
} from "../src/index.js";

const VALID: StudioComponentDef = {
  mdmxStudioVersion: 1,
  name: "PromoCard",
  description: "A promo card",
  props: [
    { name: "title", type: "string", required: true },
    { name: "href", type: "string", default: "#" },
    { name: "count", type: "number" },
  ],
  template: {
    tag: "section",
    classes: "p-8 rounded-xl bg-slate-900",
    children: [
      { tag: "h2", classes: "text-2xl font-bold", children: [{ slot: "title" }] },
      { tag: "a", attrs: { href: "{props.href}" }, children: [{ text: "Open ({props.count})" }] },
    ],
  },
};

describe("validateStudioComponent", () => {
  it("accepts a valid definition", () => {
    expect(validateStudioComponent(VALID)).toEqual([]);
  });

  it("rejects disallowed tags, attrs, and unsafe URLs", () => {
    const bad = {
      ...VALID,
      template: {
        tag: "script",
        children: [
          { tag: "a", attrs: { onclick: "x()", href: "javascript:alert(1)" } },
        ],
      },
    };
    const problems = validateStudioComponent(bad);
    expect(problems.some((p) => p.includes('"script" is not allowed'))).toBe(true);
    // children of a rejected tag are not descended into; check attr rules directly
    const badAttrs = {
      ...VALID,
      template: { tag: "a", attrs: { onclick: "x()", href: "javascript:alert(1)" } },
    };
    const attrProblems = validateStudioComponent(badAttrs);
    expect(attrProblems.some((p) => p.includes('"onclick" is not allowed'))).toBe(true);
    expect(attrProblems.some((p) => p.includes("unsafe URL scheme"))).toBe(true);
  });

  it("rejects undeclared slots and interpolations", () => {
    const bad = {
      ...VALID,
      template: {
        tag: "div",
        children: [{ slot: "nope" }, { text: "hi {props.missing}" }],
      },
    };
    const problems = validateStudioComponent(bad);
    expect(problems.some((p) => p.includes('slot "nope"'))).toBe(true);
    expect(problems.some((p) => p.includes("{props.missing}"))).toBe(true);
  });

  it("rejects name collisions and bad names", () => {
    expect(
      validateStudioComponent(VALID, new Set(["PromoCard"])).some((p) =>
        p.includes("already taken"),
      ),
    ).toBe(true);
    expect(
      validateStudioComponent({ ...VALID, name: "promoCard" }).some((p) =>
        p.includes("PascalCase"),
      ),
    ).toBe(true);
  });
});

describe("studioComponentToSpec", () => {
  it("maps props to registry controls under the Studio category", () => {
    const spec = studioComponentToSpec(VALID);
    expect(spec.name).toBe("PromoCard");
    expect(spec.category).toBe("Studio");
    expect(spec.children.policy).toBe("none");
    expect(spec.props.map((p) => [p.name, p.control.type, p.required])).toEqual([
      ["title", "text", true],
      ["href", "text", false],
      ["count", "number", false],
    ]);
    expect(spec.props[1]?.default).toBe("#");
  });
});

describe("parse + helpers", () => {
  it("round-trips through JSON and reports problems", () => {
    expect(parseStudioComponent(JSON.stringify(VALID)).def?.name).toBe("PromoCard");
    expect(parseStudioComponent("{not json").problems[0]).toMatch(/invalid JSON/);
    expect(parseStudioComponent('{"name":1}').def).toBeNull();
  });

  it("extracts interpolated prop names", () => {
    expect(interpolatedProps("a {props.x} b {props.y}")).toEqual(["x", "y"]);
  });

  it("builds the storage path", () => {
    expect(studioComponentPath("content", "PromoCard")).toBe(
      "content/_components/PromoCard.json",
    );
  });
});
