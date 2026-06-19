import { describe, expect, it } from "vitest";
import { parseMDX, toMDX, Registry, type RegistrySpec } from "@imdx/core";
import { buildSchema, fromMdast } from "../src/index.js";
import {
  activeBlockRange,
  serializeDoc,
  topLevelIndexAt,
} from "../src/react/source-map.js";

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
