// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Registry, type CollectionSpec, type RegistrySpec } from "@mdmx/core";
import { EditorView as CMView } from "@codemirror/view";
import { MDMXEditor } from "../src/react/index.js";
import { SOURCE_APPLY_DELAY } from "../src/react/SourcePane.js";

/** The source pane's text (CodeMirror), or "" when the pane isn't mounted. */
function sourceText(el: HTMLElement): string {
  const cm = el.querySelector(".mdmx-source .cm-editor") as HTMLElement | null;
  return cm ? (CMView.findFromDOM(cm)?.state.doc.toString() ?? "") : "";
}

/** Type into the source pane: replace `find` with `replace` as one CodeMirror change. */
function typeInSource(el: HTMLElement, find: string, replace: string): CMView {
  const cm = CMView.findFromDOM(el.querySelector(".mdmx-source .cm-editor") as HTMLElement)!;
  const text = cm.state.doc.toString();
  const at = text.indexOf(find);
  if (at < 0) throw new Error(`source pane has no ${JSON.stringify(find)}`);
  cm.dispatch({ changes: { from: at, to: at + find.length, insert: replace }, selection: { anchor: at } });
  return cm;
}

const settle = async (ms = SOURCE_APPLY_DELAY + 80) => {
  await new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 4; i++) await flush();
};

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
  mdmxRegistryVersion: 1,
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
    {
      name: "Html",
      children: { policy: "none" },
      props: [{ name: "code", required: true, control: { type: "textarea" } }],
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
    `.mdmx-sidebar-tab[aria-label="${label}"]`,
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
  extra: Partial<Parameters<typeof MDMXEditor>[0]> = {},
): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    createElement(MDMXEditor, {
      registry: new Registry(registrySpec),
      components: { Note, Stat, TwoColumn, Column },
      source,
      collection: withCollection,
      ...extra,
    }),
  );
  // Let React effects (EditorView creation) and the per-node React roots settle.
  // React 19 schedules nested-root renders across more macrotasks than 18 did,
  // so deeply nested docs (TwoColumn) need a few extra ticks before the outer
  // editor state commit is observable.
  for (let i = 0; i < 8; i++) await flush();
  return host;
}

describe("MDMXEditor mount (jsdom)", () => {
  it("renders the document into a ProseMirror canvas", async () => {
    const el = await mountEditor(SRC);
    const pm = el.querySelector(".ProseMirror");
    expect(pm).not.toBeNull();
    expect(pm!.querySelector("h1")?.textContent).toBe("Hi");
    expect(el.querySelector('[data-mdmx-component="Note"]')).not.toBeNull();
    expect(el.querySelector('[data-mdmx-component="Stat"]')).not.toBeNull();
  });

  it("places the editable contentDOM inside a rich-text component's render", async () => {
    const el = await mountEditor(SRC);
    const note = el.querySelector('[data-role="note"]');
    expect(note).not.toBeNull();
    // The author component received the hole as children; PM's contentDOM lives there.
    const contentdom = note!.querySelector(".mdmx-contentdom");
    expect(contentdom).not.toBeNull();
    expect(contentdom!.textContent).toContain("Inside the note.");
  });

  it("renders a leaf component live with no contentDOM", async () => {
    const el = await mountEditor(SRC);
    const stat = el.querySelector('[data-role="stat"]');
    expect(stat?.textContent).toBe("42");
    expect(
      el.querySelector('[data-mdmx-component="Stat"] .mdmx-contentdom'),
    ).toBeNull();
  });

  it("shows live canonical source matching the input byte-for-byte", async () => {
    const el = await mountEditor(SRC);
    expect(el.querySelector(".mdmx-source .cm-editor")).not.toBeNull();
    expect(sourceText(el)).toBe(SRC);
  });
});

