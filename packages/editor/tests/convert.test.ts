import { describe, expect, it } from "vitest";
import {
  parseMDX,
  toMDX,
  Registry,
  type RegistrySpec,
} from "@imdx/core";
import {
  buildSchema,
  componentNodeName,
  fromMdast,
  printPropValue,
  toMdast,
} from "../src/index.js";
import type { Node as PMNode } from "prosemirror-model";
import { Fragment, Slice } from "prosemirror-model";

const registrySpec: RegistrySpec = {
  imdxRegistryVersion: 1,
  components: [
    {
      name: "Callout",
      children: { policy: "rich-text" },
      props: [
        {
          name: "variant",
          required: true,
          control: { type: "select", options: ["info", "warn", "danger"] },
          default: "info",
        },
        { name: "title", required: false, control: { type: "text" } },
      ],
    },
    {
      name: "Chart",
      children: { policy: "none" },
      props: [
        { name: "title", required: false, control: { type: "text" } },
        { name: "height", required: false, control: { type: "number" } },
        { name: "stacked", required: false, control: { type: "boolean" } },
        {
          name: "series",
          required: true,
          control: { type: "list", item: { type: "text" } },
        },
        { name: "config", required: false, control: { type: "json" } },
      ],
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

const registry = new Registry(registrySpec);
const schema = buildSchema(registry);

/** text → mdast → PM → mdast → text */
function roundtrip(source: string): string {
  const tree = parseMDX(source);
  const doc = fromMdast(tree, { schema, registry, source });
  return toMDX(toMdast(doc, { registry }));
}

const FIXTURE = `---
title: Hello iMDX
status: draft
---

# Hello iMDX

This is **bold with *nested italics***, ~~struck~~, \`inline code\`, and a [link](https://example.com "T").

- a bullet with ![an image](/img.png)
- another

1. first
2. second

- [x] done task
- [ ] open task

> Quoted *text*.

\`\`\`ts
const x = 42;
\`\`\`

| Region | Revenue |
| :----- | ------: |
| EU     | 120     |

<Callout variant="warn" title="Heads up">
  First paragraph with **bold**.

  Second paragraph.
</Callout>

<Chart
  title="Revenue"
  height={320}
  stacked
  series={["q1", "q2"]}
  config={{legend: "top", "odd-key": -5, nested: {a: [1, true, null]}}}
/>

<TwoColumn>
  <Column>
    ## Left

    <Chart series={["q1"]} />
  </Column>

  <Column>
    Right text.
  </Column>
</TwoColumn>

---

The end.
`;

describe("mdast ⇄ ProseMirror round-trip", () => {
  it("is a text-level fixed point on the canonical fixture", () => {
    const canonical = toMDX(parseMDX(FIXTURE));
    expect(roundtrip(canonical)).toBe(canonical);
  });

  it("is idempotent even when mark nesting needs canonicalization", () => {
    // strong wrapping an entire link gets re-nested as link>strong once,
    // then must be stable.
    const src = "**[entirely bold link](https://e.com)**\n";
    const once = roundtrip(toMDX(parseMDX(src)));
    const twice = roundtrip(once);
    expect(twice).toBe(once);
  });

  it("survives doc-level structural checks", () => {
    const tree = parseMDX(FIXTURE);
    const doc = fromMdast(tree, { schema, registry, source: FIXTURE });

    expect(doc.attrs.frontmatter).toContain("title: Hello iMDX");

    const types: string[] = [];
    doc.forEach((n) => types.push(n.type.name));
    expect(types).toContain("imdx_Callout");
    expect(types).toContain("imdx_Chart");
    expect(types).toContain("imdx_TwoColumn");
    expect(types).toContain("table");
  });

  it("evaluates component props into the single props attr", () => {
    const doc = fromMdast(parseMDX(FIXTURE), { schema, registry, source: FIXTURE });
    let chart: PMNode | null = null;
    doc.descendants((n) => {
      if (n.type.name === "imdx_Chart" && n.attrs.props.title) chart = n;
      return !chart;
    });
    expect(chart).not.toBeNull();
    expect(chart!.attrs.props).toEqual({
      title: "Revenue",
      height: 320,
      stacked: true,
      series: ["q1", "q2"],
      config: { legend: "top", "odd-key": -5, nested: { a: [1, true, null] } },
    });
  });
});

describe("raw fallback", () => {
  const RAW_DOC = [
    "# ok",
    "",
    'import { x } from "y"',
    "",
    "<Mystery weird={call()}>",
    "  body",
    "</Mystery>",
    "",
  ].join("\n");

  it("wraps out-of-subset regions as imdx_raw, byte-preserved", () => {
    const doc = fromMdast(parseMDX(RAW_DOC), { schema, registry, source: RAW_DOC });
    const raws: string[] = [];
    doc.forEach((n) => {
      if (n.type.name === "imdx_raw") raws.push(n.attrs.source as string);
    });
    expect(raws).toHaveLength(2);
    expect(raws[0]).toBe('import { x } from "y"');
    expect(raws[1]).toBe("<Mystery weird={call()}>\n  body\n</Mystery>");
  });

  it("serializes raw regions back verbatim", () => {
    expect(roundtrip(RAW_DOC)).toBe(RAW_DOC);
  });

  it("falls back to raw for unserializable props on known components", () => {
    const src = "<Chart series={getSeries()} />\n";
    const doc = fromMdast(parseMDX(src), { schema, registry, source: src });
    expect(doc.child(0).type.name).toBe("imdx_raw");
    expect(roundtrip(src)).toBe(src);
  });
});

describe("schema physics", () => {
  it("TwoColumn only accepts Column children", () => {
    const twoColumn = schema.nodes[componentNodeName("TwoColumn")]!;
    const column = schema.nodes[componentNodeName("Column")]!;
    const paragraph = schema.nodes.paragraph!.create(null, schema.text("hi"));

    expect(() => twoColumn.createChecked({ props: {} }, paragraph)).toThrow();
    const col = column.createAndFill({ props: {} })!;
    expect(() => twoColumn.createChecked({ props: {} }, col)).not.toThrow();
  });

  it("children:none components are atoms", () => {
    expect(schema.nodes[componentNodeName("Chart")]!.spec.atom).toBe(true);
    expect(schema.nodes[componentNodeName("Callout")]!.spec.atom).toBeUndefined();
  });
});

describe("prop editing produces localized diffs", () => {
  it("changing one prop changes one line", () => {
    const canonical = toMDX(parseMDX(FIXTURE));
    const doc = fromMdast(parseMDX(canonical), { schema, registry, source: canonical });

    // Simulate the property panel: replace the Callout's props attr.
    let calloutPos = -1;
    doc.descendants((n, pos) => {
      if (n.type.name === "imdx_Callout") calloutPos = pos;
      return calloutPos === -1;
    });
    const callout = doc.nodeAt(calloutPos)!;
    const edited = doc.replace(
      calloutPos,
      calloutPos + callout.nodeSize,
      new Slice(
        Fragment.from(
          callout.type.create(
            { props: { ...callout.attrs.props, title: "Changed!" } },
            callout.content,
          ),
        ),
        0,
        0,
      ),
    );

    const before = canonical.split("\n");
    const after = toMDX(toMdast(edited, { registry })).split("\n");
    expect(after.length).toBe(before.length);
    const changed = before.filter((line, i) => line !== after[i]);
    expect(changed).toEqual(['<Callout variant="warn" title="Heads up">']);
  });
});

describe("printPropValue canon", () => {
  it("matches the canonical attribute style", () => {
    expect(printPropValue(["q1", "q2"])).toBe('["q1", "q2"]');
    expect(printPropValue({ legend: "top", max: -5 })).toBe('{legend: "top", max: -5}');
    expect(printPropValue({ "odd-key": 1 })).toBe('{"odd-key": 1}');
    expect(printPropValue(null)).toBe("null");
    expect(printPropValue(false)).toBe("false");
  });
});
