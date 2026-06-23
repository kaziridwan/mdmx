// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ControlSpec, JsonValue } from "@mdmx/core";
import { Control } from "../src/react/controls.js";
import { MediaPickerContext, type RequestMedia } from "../src/react/media-context.js";
import type { MediaItem } from "../src/react/media.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

async function renderControl(opts: {
  control: ControlSpec;
  value?: JsonValue;
  onChange?: (raw: string) => void;
  requestMedia?: RequestMedia;
}): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const control = createElement(Control, {
    control: opts.control,
    value: opts.value,
    onChange: opts.onChange ?? (() => {}),
  });
  root.render(
    opts.requestMedia
      ? createElement(MediaPickerContext.Provider, { value: opts.requestMedia }, control)
      : control,
  );
  await flush();
  return host;
}

describe("Control — image type", () => {
  it("offers Browse when a media picker is available and routes the pick to onChange", async () => {
    const onChange = vi.fn();
    let captured: ((item: MediaItem) => void) | null = null;
    const requestMedia: RequestMedia = (onPick) => {
      captured = onPick;
    };
    const el = await renderControl({
      control: { type: "image" },
      value: "",
      onChange,
      requestMedia,
    });

    const browse = el.querySelector(".mdmx-control-browse") as HTMLButtonElement;
    expect(browse).not.toBeNull();
    browse.click();
    expect(captured).not.toBeNull();
    captured!({ path: "public/media/logo.png", url: "/media/logo.png" });
    expect(onChange).toHaveBeenCalledWith("/media/logo.png");
  });

  it("hides Browse when no media picker is wired", async () => {
    const el = await renderControl({ control: { type: "image" }, value: "" });
    expect(el.querySelector(".mdmx-control-browse")).toBeNull();
    // Still a usable text input.
    expect(el.querySelector("input.mdmx-control")).not.toBeNull();
  });

  it("renders a thumbnail preview for an image-looking value", async () => {
    const el = await renderControl({ control: { type: "image" }, value: "/media/hero.jpg" });
    const preview = el.querySelector("img.mdmx-control-preview") as HTMLImageElement;
    expect(preview).not.toBeNull();
    expect(preview.getAttribute("src")).toBe("/media/hero.jpg");
  });

  it("does not preview a non-image value", async () => {
    const el = await renderControl({ control: { type: "image" }, value: "not-an-image" });
    expect(el.querySelector("img.mdmx-control-preview")).toBeNull();
  });
});