describe("unified sidebar (source ⇄ properties)", () => {
  it("defaults to the source view and toggles to properties and back", async () => {
    const el = await mountEditor(SRC);
    const tabs = el.querySelectorAll(".mdmx-sidebar-tab");
    expect(tabs).toHaveLength(2);

    // Default: source visible, no properties panel.
    expect(el.querySelector(".mdmx-source .cm-editor")).not.toBeNull();
    expect(el.querySelector(".mdmx-props")).toBeNull();
    expect(
      el.querySelector('.mdmx-sidebar-tab[aria-label="Source"]')!.getAttribute("aria-selected"),
    ).toBe("true");

    // Toggle to properties: the document panel appears, source is gone.
    await switchSidebar(el, "Properties");
    expect(el.querySelector(".mdmx-source .cm-editor")).toBeNull();
    expect(el.querySelector(".mdmx-props")).not.toBeNull();
    expect(
      el.querySelector('.mdmx-sidebar-tab[aria-label="Properties"]')!.getAttribute("aria-selected"),
    ).toBe("true");

    // Back to source.
    await switchSidebar(el, "Source");
    expect(el.querySelector(".mdmx-source .cm-editor")).not.toBeNull();
    expect(el.querySelector(".mdmx-props")).toBeNull();
  });

  it("resizes via the drag handle and persists the width", async () => {
    localStorage.clear();
    const el = await mountEditor(SRC);
    const root = el.querySelector(".mdmx-editor") as HTMLElement;
    const handle = el.querySelector(".mdmx-sidebar-resize") as HTMLElement;
    expect(handle).not.toBeNull();

    handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 1200 }));
    // jsdom has no layout (getBoundingClientRect → 0), so right(0) - clientX is
    // negative → clamps to the minimum width; this still exercises the wiring.
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 800 }));
    window.dispatchEvent(new MouseEvent("mouseup", {}));
    for (let i = 0; i < 3; i++) await flush();

    expect(root.style.getPropertyValue("--mdmx-sidebar-width")).toBe("260px");
    expect(localStorage.getItem("mdmx:sidebar-width")).toBe("260");
  });
});

describe("mobile layout (floating panels)", () => {
  it("opens the palette sheet and dismisses via the backdrop", async () => {
    const el = await mountEditor(SRC);
    const root = el.querySelector(".mdmx-editor") as HTMLElement;
    expect(el.querySelector(".mdmx-mobile-backdrop")).toBeNull();

    (el.querySelector('[aria-label="Open components"]') as HTMLButtonElement).click();
    for (let i = 0; i < 2; i++) await flush();
    expect(root.classList.contains("is-palette-open")).toBe(true);
    const backdrop = el.querySelector(".mdmx-mobile-backdrop") as HTMLElement;
    expect(backdrop).not.toBeNull();

    backdrop.click();
    for (let i = 0; i < 2; i++) await flush();
    expect(root.classList.contains("is-palette-open")).toBe(false);
    expect(el.querySelector(".mdmx-mobile-backdrop")).toBeNull();
  });

  it("the Source/Properties FABs open the sidebar sheet in the right mode", async () => {
    const el = await mountEditor(SRC);
    const root = el.querySelector(".mdmx-editor") as HTMLElement;

    (el.querySelector('[aria-label="Open properties"]') as HTMLButtonElement).click();
    for (let i = 0; i < 2; i++) await flush();
    expect(root.classList.contains("is-sidebar-open")).toBe(true);
    // Properties mode → the document/prop panel is shown, not the source pane.
    expect(el.querySelector(".mdmx-props")).not.toBeNull();
    expect(el.querySelector(".mdmx-source .cm-editor")).toBeNull();

    (el.querySelector('[aria-label="Open source"]') as HTMLButtonElement).click();
    for (let i = 0; i < 2; i++) await flush();
    expect(root.classList.contains("is-sidebar-open")).toBe(true);
    expect(el.querySelector(".mdmx-source .cm-editor")).not.toBeNull();
    expect(el.querySelector(".mdmx-props")).toBeNull();
  });
});

describe("snippets (insert saved HTML)", () => {
  it("shows a saved snippet in the rail and inserts it as an Html block", async () => {
    localStorage.setItem(
      "mdmx:snippets",
      JSON.stringify([{ name: "Card", html: "<div>saved card</div>" }]),
    );
    const el = await mountEditor(SRC);
    const snippet = Array.from(el.querySelectorAll(".mdmx-rail-snippet")).find((b) =>
      b.textContent?.includes("Card"),
    ) as HTMLButtonElement;
    expect(snippet).not.toBeNull();

    snippet.click();
    for (let i = 0; i < 4; i++) await flush();

    // Default sidebar is source; the inserted Html block serializes there.
    const source = sourceText(el);
    expect(source).toContain("<Html");
    expect(source).toContain("saved card");
    localStorage.clear();
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
    const source = sourceText(el);
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
      (c) => c.querySelector(".mdmx-contentdom")?.textContent?.trim(),
    );
    expect(texts).toEqual(["Left text.", "Right text."]);
  });

  it("keeps the nested structure in the live source", async () => {
    const el = await mountEditor(NESTED);
    const source = sourceText(el);
    expect(source).toContain("<TwoColumn>");
    expect(source).toContain("<Column>");
    expect(source).toContain("Left text.");
    expect(source).toContain("Right text.");
  });
});

