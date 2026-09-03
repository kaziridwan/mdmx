import { describe, expect, it } from "vitest";
import { EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { buildSchema, componentNodeName } from "../src/schema.js";
import {
  blockActionKeymap,
  deleteBlockAt,
  duplicateBlockAt,
  moveBlockAt,
} from "../src/commands.js";

const spec: RegistrySpec = {
  mdmxRegistryVersion: 3,
  components: [
    { name: "Stat", children: { policy: "none" }, props: [{ name: "value", required: true, control: { type: "text" } }] },
    {
      name: "Tabs",
      children: { policy: "blocks" },
      constraints: { allowedParents: null, allowedChildren: ["Tab"] },
      props: [],
    },
    {
      name: "Tab",
      children: { policy: "blocks" },
      constraints: { allowedParents: ["Tabs"], allowedChildren: null },
      props: [{ name: "title", required: true, control: { type: "text" } }],
    },
    {
      name: "Column",
      children: { policy: "blocks" },
      props: [],
    },
  ],
};
const registry = new Registry(spec);
const schema = buildSchema(registry);
const n = (name: string) => schema.nodes[componentNodeName(name)]!;
const p = (text: string) => schema.node("paragraph", null, [schema.text(text)]);

const topNames = (d: PMNode) => {
  const out: string[] = [];
  d.forEach((c) => out.push(c.type.name === "paragraph" ? c.textContent : c.type.name));
  return out;
};

function apply(state: EditorState, cmd: (s: EditorState, d?: (tr: import("prosemirror-state").Transaction) => void) => boolean) {
  let next = state;
  const ran = cmd(state, (tr) => {
    next = state.apply(tr);
  });
  return { ran, state: next };
}

describe("block actions (ADR-058)", () => {
  const flat = schema.node("doc", null, [p("a"), n("Stat").create({ props: { value: "1" } }), p("b")]);
  const statPos = 3; // after "a" paragraph (nodeSize 3)

  it("duplicate inserts a copy right after and selects it", () => {
    const { ran, state } = apply(EditorState.create({ schema, doc: flat }), duplicateBlockAt(statPos));
    expect(ran).toBe(true);
    expect(topNames(state.doc)).toEqual(["a", "mdmx_Stat", "mdmx_Stat", "b"]);
    expect(state.selection).toBeInstanceOf(NodeSelection);
    expect(state.selection.from).toBe(statPos + flat.child(1).nodeSize);
    expect(state.doc.child(2).attrs.props).toEqual({ value: "1" });
  });

  it("move up / down swap with the sibling and stop at the edges", () => {
    let { state } = apply(EditorState.create({ schema, doc: flat }), moveBlockAt(statPos, "up"));
    expect(topNames(state.doc)).toEqual(["mdmx_Stat", "a", "b"]);
    expect(state.selection.from).toBe(0);
    expect(moveBlockAt(0, "up")(state)).toBe(false);

    ({ state } = apply(EditorState.create({ schema, doc: flat }), moveBlockAt(statPos, "down")));
    expect(topNames(state.doc)).toEqual(["a", "b", "mdmx_Stat"]);
    const last = state.doc.content.size - state.doc.lastChild!.nodeSize;
    expect(state.selection.from).toBe(last);
    expect(moveBlockAt(last, "down")(state)).toBe(false);
  });

  it("delete removes the block and lands the selection nearby", () => {
    const { state } = apply(EditorState.create({ schema, doc: flat }), deleteBlockAt(statPos));
    expect(topNames(state.doc)).toEqual(["a", "b"]);
    expect(state.selection.from).toBeGreaterThanOrEqual(statPos);
  });

  it("deleting a container's only block leaves an empty paragraph so it stays enterable", () => {
    const doc = schema.node("doc", null, [n("Column").create({ props: {} }, [n("Stat").create({ props: { value: "x" } })])]);
    const { state } = apply(EditorState.create({ schema, doc }), deleteBlockAt(1));
    const column = state.doc.child(0);
    expect(column.type.name).toBe("mdmx_Column");
    expect(column.childCount).toBe(1);
    expect(column.child(0).type.name).toBe("paragraph");
    expect(state.selection.from).toBe(2);
  });

  it("nested moves stay inside the parent (constraints hold by construction)", () => {
    const doc = schema.node("doc", null, [
      n("Tabs").create({ props: {} }, [
        n("Tab").create({ props: { title: "One" } }, [p("1")]),
        n("Tab").create({ props: { title: "Two" } }, [p("2")]),
      ]),
    ]);
    const secondTab = 1 + doc.child(0).child(0).nodeSize;
    const { state } = apply(EditorState.create({ schema, doc }), moveBlockAt(secondTab, "up"));
    const tabs = state.doc.child(0);
    expect(tabs.childCount).toBe(2);
    expect(tabs.child(0).attrs.props).toEqual({ title: "Two" });
    expect(tabs.child(1).attrs.props).toEqual({ title: "One" });
    expect(state.selection.from).toBe(1);
  });

  it("the keymap resolves the contextual component from a caret inside it", () => {
    const doc = schema.node("doc", null, [
      n("Tabs").create({ props: {} }, [n("Tab").create({ props: { title: "One" } }, [p("inner")])]),
    ]);
    const caret = TextSelection.create(doc, 3); // inside "inner"
    const state = EditorState.create({ schema, doc, selection: caret });
    const keys = blockActionKeymap(registry);
    const { state: dup } = apply(state, keys["Mod-Shift-d"]!);
    expect(dup.doc.child(0).childCount).toBe(2); // the Tab, duplicated inside Tabs
    const { state: del } = apply(state, keys["Mod-Shift-Backspace"]!);
    expect(del.doc.child(0).type.name).toBe("mdmx_Tabs");
    // Tabs only accepts Tab children, so no filler paragraph: the Tabs is empty.
    expect(del.doc.child(0).childCount).toBe(0);
    // Nothing in context → the binding declines and the key falls through.
    const plain = EditorState.create({ schema, doc: schema.node("doc", null, [p("x")]) });
    expect(keys["Mod-Shift-ArrowUp"]!(plain)).toBe(false);
  });
});
