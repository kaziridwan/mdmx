// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Registry } from "@mdmx/core";
import type { ApiClient, Me } from "../src/api-client.js";
import { resolveConfig } from "../src/config.js";
import { DashboardContext, type DashboardContextValue } from "../src/context.js";
import { bytesToBase64, prepareUpload, safeFilename } from "../src/views/media-upload.js";
import { MediaView } from "../src/views/MediaView.js";
import { SettingsView } from "../src/views/SettingsView.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
  delete document.documentElement.dataset.mdmxTheme;
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

const me: Me = {
  login: "local",
  repo: { owner: "local", name: "demo", branch: "main" },
  contentDir: "content",
  mediaDir: "public/media",
  validation: "strict",
  localMode: true,
};

function makeContext(api: Partial<ApiClient>): DashboardContextValue {
  return {
    config: resolveConfig(),
    api: api as ApiClient,
    me,
    registry: new Registry({ mdmxRegistryVersion: 1, components: [] }),
    collections: [],
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

describe("media-upload helpers", () => {
  it("sanitizes filenames and base64-encodes bytes", async () => {
    expect(safeFilename("My Photo (1).PNG")).toBe("my-photo-1.png");
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe(btoa("hi"));
    const file = new File([new Uint8Array([1, 2, 3])], "A B.png", { type: "image/png" });
    const upload = await prepareUpload(file, "public/media");
    expect(upload.path).toBe("public/media/a-b.png");
    expect(atob(upload.dataBase64)).toBe("\x01\x02\x03");
  });
});

describe("MediaView", () => {
  it("lists images only and uploads through the API", async () => {
    const listFiles = vi.fn(async () => [
      { path: "public/media/logo.svg", sha: "s1", size: 10 },
      { path: "public/media/readme.txt", sha: "s2", size: 10 },
    ]);
    const uploadMedia = vi.fn(async () => ({ commit: {}, path: "public/media/new.png" }));
    const el = await mount(
      makeContext({ listFiles, uploadMedia }),
      createElement(MediaView, {}),
    );
    const imgs = el.querySelectorAll("img");
    expect(imgs).toHaveLength(1); // .txt filtered out
    expect(imgs[0]!.getAttribute("src")).toBe("/media/logo.svg");

    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([9])], "shot.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    for (let i = 0; i < 8; i++) await flush();
    expect(uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({ path: "public/media/shot.png" }),
    );
  });

  it("deletes with the listed sha after confirm", async () => {
    const listFiles = vi.fn(async () => [{ path: "public/media/x.png", sha: "sx", size: 1 }]);
    const deleteFile = vi.fn(async () => ({ commit: {} }));
    vi.stubGlobal("confirm", vi.fn(() => true));
    const el = await mount(
      makeContext({ listFiles, deleteFile }),
      createElement(MediaView, {}),
    );
    (el.querySelector('button[aria-label^="Delete"]') as HTMLButtonElement).click();
    for (let i = 0; i < 6; i++) await flush();
    expect(deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: "public/media/x.png", expectedSha: "sx" }),
    );
  });
});

describe("SettingsView", () => {
  it("shows session, dirs, validation mode, and registry stats", async () => {
    const el = await mount(makeContext({}), createElement(SettingsView, {}));
    expect(el.textContent).toContain("local/demo");
    expect(el.textContent).toContain("content/");
    expect(el.textContent).toContain("public/media/");
    expect(el.textContent).toContain("strict");
    expect(el.textContent).toContain("0 components, 0 collections");
    expect(el.querySelector(".mdmx-dash-badge")?.textContent).toBe("local");
  });

  it("pins and unpins the theme via data attribute + localStorage", async () => {
    const el = await mount(makeContext({}), createElement(SettingsView, {}));
    const buttons = Array.from(el.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    const dark = buttons.find((b) => b.textContent === "dark")!;
    dark.click();
    await flush();
    expect(document.documentElement.dataset.mdmxTheme).toBe("dark");
    expect(window.localStorage.getItem("mdmx-theme")).toBe("dark");

    const system = buttons.find((b) => b.textContent === "system")!;
    system.click();
    await flush();
    expect(document.documentElement.dataset.mdmxTheme).toBeUndefined();
    expect(window.localStorage.getItem("mdmx-theme")).toBeNull();
  });
});
