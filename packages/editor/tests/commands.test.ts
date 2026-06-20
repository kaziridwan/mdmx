import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { Registry, type RegistrySpec } from "@imdx/core";
import {
  buildSchema,
  buildComponentNode,
  initialProps,
  insertComponent,
  slashItems,
  groupSlashItems,
} from "../src/index.js";

const spec: RegistrySpec = {
  imdxRegistryVersion: 1,
  components: [
    {
      name: "Callout",
      category: "Content",
      description: "A note box",
      children: { policy: "rich-text" },
      props: [
        {
          name: "variant",
          required: true,
          control: { type: "select", options: ["info", "warn"] },
          default: "info",
        },
        { name: "title", required: false, control: { type: "text" } },
      ],
    },
    {
      name: "Chart",
      category: "Data",
      children: { policy: "none" },
      props: [{ name: "series", required: true, control: { type: "json" } }],
    },
  ],
};

const registry = new Registry(spec);
const schema = buildSchema(registry);

describe("slashItems", () => {
  it("lists core blocks plus one item per component", () => {
    const items = slashItems(registry, schema);
    expect(items.filter((i) => i.kind === "core").map((i) => i.id)).toEqual([
      "p",
      "h1",
      "h2",
      "h3",
      "quote",
    ]);
    const components = items.filter((i) => i.kind === "component");
    expect(components.map((i) => i.label)).toEqual(["Callout", "Chart"]);
    expect(components[0]!.category).toBe("Content");
    expect(components[0]!.description).toBe("A note box");
  });
});

describe("groupSlashItems", () => {
  it("puts core blocks under 'Blocks' and components under their category", () => {
    const groups = groupSlashItems(slashItems(registry, schema));
    expect(groups.map(([label]) => label)).toEqual(["Blocks", "Content", "Data"]);
    expect(groups[0]![1].every((i) => i.kind === "core")).toBe(true);
    expect(groups[1]![1].map((i) => i.id)).toEqual(["Callout"]);
    expect(groups[2]![1].map((i) => i.id)).toEqual(["Chart"]);
  });

  it("flattening the groups reproduces the input order (nav stays aligned)", () => {
    const items = slashItems(registry, schema);
    const flat = groupSlashItems(items).flatMap(([, list]) => list);
    expect(flat.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });
});

describe("initialProps", () => {
  it("seeds defaults and omits props without one", () => {
    expect(initialProps(spec.components[0]!)).toEqual({ variant: "info" });
    expect(initialProps(spec.components[1]!)).toEqual({});
  });
});

describe("insertComponent", () => {
  it("inserts a component node carrying its default props", () => {
    let state = EditorState.create({ schema });
    const cmd = insertComponent(registry, schema, "Callout");
    const ran = cmd(state, (tr) => {
      state = state.apply(tr);
    });
    expect(ran).toBe(true);

    let found = null as null | { props: Record<string, unknown> };
    state.doc.descendants((n) => {
      if (n.type.name === "imdx_Callout") found = { props: n.attrs.props };
      return !found;
    });
    expect(found).not.toBeNull();
    expect(found!.props).toEqual({ variant: "info" });
  });

  it("returns false for unknown components", () => {
    const state = EditorState.create({ schema });
    expect(insertComponent(registry, schema, "Nope")(state)).toBe(false);
  });
});

describe("buildComponentNode (subtree seeding)", () => {
  const containerSpec: RegistrySpec = {
    imdxRegistryVersion: 1,
    components: [
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
      { name: "Callout", children: { policy: "rich-text" }, props: [] },
      { name: "Chart", children: { policy: "none" }, props: [] },
    ],
  };
  const reg = new Registry(containerSpec);
  const sch = buildSchema(reg);

  it("seeds two editable Columns (each with a paragraph) for TwoColumn", () => {
    const node = buildComponentNode(reg, sch, "TwoColumn")!;
    expect(node).not.toBeNull();
    expect(node.childCount).toBe(2);
    node.forEach((col) => {
      expect(col.type.name).toBe("imdx_Column");
      expect(col.childCount).toBe(1);
      expect(col.child(0).type.name).toBe("paragraph");
    });
  });

  it("seeds one empty paragraph for a rich-text component", () => {
    const node = buildComponentNode(reg, sch, "Callout")!;
    expect(node.childCount).toBe(1);
    expect(node.child(0).type.name).toBe("paragraph");
  });

  it("leaves a children:none component as an empty atom", () => {
    const node = buildComponentNode(reg, sch, "Chart")!;
    expect(node.childCount).toBe(0);
  });

  it("insertComponent drops a seeded TwoColumn into the doc", () => {
    let state = EditorState.create({ schema: sch });
    insertComponent(reg, sch, "TwoColumn")(state, (tr) => {
      state = state.apply(tr);
    });
    let cols = 0;
    state.doc.descendants((n) => {
      if (n.type.name === "imdx_Column") cols += 1;
    });
    expect(cols).toBe(2);
  });
});
