import { describe, expect, it } from "vitest";
import { parseMDX, toMDX, Registry, type RegistrySpec } from "@mdmx/core";
import { buildSchema, fromMdast } from "../src/index.js";
import {
  activeBlockRange,
  blockIndexAtLine,
  blockLineAt,
  blockLineMap,
  serializeDoc,
  topLevelIndexAt,
} from "../src/react/source-map.js";

const registrySpec: RegistrySpec = {
  mdmxRegistryVersion: 1,
  components: [
    {
      name: "Callout",
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
      props: [
        { name: "value", required: true, control: { type: "text" } },
        { name: "label", required: true, control: { type: "text" } },
      ],
    },
  ],
};

const registry = new Registry(registrySpec);
const schema = buildSchema(registry);

const SRC = toMDX(
  parseMDX(`# Title

Intro paragraph.

<Callout variant="warn">
  Body text.
</Callout>

<Stat value="27ms" label="latency" />
`),
);

function docOf(src: string) {
  return fromMdast(parseMDX(src), { schema, registry, source: src });
}

/** Document position at the start of top-level child `index`. */
function startOfChild(doc: ReturnType<typeof docOf>, index: number): number {
  let before = 0;
  for (let i = 0; i < index; i++) before += doc.child(i).nodeSize;
  return before;
}

describe("serializeDoc", () => {
  it("renders the canonical source byte-for-byte (the live source pane)", () => {
    expect(serializeDoc(docOf(SRC), registry)).toBe(SRC);
  });
});

describe("topLevelIndexAt", () => {
  it("maps a position to its top-level block index", () => {
    const doc = docOf(SRC);
    expect(topLevelIndexAt(doc, 1)).toBe(0); // inside the heading
    const last = doc.childCount - 1;
    expect(topLevelIndexAt(doc, startOfChild(doc, last))).toBe(last);
  });
});

describe("activeBlockRange", () => {
  it("locates the active block's lines in the canonical source", () => {
    const doc = docOf(SRC);
    // Index 2 is the Callout (heading, paragraph, callout, stat).
    const range = activeBlockRange(doc, registry, startOfChild(doc, 2));
    expect(range).not.toBeNull();
    const calloutLine = SRC.split("\n").findIndex((l) => l.startsWith("<Callout"));
    expect(range!.startLine).toBe(calloutLine);
    expect(range!.endLine).toBeGreaterThanOrEqual(range!.startLine);
  });

  it("returns a range whose lines actually bracket the block text", () => {
    const doc = docOf(SRC);
    const range = activeBlockRange(doc, registry, startOfChild(doc, 0));
    expect(range).not.toBeNull();
    const lines = SRC.split("\n");
    expect(lines[range!.startLine]).toBe("# Title");
  });
});

describe("blockLineMap (ADR-059)", () => {
  const DUP = toMDX(
    parseMDX(`<Stat value="1" label="a" />

<Stat value="1" label="a" />

Tail.
`),
  );

  it("gives two identical blocks their own line ranges (indexOf found the first twice)", () => {
    const doc = docOf(DUP);
    const map = blockLineMap(doc, registry);
    expect(map).toHaveLength(3);
    expect(map[0]).toEqual({ startLine: 0, endLine: 0 });
    expect(map[1]).toEqual({ startLine: 2, endLine: 2 });
    expect(map[2]).toEqual({ startLine: 4, endLine: 4 });
    // activeBlockRange of the second Stat is the second range.
    expect(activeBlockRange(doc, registry, startOfChild(doc, 1))).toEqual({ startLine: 2, endLine: 2 });
  });

  it("maps a source line back to its block; blank lines belong to the block above", () => {
    const map = blockLineMap(docOf(DUP), registry);
    expect(blockIndexAtLine(map, 0)).toBe(0);
    expect(blockIndexAtLine(map, 1)).toBe(0);
    expect(blockIndexAtLine(map, 2)).toBe(1);
    expect(blockIndexAtLine(map, 4)).toBe(2);
    expect(blockIndexAtLine(map, 9)).toBe(2);
    expect(blockIndexAtLine([{ startLine: 3, endLine: 3 }], 0)).toBeNull();
  });

  it("finds a nested block's first line inside its top-level block (blockLineAt)", () => {
    const nestedSpec: RegistrySpec = {
      mdmxRegistryVersion: 3,
      components: [
        ...registrySpec.components,
        { name: "Card", children: { policy: "blocks" }, props: [] },
      ],
    };
    const reg = new Registry(nestedSpec);
    const sch = buildSchema(reg);
    const src = toMDX(parseMDX(`# Title\n\n<Card>\n  Intro.\n\n  <Stat value="1" label="a" />\n\n  <Stat value="2" label="b" />\n</Card>\n`));
    const doc = fromMdast(parseMDX(src), { schema: sch, registry: reg, source: src });
    const lines = src.split("\n");
    const cardPos = startOfChild(doc, 1);
    expect(lines[blockLineAt(doc, reg, cardPos)!]).toBe("<Card>");
    // The second Stat: its own line, not the Card's.
    let secondStat = -1;
    doc.descendants((n, pos) => {
      if (n.type.name === "mdmx_Stat" && (n.attrs.props as { value: string }).value === "2") secondStat = pos;
      return secondStat < 0;
    });
    expect(lines[blockLineAt(doc, reg, secondStat)!]!.trim()).toBe('<Stat value="2" label="b" />');
    expect(lines[blockLineAt(doc, reg, 0)!]).toBe("# Title");
  });

  it("accounts for frontmatter lines before the first block", () => {
    const withFm = `---\ntitle: Hi\n---\n\n# Title\n`;
    const doc = docOf(withFm);
    expect(blockLineMap(doc, registry)[0]).toEqual({ startLine: 4, endLine: 4 });
  });
});
