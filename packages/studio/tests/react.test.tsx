import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { studioComponent, studioRenderComponents } from "../src/react.js";
import { interpolate, type StudioComponentDef } from "../src/index.js";

const def: StudioComponentDef = {
  name: "PromoCard",
  props: [
    { name: "title", type: "string", default: "Default title" },
    { name: "href", type: "string" },
  ],
  template: {
    tag: "section",
    classes: "rounded p-4",
    children: [
      { tag: "h3", children: [{ text: "{props.title}" }] },
      { tag: "a", attrs: { href: "{props.href}" }, children: [{ slot: "title" }] },
    ],
  },
};

describe("studioComponent", () => {
  it("renders the template with props interpolated into text and attributes", () => {
    const Promo = studioComponent(def);
    const html = renderToStaticMarkup(
      createElement(Promo, { title: "Hello", href: "/x" }),
    );
    expect(html).toContain("<h3>Hello</h3>");
    expect(html).toContain('href="/x"');
    expect(html).toContain('class="rounded p-4"');
  });

  it("applies prop defaults and renders missing values as empty", () => {
    const Promo = studioComponent(def);
    const html = renderToStaticMarkup(createElement(Promo, {}));
    expect(html).toContain("Default title");
    expect(html).toContain('href=""');
  });

  it("builds a component map keyed by definition name", () => {
    const map = studioRenderComponents([def]);
    expect(Object.keys(map)).toEqual(["PromoCard"]);
    expect(map.PromoCard!.displayName).toBe("Studio(PromoCard)");
  });
});

describe("interpolate", () => {
  it("is shared with validation and eject — one regex, one behavior", () => {
    expect(interpolate("a {props.x} b", { x: 1 })).toBe("a 1 b");
    expect(interpolate("{props.missing}", {})).toBe("");
    // Repeated calls must not be affected by the /g regex's lastIndex.
    expect(interpolate("{props.x}", { x: "v" })).toBe("v");
    expect(interpolate("{props.x}", { x: "v" })).toBe("v");
  });
});
