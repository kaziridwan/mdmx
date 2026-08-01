// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Registry, type CollectionSpec } from "@mdmx/core";
import type { ApiClient, Me } from "../src/api-client.js";
import { resolveConfig } from "../src/config.js";
import { DashboardContext, type DashboardContextValue } from "../src/context.js";
import { QuickOpen } from "../src/shell/QuickOpen.js";
import {
  filterItems,
  navigationItems,
  scoreMatch,
  type QuickOpenItem,
} from "../src/shell/quick-open.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("scoreMatch / filterItems", () => {
  it("ranks prefix over word-prefix over substring, and drops misses", () => {
    expect(scoreMatch("wel", "welcome to mdmx")).toBeGreaterThan(
      scoreMatch("wel", "not welcome"),
    );
    expect(scoreMatch("wel", "not welcome")).toBeGreaterThan(scoreMatch("wel", "unwelcome"));
    expect(scoreMatch("zzz", "welcome")).toBe(0);
  });

  it("label matches outrank detail matches; empty query returns head", () => {
    const items: QuickOpenItem[] = [
      { kind: "entry", label: "Pricing", detail: "content/posts/pricing.mdx", href: "/a" },
      { kind: "entry", label: "Other", detail: "content/pricing/x.mdx", href: "/b" },
      { kind: "page", label: "Media", href: "/c" },
    ];
    const ranked = filterItems(items, "pricing");
    expect(ranked.map((i) => i.href)).toEqual(["/a", "/b"]);
    expect(filterItems(items, "")).toHaveLength(3);
  });

  it("builds navigation + new-entry actions from collections", () => {
    const collections: CollectionSpec[] = [{ name: "posts", dir: "content/posts", fields: [] }];
    const items = navigationItems("/mdmx", collections);
    expect(items.map((i) => i.label)).toEqual([
      "posts",
      "Media",
      "Settings",
      "New collection",
      "New posts entry",
    ]);
  });
});

// ---------------------------------------------------------------------------

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
});

const me: Me = {
  login: "local",
  repo: { owner: "local", name: "demo", branch: "main" },
  contentDir: "content",
  mediaDir: "public/media",
  validation: "report",
  localMode: true,
};

function makeContext(api: Partial<ApiClient>): DashboardContextValue {
  return {
    config: resolveConfig(),
    api: api as ApiClient,
    me,
    registry: new Registry({ mdmxRegistryVersion: 1, components: [] }),
    collections: [{ name: "posts", dir: "content/posts", fields: [] }],
    refreshCollections: async () => {},
    studio: { entries: [], refresh: async () => {} },
  };
}

async function mountPalette(api: Partial<ApiClient>): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    createElement(DashboardContext.Provider, { value: makeContext(api) },
      createElement(QuickOpen, {})),
  );
  for (let i = 0; i < 6; i++) await flush();
  return host;
}

function press(key: string, init: KeyboardEventInit = {}): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
}

describe("QuickOpen", () => {
  it("opens on Cmd+K, searches entries, Enter navigates", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign } as unknown as Location);
    const listEntries = vi.fn(async () => [
      {
        path: "content/posts/welcome.mdx",
        sha: "s",
        frontmatter: { title: "Welcome to MDMX" },
      },
      { path: "content/posts/roadmap.mdx", sha: "s", frontmatter: { title: "Roadmap" } },
    ]);
    const el = await mountPalette({ listEntries });

    expect(el.querySelector(".mdmx-dash-palette")).toBeNull();
    press("k", { metaKey: true });
    for (let i = 0; i < 6; i++) await flush();
    expect(el.querySelector(".mdmx-dash-palette")).not.toBeNull();
    expect(listEntries).toHaveBeenCalledWith("content");

    const input = el.querySelector(".mdmx-dash-palette-input") as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(input, "welc");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    for (let i = 0; i < 4; i++) await flush();

    const rows = el.querySelectorAll(".mdmx-dash-palette-item");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain("Welcome to MDMX");

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await flush();
    expect(assign).toHaveBeenCalledWith("/mdmx/edit/content/posts/welcome.mdx");
    expect(el.querySelector(".mdmx-dash-palette")).toBeNull(); // closed
  });

  it("closes on Escape and includes navigation targets", async () => {
    const listEntries = vi.fn(async () => []);
    const el = await mountPalette({ listEntries });
    press("k", { ctrlKey: true });
    for (let i = 0; i < 6; i++) await flush();
    expect(el.textContent).toContain("Settings");
    expect(el.textContent).toContain("New posts entry");
    press("Escape");
    for (let i = 0; i < 4; i++) await flush();
    expect(el.querySelector(".mdmx-dash-palette")).toBeNull();
  });
});
