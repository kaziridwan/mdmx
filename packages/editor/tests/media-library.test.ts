// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { MDMXEditor } from "../src/react/index.js";
import { MediaLibrary } from "../src/react/MediaLibrary.js";
import type { MediaItem, MediaSource, MediaUpload } from "../src/react/media.js";

/** Set an input's value through React's tracked native setter, then fire `input`. */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => {
  for (let i = 0; i < 5; i++) await flush();
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

/** In-memory media source backed by a mutable array. */
function fakeMedia(initial: MediaItem[] = []): MediaSource & { items: MediaItem[] } {
  const items = [...initial];
  return {
    items,
    list: async () => [...items],
    upload: async (u: MediaUpload) => {
      const item: MediaItem = { path: u.path, url: "/" + u.path.split("/").slice(1).join("/") };
      items.push(item);
      return item;
    },
  };
}

async function render(node: ReturnType<typeof createElement>): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(node);
  await settle();
  return host;
}

describe("MediaLibrary (jsdom)", () => {
  const ITEMS: MediaItem[] = [
    { path: "public/media/logo.png", url: "/media/logo.png" },
    { path: "public/media/banner.jpg", url: "/media/banner.jpg" },
  ];

  it("lists assets from the source", async () => {
    const el = await render(
      createElement(MediaLibrary, {
        media: fakeMedia(ITEMS),
        mediaDir: "public/media",
        onPick: () => {},
        onClose: () => {},
      }),
    );
    const names = Array.from(el.querySelectorAll(".mdmx-media-name")).map((n) => n.textContent);
    expect(names).toEqual(["logo.png", "banner.jpg"]);
    expect(el.querySelectorAll("img.mdmx-media-thumb")).toHaveLength(2);
  });

  it("filters by the search query", async () => {
    const el = await render(
      createElement(MediaLibrary, {
        media: fakeMedia(ITEMS),
        mediaDir: "public/media",
        onPick: () => {},
        onClose: () => {},
      }),
    );
    const search = el.querySelector('[aria-label="Search media"]') as HTMLInputElement;
    typeInto(search, "banner");
    await settle();
    const names = Array.from(el.querySelectorAll(".mdmx-media-name")).map((n) => n.textContent);
    expect(names).toEqual(["banner.jpg"]);
  });

  it("calls onPick when an asset is clicked", async () => {
    const onPick = vi.fn();
    const el = await render(
      createElement(MediaLibrary, {
        media: fakeMedia(ITEMS),
        mediaDir: "public/media",
        onPick,
        onClose: () => {},
      }),
    );
    (el.querySelector(".mdmx-media-item") as HTMLButtonElement).click();
    expect(onPick).toHaveBeenCalledWith(ITEMS[0]);
  });

  it("uploads a picked file and yields the new asset", async () => {
    const media = fakeMedia();
    const onPick = vi.fn();
    const el = await render(
      createElement(MediaLibrary, {
        media,
        mediaDir: "public/media",
        onPick,
        onClose: () => {},
      }),
    );
    // Empty state initially.
    expect(el.querySelector(".mdmx-media-empty")?.textContent).toContain("No media yet");

    const input = el.querySelector('[aria-label="Upload media"]') as HTMLInputElement;
    // A file-like object (jsdom's File.arrayBuffer is unreliable); fileToUpload
    // only needs `name` + `arrayBuffer`.
    const file = {
      name: "New Pic.png",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    };
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    expect(media.items.map((i) => i.path)).toEqual(["public/media/new-pic.png"]);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].path).toBe("public/media/new-pic.png");
  });
});

const registrySpec: RegistrySpec = { mdmxRegistryVersion: 1, components: [] };

describe("MDMXEditor media integration (jsdom)", () => {
  it("inserts an image into the document when one is picked", async () => {
    const media = fakeMedia([{ path: "public/media/logo.png", url: "/media/logo.png" }]);
    const el = await render(
      createElement(MDMXEditor, {
        registry: new Registry(registrySpec),
        source: "Hello.\n",
        media,
        mediaDir: "public/media",
      }),
    );

    const openBtn = el.querySelector(".mdmx-toolbar-image") as HTMLButtonElement;
    expect(openBtn).not.toBeNull();
    openBtn.click();
    await settle();

    const item = el.querySelector(".mdmx-media-item") as HTMLButtonElement;
    expect(item).not.toBeNull();
    item.click();
    await settle();

    // The library closed and an image node now lives in the canvas + source.
    expect(el.querySelector(".mdmx-media-overlay")).toBeNull();
    expect(el.querySelector(".ProseMirror img")).not.toBeNull();
    const source = Array.from(el.querySelectorAll(".mdmx-source-line"))
      .map((n) => n.textContent)
      .join("\n");
    expect(source).toContain("![](/media/logo.png)");
  });

  it("shows no image button when no media source is provided", async () => {
    const el = await render(
      createElement(MDMXEditor, {
        registry: new Registry(registrySpec),
        source: "Hello.\n",
      }),
    );
    expect(el.querySelector(".mdmx-toolbar-image")).toBeNull();
  });
});