describe("canvas root: content class + fit viewport (ADR-050 / ADR-051)", () => {
  it("the ProseMirror root carries the host's content class by convention", async () => {
    const el = await mountEditor(SRC);
    const pm = el.querySelector(".ProseMirror") as HTMLElement;
    expect(pm.classList.contains("mdmx-page")).toBe(true);
  });

  it("contentClassName overrides the convention, and \"\" opts out", async () => {
    let el = await mountEditor(SRC, undefined, { contentClassName: "prose" });
    let pm = el.querySelector(".ProseMirror") as HTMLElement;
    expect(pm.classList.contains("prose")).toBe(true);
    expect(pm.classList.contains("mdmx-page")).toBe(false);
    root?.unmount();
    host?.remove();
    el = await mountEditor(SRC, undefined, { contentClassName: "" });
    pm = el.querySelector(".ProseMirror") as HTMLElement;
    expect(pm.className.trim()).toBe("ProseMirror");
  });

  it("defaults to the fit viewport: the pane's width at zoom 1", async () => {
    localStorage.clear();
    const el = await mountEditor(SRC);
    const canvas = el.querySelector(".mdmx-canvas") as HTMLElement;
    expect(canvas.getAttribute("data-viewport")).toBe("fit");
    expect(canvas.style.getPropertyValue("--mdmx-canvas-w")).toBe("100%");
    expect(canvas.style.getPropertyValue("--mdmx-canvas-zoom")).toBe("1");
    const pressed = el.querySelector('.mdmx-viewport-btn[aria-pressed="true"]');
    expect(pressed?.getAttribute("aria-label")).toBe("fit preview");
  });

  it("switching to a device preview sets its width and remembers it", async () => {
    localStorage.clear();
    const el = await mountEditor(SRC);
    (el.querySelector('.mdmx-viewport-btn[aria-label="tablet preview"]') as HTMLButtonElement).click();
    for (let i = 0; i < 2; i++) await flush();
    const canvas = el.querySelector(".mdmx-canvas") as HTMLElement;
    expect(canvas.getAttribute("data-viewport")).toBe("tablet");
    expect(canvas.style.getPropertyValue("--mdmx-canvas-w")).toBe("768px");
    expect(localStorage.getItem("mdmx:viewport")).toBe("tablet");
    localStorage.clear();
  });
});

describe("collapsible panels (desktop; ADR-051)", () => {
  it("toggles the rail and the sidebar, and persists both", async () => {
    localStorage.clear();
    const el = await mountEditor(SRC);
    const rootEl = el.querySelector(".mdmx-editor") as HTMLElement;
    const rail = el.querySelector('[aria-label="Toggle components panel"]') as HTMLButtonElement;
    const side = el.querySelector('[aria-label="Toggle sidebar"]') as HTMLButtonElement;
    expect(rail.getAttribute("aria-pressed")).toBe("true");
    expect(rootEl.classList.contains("is-rail-collapsed")).toBe(false);

    rail.click();
    for (let i = 0; i < 2; i++) await flush();
    expect(rootEl.classList.contains("is-rail-collapsed")).toBe(true);
    expect(rail.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem("mdmx:rail-collapsed")).toBe("true");

    side.click();
    for (let i = 0; i < 2; i++) await flush();
    expect(rootEl.classList.contains("is-sidebar-collapsed")).toBe(true);
    expect(localStorage.getItem("mdmx:sidebar-collapsed")).toBe("true");

    rail.click();
    for (let i = 0; i < 2; i++) await flush();
    expect(rootEl.classList.contains("is-rail-collapsed")).toBe(false);
    expect(localStorage.getItem("mdmx:rail-collapsed")).toBe("false");
    localStorage.clear();
  });

  it("a persisted collapsed state is restored on mount", async () => {
    localStorage.setItem("mdmx:sidebar-collapsed", "true");
    const el = await mountEditor(SRC);
    expect((el.querySelector(".mdmx-editor") as HTMLElement).classList.contains("is-sidebar-collapsed")).toBe(true);
    localStorage.clear();
  });
});

