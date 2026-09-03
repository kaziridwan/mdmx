// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RenderBoundary } from "../src/react/ComponentBlock.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

function Live({ value }: { value: string }) {
  if (value === "boom") throw new Error("boom");
  return createElement("span", { "data-role": "live" }, value);
}

async function render(props: { value: string }) {
  if (!host) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  const silence = console.error;
  console.error = () => {}; // React logs the caught error; the test expects it.
  try {
    root!.render(
      createElement(RenderBoundary, {
        fallback: createElement("div", { "data-role": "fallback" }),
        resetKey: props,
        children: createElement(Live, props),
      }),
    );
    for (let i = 0; i < 4; i++) await flush();
  } finally {
    console.error = silence;
  }
  return host!;
}

describe("RenderBoundary reset (ADR-058)", () => {
  it("degrades a throwing render to the fallback, and revives when the props identity changes", async () => {
    let el = await render({ value: "boom" });
    expect(el.querySelector('[data-role="fallback"]')).not.toBeNull();
    expect(el.querySelector('[data-role="live"]')).toBeNull();

    el = await render({ value: "fixed" });
    expect(el.querySelector('[data-role="live"]')?.textContent).toBe("fixed");
    expect(el.querySelector('[data-role="fallback"]')).toBeNull();
  });

  it("stays on the fallback when the retry throws again (no loop)", async () => {
    let el = await render({ value: "boom" });
    el = await render({ value: "boom" });
    expect(el.querySelector('[data-role="fallback"]')).not.toBeNull();
  });
});
