import { describe, expect, it } from "vitest";
import { EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { buildSchema, componentNodeName } from "../src/schema.js";
import { componentContext, contextChain } from "../src/component-context.js";

const spec: RegistrySpec = {
  mdmxRegistryVersion: 3,
  components: [
    { name: "Card", children: { policy: "blocks" }, props: [] },
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
    { name: "Stat", children: { policy: "none" }, props: [] },
  ],
};
const registry = new Registry(spec);
const schema = buildSchema(registry);
const n = (name: string) => schema.nodes[componentNodeName(name)]!;

/** Card > [p "intro", Tabs > [Tab(title) > p "inner"]], p "outside", Stat */
function doc(): PMNode {
  return schema.node("doc", null, [
    n("Card").create({ props: {} }, [
      schema.node("paragraph", null, [schema.text("intro")]),
      n("Tabs").create({ props: {} }, [
        n("Tab").create({ props: { title: "Overview" } }, [
          schema.node("paragraph", null, [schema.text("inner")]),
        ]),
      ]),
    ]),
    schema.node("paragraph", null, [schema.text("outside")]),
    n("Stat").create({ props: {} }),
  ]);
}

function posOfText(d: PMNode, text: string): number {
  let at = -1;
  d.descendants((node, pos) => {
    if (at >= 0) return false;
    if (node.isText && node.text === text) at = pos + 1;
    return at < 0;
  });
  return at;
}

function posOfNode(d: PMNode, typeName: string): number {
  let at = -1;
  d.descendants((node, pos) => {
    if (at >= 0) return false;
    if (node.type.name === typeName) at = pos;
    return at < 0;
  });
  return at;
}

describe("componentContext (ADR-058)", () => {
  const d = doc();

  it("follows a caret into the deepest component, with the ancestor chain", () => {
    const state = EditorState.create({ schema, doc: d, selection: TextSelection.create(d, posOfText(d, "inner")) });
    const ctx = componentContext(state, registry)!;
    expect(ctx.target.spec.name).toBe("Tab");
    expect(ctx.target.node.attrs.props).toEqual({ title: "Overview" });
    expect(ctx.ancestors.map((a) => a.spec.name)).toEqual(["Card", "Tabs"]);
    expect(contextChain(ctx).map((e) => e.spec.name)).toEqual(["Card", "Tabs", "Tab"]);
    // Positions point at the nodes themselves.
    expect(d.nodeAt(ctx.target.pos)!.type.name).toBe(componentNodeName("Tab"));
    expect(d.nodeAt(ctx.ancestors[0]!.pos)!.type.name).toBe(componentNodeName("Card"));
  });

  it("a caret in a container's own paragraph targets the container", () => {
    const state = EditorState.create({ schema, doc: d, selection: TextSelection.create(d, posOfText(d, "intro")) });
    const ctx = componentContext(state, registry)!;
    expect(ctx.target.spec.name).toBe("Card");
    expect(ctx.ancestors).toEqual([]);
  });

  it("a selected component node is the target, ancestors from its position", () => {
    const tabsPos = posOfNode(d, componentNodeName("Tabs"));
    const state = EditorState.create({ schema, doc: d, selection: NodeSelection.create(d, tabsPos) });
    const ctx = componentContext(state, registry)!;
    expect(ctx.target.spec.name).toBe("Tabs");
    expect(ctx.target.pos).toBe(tabsPos);
    expect(ctx.ancestors.map((a) => a.spec.name)).toEqual(["Card"]);

    const statPos = posOfNode(d, componentNodeName("Stat"));
    const leaf = componentContext(EditorState.create({ schema, doc: d, selection: NodeSelection.create(d, statPos) }), registry)!;
    expect(leaf.target.spec.name).toBe("Stat");
    expect(leaf.ancestors).toEqual([]);
  });

  it("is null in plain content and for a null state", () => {
    const state = EditorState.create({ schema, doc: d, selection: TextSelection.create(d, posOfText(d, "outside")) });
    expect(componentContext(state, registry)).toBeNull();
    expect(componentContext(null, registry)).toBeNull();
  });
});
