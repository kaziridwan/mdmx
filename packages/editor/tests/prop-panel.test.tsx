// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditorState, NodeSelection, TextSelection, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { buildSchema, componentNodeName } from "../src/schema.js";
import { componentContext } from "../src/component-context.js";
import { PropPanel } from "../src/react/PropPanel.js";

const spec: RegistrySpec = {
  mdmxRegistryVersion: 3,
  components: [
    {
      name: "Tabs",
      children: { policy: "blocks" },
      constraints: { allowedParents: null, allowedChildren: ["Tab"] },
      props: [
        { name: "tabs", required: true, control: { type: "list", item: { type: "text" } } },
        { name: "variant", required: false, control: { type: "select", options: ["default", "line"] }, default: "default" },
        { name: "orientation", required: false, control: { type: "select", options: ["horizontal", "vertical"] } },
      ],
    },
    {
      name: "Tab",
      children: { policy: "blocks" },
      constraints: { allowedParents: ["Tabs"], allowedChildren: null },
      props: [
        { name: "title", required: true, control: { type: "text" } },
        { name: "shape", required: false, control: { type: "select", options: ["text", "rect"] }, default: "text" },
        { name: "lines", required: false, control: { type: "number" }, default: 3, showIf: { prop: "shape", eq: "text" } },
        { name: "href", required: false, control: { type: "link", placeholder: "https://…" }, showIf: { prop: "title" } },
      ],
    },
  ],
};
const registry = new Registry(spec);
const schema = buildSchema(registry);
const n = (name: string) => schema.nodes[componentNodeName(name)]!;

