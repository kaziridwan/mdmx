// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Registry, type CollectionSpec, type RegistrySpec } from "@imdx/core";
import { IMDXEditor } from "../src/react/index.js";

const collection: CollectionSpec = {
  name: "posts",
  dir: "content/posts",
  fields: [
    { name: "title", required: true, control: { type: "text" } },
    {
      name: "status",
      required: true,
      control: { type: "select", options: ["draft", "published"] },
    },
  ],
};

const registrySpec: RegistrySpec = {
  imdxRegistryVersion: 1,
  components: [
    {
      name: "Note",
      children: { policy: "rich-text" },
      props: [
        {
          name: "variant",
          required: true,
          control: { type: "select", options: ["info", "warn"] },
          default: "info",
        },
      ],
    },
    {
      name: "Stat",
      children: { policy: "none" },
      props: [{ name: "value", required: true, control: { type: "text" } }],
    },
    {
      name: "TwoColumn",
      children: { policy: "blocks" },
      constraints: { allowedParents: null, allowedChildren: ["Column"] },
      props: [],
    },
    {
      name: "Column",
      children: { policy: "blocks" },
      constraints: { allowedParents: ["TwoColumn"], allowedChildren: null },
      props: [],
    },
  ],
};

// Live components: Note renders its children (the editable hole); Stat is a leaf.
const Note = (props: { children?: ReactNode }) =>
  createElement("aside", { "data-role": "note" }, props.children);
const Stat = (props: { value?: string }) =>
  createElement("span", { "data-role": "stat" }, props.value);
const TwoColumn = (props: { children?: ReactNode }) =>
  createElement("div", { "data-role": "twocol" }, props.children);
const Column = (props: { children?: ReactNode }) =>
  createElement("div", { "data-role": "col" }, props.children);

const SRC = `# Hi

Hello **world**.

<Note variant="warn">
  Inside the note.
</Note>

<Stat value="42" />
`;

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Click a sidebar tab ("Source" | "Properties") and let React settle. */
async function switchSidebar(el: HTMLElement, label: "Source" | "Properties") {
  const tab = el.querySelector(
    `.imdx-sidebar-tab[aria-label="${label}"]`,
  ) as HTMLButtonElement;
  tab.click();
  for (let i = 0; i < 4; i++) await flush();
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

async function mountEditor(
  source: string,
  withCollection?: CollectionSpec,
): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    createElement(IMDXEditor, {
      registry: new Registry(registrySpec),
      components: { Note, Stat, TwoColumn, Column },
      source,
      collection: withCollection,
    }),
  );
  // Let React effects (EditorView creation) and the per-node React roots settle.
  for (let i = 0; i < 4; i++) await flush();
  return host;
}

describe("IMDXEditor mount (jsdom)", () => {
  it("renders the document into a ProseMirror canvas", async () => {
    const el = await mountEditor(SRC);
    const pm = el.querySelector(".ProseMirror");
    expect(pm).not.toBeNull();
    expect(pm!.querySelector("h1")?.textContent).toBe("Hi");
    expect(el.querySelector('[data-imdx-component="Note"]')).not.toBeNull();
    expect(el.querySelector('[data-imdx-component="Stat"]')).not.toBeNull();
  });

  it("places the editable contentDOM inside a rich-text component's render", async () => {
    const el = await mountEditor(SRC);
    const note = el.querySelector('[data-role="note"]');
    expect(note).not.toBeNull();
    // The author component received the hole as children; PM's contentDOM lives there.
    const contentdom = note!.querySelector(".imdx-contentdom");
    expect(contentdom).not.toBeNull();
    expect(contentdom!.textContent).toContain("Inside the note.");
  });

  it("renders a leaf component live with no contentDOM", async () => {
    const el = await mountEditor(SRC);
    const stat = el.querySelector('[data-role="stat"]');
    expect(stat?.textContent).toBe("42");
    expect(
      el.querySelector('[data-imdx-component="Stat"] .imdx-contentdom'),
    ).toBeNull();
  });

  it("shows live canonical source matching the input byte-for-byte", async () => {
    const el = await mountEditor(SRC);
    const source = el.querySelector(".imdx-source-pre");
    expect(source).not.toBeNull();
    // Each line is its own div; blank lines render a cosmetic space placeholder.
    // Normalize whitespace-only lines and trailing blanks, then compare.
    const lines = Array.from(source!.querySelectorAll(".imdx-source-line")).map((n) =>
      (n.textContent ?? "").trim() === "" ? "" : n.textContent!,
    );
    const rendered = lines.join("\n").replace(/\n+$/, "");
    expect(rendered).toBe(SRC.replace(/\n+$/, ""));
  });
});

