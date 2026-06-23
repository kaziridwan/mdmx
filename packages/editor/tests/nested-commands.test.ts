import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { buildSchema, componentNodeName } from "../src/schema.js";
import {
  buildComponentNode,
  canInsertComponent,
  insertComponent,
  resolveComponentDrop,
  setHeading,
  slashItemsFor,
} from "../src/commands.js";

const spec: RegistrySpec = {
  mdmxRegistryVersion: 1,
  components: [
    { name: "Stat", children: { policy: "none" }, props: [] },
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

const registry = new Registry(spec);
const schema = buildSchema(registry);

/** A doc holding one seeded TwoColumn (two Columns, each one empty paragraph). */
function twoColumnDoc(): PMNode {
  return schema.node("doc", null, [buildComponentNode(registry, schema, "TwoColumn")!]);
}

/** Position of (the start of) the first Column's first paragraph. */
function posInFirstColumn(doc: PMNode): number {
  let at = -1;
  doc.descendants((node, pos) => {
    if (at >= 0) return false;
    if (node.type.name === componentNodeName("Column")) {
      at = pos + 2; // +1 into the Column, +1 into its paragraph
      return false;
    }
    return true;
  });
  return at;
}

/** Name of the parent node that contains the first node of `typeName`. */
function parentOf(doc: PMNode, typeName: string): string | null {
  let parentName: string | null = null;
  doc.descendants((node, _pos, parent) => {
    if (parentName != null) return false;
    if (node.type.name === typeName) {
      parentName = parent?.type.name ?? "doc";
      return false;
    }
    return true;
  });
  return parentName;
}

function stateInFirstColumn(): EditorState {
  const doc = twoColumnDoc();
  const base = EditorState.create({ schema, doc });
  const sel = TextSelection.create(doc, posInFirstColumn(doc));
  return base.apply(base.tr.setSelection(sel));
}

describe("region-local component insertion", () => {
  it("inserts a component inside the Column the cursor is in (not at doc level)", () => {
    let state = stateInFirstColumn();
    const ran = insertComponent(registry, schema, "Stat")(state, (tr) => {
      state = state.apply(tr);
    });
    expect(ran).toBe(true);
    expect(parentOf(state.doc, componentNodeName("Stat"))).toBe(componentNodeName("Column"));
  });

  it("replaces the empty seeded paragraph rather than leaving it beside the node", () => {
    let state = stateInFirstColumn();
    insertComponent(registry, schema, "Stat")(state, (tr) => {
      state = state.apply(tr);
    });
    // First Column should now hold exactly the Stat (the blank paragraph is gone).
    let firstColumn: PMNode | null = null;
    state.doc.descendants((node) => {
      if (firstColumn) return false;
      if (node.type.name === componentNodeName("Column")) {
        firstColumn = node;
        return false;
      }
      return true;
    });
    expect(firstColumn!.childCount).toBe(1);
    expect(firstColumn!.child(0).type.name).toBe(componentNodeName("Stat"));
  });

  it("keeps a core block command (heading) region-local too", () => {
    let state = stateInFirstColumn();
    setHeading(schema, 2)(state, (tr) => {
      state = state.apply(tr);
    });
    expect(parentOf(state.doc, "heading")).toBe(componentNodeName("Column"));
  });

  it("refuses to insert a Column where no TwoColumn ancestor exists", () => {
    // Cursor in a plain top-level paragraph.
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    const state = EditorState.create({ schema, doc });
    expect(canInsertComponent(registry, schema, state, "Column")).toBe(false);
    expect(canInsertComponent(registry, schema, state, "TwoColumn")).toBe(true);
    const ran = insertComponent(registry, schema, "Column")(state, () => {
      throw new Error("should not dispatch");
    });
    expect(ran).toBe(false);
  });

  it("still inserts into an empty document at the top level", () => {
    let state = EditorState.create({ schema });
    insertComponent(registry, schema, "TwoColumn")(state, (tr) => {
      state = state.apply(tr);
    });
    let columns = 0;
    state.doc.descendants((n) => {
      if (n.type.name === componentNodeName("Column")) columns += 1;
    });
    expect(columns).toBe(2);
  });
});

describe("resolveComponentDrop (rail drop resolution)", () => {
  it("resolves a drop over a Column interior to a position inside that Column", () => {
    const doc = twoColumnDoc();
    const at = resolveComponentDrop(registry, schema, doc, posInFirstColumn(doc), "Stat");
    expect(at).not.toBeNull();
    expect(doc.resolve(at!).parent.type.name).toBe(componentNodeName("Column"));
  });

  it("rejects dropping a Column where its allowedParents isn't satisfied", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    expect(resolveComponentDrop(registry, schema, doc, 1, "Column")).toBeNull();
  });
});

describe("slashItemsFor (context-aware palette)", () => {
  it("offers core blocks + unconstrained components but hides Column at top level", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    const state = EditorState.create({ schema, doc });
    const ids = slashItemsFor(registry, schema, state).map((i) => i.id);
    expect(ids).toContain("p"); // core always offered
    expect(ids).toContain("TwoColumn"); // unconstrained component
    expect(ids).not.toContain("Column"); // allowedParents: TwoColumn only
  });

  it("hides Column even when the cursor is inside a Column (parent must be TwoColumn)", () => {
    const ids = slashItemsFor(registry, schema, stateInFirstColumn()).map((i) => i.id);
    expect(ids).not.toContain("Column");
    expect(ids).toContain("Stat");
  });
});