function makeDoc(): PMNode {
  return schema.node("doc", null, [
    n("Tabs").create({ props: { tabs: ["Overview", "Details"] } }, [
      n("Tab").create({ props: { title: "Overview" } }, [
        schema.node("paragraph", null, [schema.text("inner")]),
      ]),
    ]),
  ]);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

/** A minimal EditorView stand-in: state + dispatch, no DOM. */
function harness(initial: EditorState) {
  let state = initial;
  let dispatches = 0;
  const view = {
    get state() {
      return state;
    },
    dispatch(tr: Transaction) {
      state = state.apply(tr);
      dispatches += 1;
    },
    focus() {},
  } as unknown as EditorView;
  const render = async () => {
    if (!host) {
      host = document.createElement("div");
      document.body.appendChild(host);
      root = createRoot(host);
    }
    root!.render(createElement(PropPanel, { view, registry, context: componentContext(state, registry) }));
    for (let i = 0; i < 3; i++) await flush();
    return host!;
  };
  return { view, render, get state() { return state; }, get dispatches() { return dispatches; } };
}

const setInput = (input: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};

describe("PropPanel (ADR-058)", () => {
  it("follows the caret into a nested Tab and shows the breadcrumb", async () => {
    const doc = makeDoc();
    const h = harness(EditorState.create({ schema, doc, selection: TextSelection.create(doc, 4) }));
    const el = await h.render();
    const crumbs = Array.from(el.querySelectorAll(".mdmx-props-crumb")).map((c) => c.textContent);
    expect(crumbs).toEqual(["Tabs", "Tab"]);
    expect(el.querySelector('.mdmx-props-crumb.is-current')!.textContent).toBe("Tab");
    expect((el.querySelector('[data-prop="title"] input') as HTMLInputElement).value).toBe("Overview");
  });

  it("clicking a crumb selects that ancestor (a NodeSelection on it)", async () => {
    const doc = makeDoc();
    const h = harness(EditorState.create({ schema, doc, selection: TextSelection.create(doc, 4) }));
    const el = await h.render();
    (el.querySelector("button.mdmx-props-crumb") as HTMLButtonElement).click();
    expect(h.state.selection).toBeInstanceOf(NodeSelection);
    expect((h.state.selection as NodeSelection).node.type.name).toBe(componentNodeName("Tabs"));
    const again = await h.render();
    expect(again.querySelector(".mdmx-props-crumb.is-current")!.textContent).toBe("Tabs");
  });

  it("shows effective defaults muted, and a reset that drops the key", async () => {
    const doc = makeDoc();
    const h = harness(EditorState.create({ schema, doc, selection: TextSelection.create(doc, 4) }));
    let el = await h.render();
    const shape = el.querySelector('[data-prop="shape"]')!;
    expect(shape.classList.contains("is-default")).toBe(true);
    const select = shape.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("text");
    // A prop with a default offers no empty option.
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["text", "rect"]);
    expect(shape.querySelector(".mdmx-prop-reset")).toBeNull();

    setInput(select, "rect");
    expect(h.dispatches).toBe(1);
    let tab = h.state.doc.child(0).child(0);
    expect(tab.attrs.props).toEqual({ title: "Overview", shape: "rect" });

    el = await h.render();
    const reset = el.querySelector('[data-prop="shape"] .mdmx-prop-reset') as HTMLButtonElement;
    expect(reset).not.toBeNull();
    expect(el.querySelector('[data-prop="shape"]')!.classList.contains("is-default")).toBe(false);
    reset.click();
    tab = h.state.doc.child(0).child(0);
    expect(tab.attrs.props).toEqual({ title: "Overview" });
    expect(h.dispatches).toBe(2);
  });

  it("hides props whose showIf rule is off, evaluated against effective values", async () => {
    const doc = makeDoc();
    const h = harness(EditorState.create({ schema, doc, selection: TextSelection.create(doc, 4) }));
    let el = await h.render();
    // shape defaults to "text" → lines visible; title is set → href visible.
    expect(el.querySelector('[data-prop="lines"]')).not.toBeNull();
    expect(el.querySelector('[data-prop="href"]')).not.toBeNull();
    expect((el.querySelector('[data-prop="href"] input') as HTMLInputElement).placeholder).toBe("https://…");

    setInput(el.querySelector('[data-prop="shape"] select') as HTMLSelectElement, "rect");
    el = await h.render();
    expect(el.querySelector('[data-prop="lines"]')).toBeNull();

    setInput(el.querySelector('[data-prop="title"] input') as HTMLInputElement, "");
    el = await h.render();
    expect(el.querySelector('[data-prop="href"]')).toBeNull();
    // Hidden props keep their values: nothing was rewritten but title.
    expect(h.state.doc.child(0).child(0).attrs.props).toEqual({ shape: "rect" });
  });

  it("edits a list prop as rows — arrays in, arrays out, one transaction per edit", async () => {
    const doc = makeDoc();
    const tabsPos = 0;
    const h = harness(EditorState.create({ schema, doc, selection: NodeSelection.create(doc, tabsPos) }));
    let el = await h.render();
    const rows = el.querySelectorAll('[data-prop="tabs"] .mdmx-control-list-row');
    expect(rows).toHaveLength(2);
    expect((rows[1]!.querySelector("input") as HTMLInputElement).value).toBe("Details");

    (el.querySelector('[data-prop="tabs"] .mdmx-control-list-add') as HTMLButtonElement).click();
    expect(h.state.doc.child(0).attrs.props.tabs).toEqual(["Overview", "Details", ""]);
    // The edited block stays selected: setNodeMarkup alone would collapse the
    // NodeSelection into the first Tab and hand the panel to it.
    expect(h.state.selection).toBeInstanceOf(NodeSelection);
    expect(h.state.selection.from).toBe(tabsPos);
    el = await h.render();
    expect(el.querySelectorAll('[data-prop="tabs"] .mdmx-control-list-row')).toHaveLength(3);
    setInput(el.querySelectorAll('[data-prop="tabs"] input')[2] as HTMLInputElement, "Pricing");
    expect(h.state.doc.child(0).attrs.props.tabs).toEqual(["Overview", "Details", "Pricing"]);
    el = await h.render();
    (el.querySelectorAll('[data-prop="tabs"] [aria-label="Move item up"]')[2] as HTMLButtonElement).click();
    expect(h.state.doc.child(0).attrs.props.tabs).toEqual(["Overview", "Pricing", "Details"]);
    el = await h.render();
    (el.querySelectorAll('[data-prop="tabs"] [aria-label="Remove item"]')[0] as HTMLButtonElement).click();
    expect(h.state.doc.child(0).attrs.props.tabs).toEqual(["Pricing", "Details"]);
    expect(h.dispatches).toBe(4);
  });

  it("an optional select with no default keeps the empty option", async () => {
    const doc = makeDoc();
    const h = harness(EditorState.create({ schema, doc, selection: NodeSelection.create(doc, 0) }));
    const el = await h.render();
    const select = el.querySelector('[data-prop="orientation"] select') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "horizontal", "vertical"]);
  });
});