describe("unified sidebar (source ⇄ properties)", () => {
  it("defaults to the source view and toggles to properties and back", async () => {
    const el = await mountEditor(SRC);
    const tabs = el.querySelectorAll(".imdx-sidebar-tab");
    expect(tabs).toHaveLength(2);

    // Default: source visible, no properties panel.
    expect(el.querySelector(".imdx-source-pre")).not.toBeNull();
    expect(el.querySelector(".imdx-props")).toBeNull();
    expect(
      el.querySelector('.imdx-sidebar-tab[aria-label="Source"]')!.getAttribute("aria-selected"),
    ).toBe("true");

    // Toggle to properties: the document panel appears, source is gone.
    await switchSidebar(el, "Properties");
    expect(el.querySelector(".imdx-source-pre")).toBeNull();
    expect(el.querySelector(".imdx-props")).not.toBeNull();
    expect(
      el.querySelector('.imdx-sidebar-tab[aria-label="Properties"]')!.getAttribute("aria-selected"),
    ).toBe("true");

    // Back to source.
    await switchSidebar(el, "Source");
    expect(el.querySelector(".imdx-source-pre")).not.toBeNull();
    expect(el.querySelector(".imdx-props")).toBeNull();
  });

  it("resizes via the drag handle and persists the width", async () => {
    localStorage.clear();
    const el = await mountEditor(SRC);
    const root = el.querySelector(".imdx-editor") as HTMLElement;
    const handle = el.querySelector(".imdx-sidebar-resize") as HTMLElement;
    expect(handle).not.toBeNull();

    handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 1200 }));
    // jsdom has no layout (getBoundingClientRect → 0), so right(0) - clientX is
    // negative → clamps to the minimum width; this still exercises the wiring.
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 800 }));
    window.dispatchEvent(new MouseEvent("mouseup", {}));
    for (let i = 0; i < 3; i++) await flush();

    expect(root.style.getPropertyValue("--imdx-sidebar-width")).toBe("260px");
    expect(localStorage.getItem("imdx:sidebar-width")).toBe("260");
  });
});

describe("frontmatter panel (collections)", () => {
  const POST = `---
title: Hi
status: draft
---

# Hi
`;

  it("renders the collection's frontmatter fields as a Document panel", async () => {
    const el = await mountEditor(POST, collection);
    await switchSidebar(el, "Properties");
    const panel = el.querySelector('[aria-label="Document"]');
    expect(panel).not.toBeNull();
    const select = panel!.querySelector("select") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(select!.value).toBe("draft");
  });

  it("editing a field rewrites canonical frontmatter in the live source", async () => {
    const el = await mountEditor(POST, collection);
    await switchSidebar(el, "Properties");
    const select = el.querySelector('[aria-label="Document"] select') as HTMLSelectElement;
    select.value = "published";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    for (let i = 0; i < 4; i++) await flush();

    await switchSidebar(el, "Source");
    const source = Array.from(el.querySelectorAll(".imdx-source-line"))
      .map((n) => n.textContent)
      .join("\n");
    expect(source).toContain("status: published");
    expect(source).not.toContain("status: draft");
  });
});

describe("nested editing (TwoColumn)", () => {
  const NESTED = `<TwoColumn>
  <Column>
    Left text.
  </Column>

  <Column>
    Right text.
  </Column>
</TwoColumn>
`;

  it("renders nested NodeViews with editable contentDOM in each column", async () => {
    const el = await mountEditor(NESTED);
    expect(el.querySelectorAll('[data-role="twocol"]')).toHaveLength(1);
    const cols = el.querySelectorAll('[data-role="col"]');
    expect(cols).toHaveLength(2);
    // Each column's editable hole holds its own paragraph text.
    const texts = Array.from(cols).map(
      (c) => c.querySelector(".imdx-contentdom")?.textContent?.trim(),
    );
    expect(texts).toEqual(["Left text.", "Right text."]);
  });

  it("keeps the nested structure in the live source", async () => {
    const el = await mountEditor(NESTED);
    const source = Array.from(el.querySelectorAll(".imdx-source-line"))
      .map((n) => n.textContent)
      .join("\n");
    expect(source).toContain("<TwoColumn>");
    expect(source).toContain("<Column>");
    expect(source).toContain("Left text.");
    expect(source).toContain("Right text.");
  });
});
