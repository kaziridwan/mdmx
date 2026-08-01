// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Registry, type CollectionSpec } from "@mdmx/core";
import type { ApiClient, Me } from "../src/api-client.js";
import { resolveConfig } from "../src/config.js";
import { DashboardContext, type DashboardContextValue } from "../src/context.js";
import { CollectionView } from "../src/views/CollectionView.js";
import { EntryNewView } from "../src/views/EntryNewView.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const posts: CollectionSpec = {
  name: "posts",
  dir: "content/posts",
  fields: [
    { name: "title", required: true, control: { type: "text" } },
    {
      name: "status",
      required: true,
      control: { type: "select", options: ["draft", "published"] },
      default: "draft",
    },
  ],
};

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
    collections: [posts],
    refreshCollections: async () => {},
    studio: { entries: [], refresh: async () => {} },
  };
}

async function mount(value: DashboardContextValue, children: ReactNode): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(createElement(DashboardContext.Provider, { value }, children));
  for (let i = 0; i < 8; i++) await flush();
  return host;
}

describe("CollectionView", () => {
  it("renders the entry table from /documents with status badges", async () => {
    const listEntries = vi.fn(async () => [
      {
        path: "content/posts/a.mdx",
        sha: "sha-a",
        frontmatter: { title: "Alpha", status: "published" },
      },
      { path: "content/posts/b.mdx", sha: "sha-b", frontmatter: { status: "draft" } },
    ]);
    const el = await mount(
      makeContext({ listEntries }),
      createElement(CollectionView, { name: "posts" }),
    );
    expect(listEntries).toHaveBeenCalledWith("content/posts");
    const rows = el.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Alpha");
    expect(rows[1]!.textContent).toContain("b.mdx"); // no title → filename
    expect(el.querySelector(".mdmx-dash-status.is-published")).not.toBeNull();
    // Row titles link into the dashboard editor.
    const link = rows[0]!.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/mdmx/edit/content/posts/a.mdx");
  });

  it("deletes an entry (confirmed) with the sha it listed", async () => {
    const listEntries = vi.fn(async () => [
      { path: "content/posts/a.mdx", sha: "sha-a", frontmatter: { title: "Alpha" } },
    ]);
    const deleteFile = vi.fn(async () => ({ commit: {} }));
    vi.stubGlobal("confirm", vi.fn(() => true));
    const el = await mount(
      makeContext({ listEntries, deleteFile }),
      createElement(CollectionView, { name: "posts" }),
    );
    (el.querySelector('button[aria-label^="Delete"]') as HTMLButtonElement).click();
    for (let i = 0; i < 6; i++) await flush();
    expect(deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: "content/posts/a.mdx", expectedSha: "sha-a" }),
    );
    vi.unstubAllGlobals();
  });
});

describe("EntryNewView", () => {
  it("scaffolds a create-only save from title", async () => {
    const saveFile = vi.fn(async (_args: Parameters<ApiClient["saveFile"]>[0]) => ({
      commit: {},
      sha: "0".repeat(40),
      diagnostics: [],
    }));
    const assign = vi.fn();
    vi.stubGlobal("location", { assign } as unknown as Location);

    const el = await mount(
      makeContext({ saveFile }),
      createElement(EntryNewView, { collectionName: "posts" }),
    );
    const inputs = el.querySelectorAll("input");
    const title = inputs[0] as HTMLInputElement;
    // React 19 tracks input values through its own setter; go through the
    // native setter + input event so onChange fires in jsdom.
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(title, "Hello World");
    title.dispatchEvent(new Event("input", { bubbles: true }));
    for (let i = 0; i < 4; i++) await flush();

    (el.querySelector("form") as HTMLFormElement).requestSubmit();
    for (let i = 0; i < 6; i++) await flush();

    expect(saveFile).toHaveBeenCalledTimes(1);
    const arg = saveFile.mock.calls[0]![0] as {
      path: string;
      content: string;
      expectedSha: null;
    };
    expect(arg.path).toBe("content/posts/hello-world.mdx");
    expect(arg.expectedSha).toBeNull(); // never clobber an existing entry
    expect(arg.content).toContain("title: Hello World");
    expect(arg.content).toContain("status: draft");
    expect(assign).toHaveBeenCalledWith("/mdmx/edit/content/posts/hello-world.mdx");
    vi.unstubAllGlobals();
  });
});
