// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Registry, type RegistrySpec } from "@imdx/core";
import { buildSchema } from "../src/schema.js";
import { Rail } from "../src/react/Rail.js";

const spec: RegistrySpec = {
  imdxRegistryVersion: 1,
  components: [
    { name: "Callout", category: "Content", children: { policy: "rich-text" }, props: [] },
    { name: "Hero", category: "Marketing", children: { policy: "none" }, props: [] },
    { name: "Chart", category: "Data", children: { policy: "none" }, props: [] },
  ],
};

const flush = () => new Promise((r) => setTimeout(r, 0));

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = host = null;
});

async function renderRail(): Promise<HTMLElement> {
  const registry = new Registry(spec);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    createElement(Rail, { registry, schema: buildSchema(registry), view: null }),
  );
  await flush();
  return host;
}

const names = (el: HTMLElement) =>
  Array.from(el.querySelectorAll(".imdx-rail-name")).map((n) => n.textContent);
const labels = (el: HTMLElement) =>
  Array.from(el.querySelectorAll(".imdx-rail-group-label")).map((n) =>
    n.textContent?.replace(/[▸▾]/g, "").trim(),
  );

describe("Rail (jsdom)", () => {
  it("groups components by category", async () => {
    const el = await renderRail();
    expect(labels(el)).toEqual(["Content", "Marketing", "Data"]);
    expect(names(el)).toEqual(["Callout", "Hero", "Chart"]);
  });

  it("filters by the search query", async () => {
    const el = await renderRail();
    typeInto(el.querySelector('[aria-label="Filter components"]') as HTMLInputElement, "chart");
    await flush();
    expect(names(el)).toEqual(["Chart"]);
    expect(labels(el)).toEqual(["Data"]);
  });

  it("collapses a group when its header is clicked", async () => {
    const el = await renderRail();
    const contentHeader = Array.from(
      el.querySelectorAll(".imdx-rail-group-label"),
    ).find((b) => b.textContent?.includes("Content")) as HTMLButtonElement;
    contentHeader.click();
    await flush();
    expect(contentHeader.getAttribute("aria-expanded")).toBe("false");
    expect(names(el)).toEqual(["Hero", "Chart"]); // Callout hidden
  });
});
