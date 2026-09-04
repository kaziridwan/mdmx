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
  onChange?: (value: JsonValue | undefined) => void;
  allowEmpty?: boolean;
  requestMedia?: RequestMedia;
}): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const control = createElement(Control, {
    control: opts.control,
    value: opts.value,
    onChange: opts.onChange ?? (() => {}),
    ...(opts.allowEmpty !== undefined ? { allowEmpty: opts.allowEmpty } : {}),
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

const fire = (input: Element, value: string) => {
  const proto = input instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};

describe("Control — value-typed scalars (ADR-058)", () => {
  it("emits coerced values and undefined for empty", async () => {
    const onChange = vi.fn();
    let el = await renderControl({ control: { type: "number" }, value: 1, onChange });
    fire(el.querySelector("input")!, "42");
    expect(onChange).toHaveBeenLastCalledWith(42);
    fire(el.querySelector("input")!, "");
    expect(onChange).toHaveBeenLastCalledWith(undefined);

    root?.unmount(); host?.remove();
    el = await renderControl({ control: { type: "boolean" }, value: false, onChange });
    (el.querySelector("input") as HTMLInputElement).click();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("select drops the empty option when allowEmpty is off", async () => {
    let el = await renderControl({ control: { type: "select", options: ["a", "b"] }, value: "a", allowEmpty: false });
    expect(Array.from(el.querySelectorAll("option")).map((o) => o.value)).toEqual(["a", "b"]);
    root?.unmount(); host?.remove();
    el = await renderControl({ control: { type: "select", options: ["a", "b"] }, value: undefined });
    expect(Array.from(el.querySelectorAll("option")).map((o) => o.value)).toEqual(["", "a", "b"]);
  });

  it("link, color, and date render their own inputs", async () => {
    let el = await renderControl({ control: { type: "link", placeholder: "https://…" }, value: "/docs" });
    const link = el.querySelector("input") as HTMLInputElement;
    expect(link.placeholder).toBe("https://…");
    expect(link.value).toBe("/docs");
    root?.unmount(); host?.remove();
    el = await renderControl({ control: { type: "color" }, value: "#ff0000" });
    expect((el.querySelector('input[type="color"]') as HTMLInputElement).value).toBe("#ff0000");
    expect((el.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("#ff0000");
    root?.unmount(); host?.remove();
    el = await renderControl({ control: { type: "date" }, value: "2026-09-03" });
    expect((el.querySelector('input[type="date"]') as HTMLInputElement).value).toBe("2026-09-03");
  });
});

describe("Control — list and object (ADR-058)", () => {
  const list = { type: "list", item: { type: "text" } } as const;

  it("renders one row per item and emits arrays on add / edit / remove / move", async () => {
    const onChange = vi.fn();
    const el = await renderControl({ control: list, value: ["a", "b"], onChange });
    expect(el.querySelectorAll(".mdmx-control-list-row")).toHaveLength(2);
    (el.querySelector(".mdmx-control-list-add") as HTMLButtonElement).click();
    expect(onChange).toHaveBeenLastCalledWith(["a", "b", ""]);
    fire(el.querySelectorAll(".mdmx-control-list-row input")[0]!, "A");
    expect(onChange).toHaveBeenLastCalledWith(["A", "b"]);
    (el.querySelectorAll('[aria-label="Move item down"]')[0] as HTMLButtonElement).click();
    expect(onChange).toHaveBeenLastCalledWith(["b", "a"]);
    (el.querySelectorAll('[aria-label="Remove item"]')[1] as HTMLButtonElement).click();
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
  });

  it("an emptied list unsets the prop; a cleared row keeps an empty item", async () => {
    const onChange = vi.fn();
    const el = await renderControl({ control: list, value: ["only"], onChange });
    fire(el.querySelector(".mdmx-control-list-row input")!, "");
    expect(onChange).toHaveBeenLastCalledWith([""]);
    (el.querySelector('[aria-label="Remove item"]') as HTMLButtonElement).click();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("object renders a control per field and emits objects, dropping cleared keys", async () => {
    const onChange = vi.fn();
    const control = { type: "object", fields: { legend: { type: "text" }, max: { type: "number" } } } as const;
    const el = await renderControl({ control, value: { legend: "Sales" }, onChange });
    const keys = Array.from(el.querySelectorAll(".mdmx-control-object-key")).map((k) => k.textContent);
    expect(keys).toEqual(["legend", "max"]);
    fire(el.querySelectorAll(".mdmx-control-object-field input")[1]!, "10");
    expect(onChange).toHaveBeenLastCalledWith({ legend: "Sales", max: 10 });
    fire(el.querySelectorAll(".mdmx-control-object-field input")[0]!, "");
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
