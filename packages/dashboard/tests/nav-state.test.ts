// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  isEditableTarget,
  isNavToggleShortcut,
  readStoredNavCollapsed,
  storeNavCollapsed,
} from "../src/shell/nav-state.js";

describe("dashboard nav state (ADR-056)", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the collapsed state and treats junk as unset", () => {
    expect(readStoredNavCollapsed()).toBeNull();
    storeNavCollapsed(true);
    expect(readStoredNavCollapsed()).toBe(true);
    expect(localStorage.getItem("mdmx:dash-nav-collapsed")).toBe("true");
    storeNavCollapsed(false);
    expect(readStoredNavCollapsed()).toBe(false);
    localStorage.setItem("mdmx:dash-nav-collapsed", "yes");
    expect(readStoredNavCollapsed()).toBeNull();
  });

  it("recognizes Mod-\\ and nothing else", () => {
    const base = { key: "\\", metaKey: false, ctrlKey: false, altKey: false };
    expect(isNavToggleShortcut({ ...base, metaKey: true })).toBe(true);
    expect(isNavToggleShortcut({ ...base, ctrlKey: true })).toBe(true);
    expect(isNavToggleShortcut({ ...base, key: "|", code: "Backslash", metaKey: true })).toBe(true);
    expect(isNavToggleShortcut(base)).toBe(false);
    expect(isNavToggleShortcut({ ...base, metaKey: true, altKey: true })).toBe(false);
    expect(isNavToggleShortcut({ ...base, key: "k", metaKey: true })).toBe(false);
  });

  it("yields to text editors: inputs, contenteditable, ProseMirror, CodeMirror", () => {
    const html = (markup: string) => {
      const host = document.createElement("div");
      host.innerHTML = markup;
      document.body.appendChild(host);
      return host;
    };
    const input = html('<input id="i">').querySelector("input")!;
    expect(isEditableTarget(input)).toBe(true);
    const pm = html('<div class="ProseMirror" contenteditable="true"><p>x</p></div>').querySelector("p")!;
    expect(isEditableTarget(pm)).toBe(true);
    const cm = html('<div class="cm-editor"><div class="cm-content"><div class="cm-line">x</div></div></div>').querySelector(".cm-line")!;
    expect(isEditableTarget(cm)).toBe(true);
    const plain = html("<div><span>x</span></div>").querySelector("span")!;
    expect(isEditableTarget(plain)).toBe(false);
    expect(isEditableTarget(document)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