describe("two-way source pane (ADR-059)", () => {
  it("typed source applies to the canvas after the debounce", async () => {
    const el = await mountEditor(SRC);
    typeInSource(el, "Hello **world**.", "Hello **there**.");
    // Not yet: the apply is debounced.
    expect(el.querySelector(".ProseMirror strong")?.textContent).toBe("world");
    await settle();
    expect(el.querySelector(".ProseMirror strong")?.textContent).toBe("there");
    // The author's text stays as typed (no canonical push while the pane owns it).
    expect(sourceText(el)).toContain("Hello **there**.");
  });

  it("a syntax error keeps the last applied canvas and shows the strip", async () => {
    const el = await mountEditor(SRC);
    typeInSource(el, "<Stat value=\"42\" />", "<Stat value=\"42\"");
    await settle();
    expect(el.querySelector('[data-role="stat"]')?.textContent).toBe("42");
    const strip = el.querySelector(".mdmx-source-status.is-error");
    expect(strip).not.toBeNull();
    expect(strip!.textContent).toMatch(/Syntax error, line \d+/);
    // Fixing it clears the strip and applies.
    typeInSource(el, "<Stat value=\"42\"", "<Stat value=\"43\" />");
    await settle();
    expect(el.querySelector(".mdmx-source-status.is-error")).toBeNull();
    expect(el.querySelector('[data-role="stat"]')?.textContent).toBe("43");
  });

  it("Mod-Enter applies immediately", async () => {
    const el = await mountEditor(SRC);
    const cm = typeInSource(el, "# Hi", "# Hello");
    cm.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
    for (let i = 0; i < 3; i++) await flush();
    expect(el.querySelector(".ProseMirror h1")?.textContent).toBe("Hello");
  });

  it("frontmatter typed in the pane lands in the document panel", async () => {
    const POST = "---\ntitle: Hi\nstatus: draft\n---\n\n# Hi\n";
    const el = await mountEditor(POST, collection);
    typeInSource(el, "status: draft", "status: published");
    await settle();
    await switchSidebar(el, "Properties");
    const select = el.querySelector('[aria-label="Document"] select') as HTMLSelectElement;
    expect(select.value).toBe("published");
  });

  it("an unknown component becomes a raw block, verbatim", async () => {
    const el = await mountEditor(SRC);
    typeInSource(el, "<Stat value=\"42\" />", "<Mystery x=\"1\"   y={2} />");
    await settle();
    expect(el.querySelector(".ProseMirror .mdmx-raw")).not.toBeNull();
    expect(el.querySelector('[data-mdmx-component="Stat"]')).toBeNull();
    // Blur snaps the pane to canonical text — the raw region prints canonically.
    const cm = CMView.findFromDOM(el.querySelector(".mdmx-source .cm-editor") as HTMLElement)!;
    cm.contentDOM.dispatchEvent(new FocusEvent("blur"));
    for (let i = 0; i < 3; i++) await flush();
    expect(sourceText(el)).toContain("<Mystery x=\"1\" y={2} />");
  });

  it("blur snaps non-canonical text to the canonical serialization", async () => {
    const el = await mountEditor(SRC);
    const cm = typeInSource(el, "Hello **world**.", "Hello __world__.");
    await settle();
    expect(sourceText(el)).toContain("Hello __world__.");
    cm.contentDOM.dispatchEvent(new FocusEvent("blur"));
    for (let i = 0; i < 3; i++) await flush();
    expect(sourceText(el)).toContain("Hello **world**.");
    expect(sourceText(el)).not.toContain("__world__");
  });

  it("canvas edits keep flowing into the pane", async () => {
    const el = await mountEditor(SRC);
    await switchSidebar(el, "Properties");
    const select = el.querySelector('[aria-label="Document"] select');
    expect(select).toBeNull(); // no collection: the document panel is empty
    await switchSidebar(el, "Source");
    // A prop edit through the panel is a canvas-side transaction.
    (el.querySelector('[aria-label="Toggle sidebar"]') as HTMLButtonElement).click();
    for (let i = 0; i < 2; i++) await flush();
    expect(sourceText(el)).toBe(SRC);
  });
});
