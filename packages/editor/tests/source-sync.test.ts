import { describe, expect, it } from "vitest";
import { EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { parseMDX, toMDX, Registry, type CollectionSpec, type RegistrySpec } from "@mdmx/core";
import { buildSchema, fromMdast } from "../src/index.js";
import { serializeDoc } from "../src/react/source-map.js";
import { SOURCE_META, applySourceText, lintSource, parseError } from "../src/react/source-sync.js";

const registrySpec: RegistrySpec = {
  mdmxRegistryVersion: 3,
  components: [
    {
      name: "Callout",
      children: { policy: "rich-text" },
      props: [
        { name: "variant", required: true, control: { type: "select", options: ["info", "warn"] }, default: "info" },
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

function stateOf(src: string): EditorState {
  return EditorState.create({ schema, doc: fromMdast(parseMDX(src), { schema, registry, source: src }) });
}

describe("applySourceText (ADR-059)", () => {
  it("turns valid text into one document-replacing transaction that re-serializes identically", () => {
    const state = stateOf(SRC);
    const edited = SRC.replace("Intro paragraph.", "Intro **paragraph**.");
    const result = applySourceText(state, edited, registry);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tr).not.toBeNull();
    expect(result.tr!.docChanged).toBe(true);
    expect(result.tr!.getMeta(SOURCE_META)).toBe(true);
    const next = state.apply(result.tr!);
    expect(serializeDoc(next.doc, registry)).toBe(edited);
    expect(next.doc.child(1).textContent).toBe("Intro paragraph.");
  });

  it("is a no-op for text that already describes the document", () => {
    const state = stateOf(SRC);
    const result = applySourceText(state, SRC, registry);
    expect(result).toEqual({ ok: true, tr: null });
  });

  it("reports a parse error with its position and dispatches nothing", () => {
    const state = stateOf(SRC);
    const broken = "# Title\n\n<Callout variant=\"warn\">\n  Body\n";
    const result = applySourceText(state, broken, registry);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBeGreaterThanOrEqual(1);
    expect(result.error.column).toBeGreaterThanOrEqual(1);
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  it("lands frontmatter edits in the doc attribute", () => {
    const state = stateOf(SRC);
    const result = applySourceText(state, `---\ntitle: Hi\nstatus: draft\n---\n\n${SRC}`, registry);
    expect(result.ok && result.tr).toBeTruthy();
    if (!result.ok || !result.tr) return;
    const next = state.apply(result.tr);
    expect(next.doc.attrs.frontmatter).toBe("title: Hi\nstatus: draft");
    expect(serializeDoc(next.doc, registry)).toBe(`---\ntitle: Hi\nstatus: draft\n---\n\n${SRC}`);
  });

  it("keeps an unknown component as a raw block (the doc holds it verbatim; it prints canonically)", () => {
    const state = stateOf(SRC);
    const text = `${SRC}\n<Mystery a="1"   b={2} />\n`;
    const result = applySourceText(state, text, registry);
    expect(result.ok && result.tr).toBeTruthy();
    if (!result.ok || !result.tr) return;
    const next = state.apply(result.tr);
    const last = next.doc.lastChild!;
    expect(last.type.name).toBe("mdmx_raw");
    expect(last.attrs.source).toBe(`<Mystery a="1"   b={2} />`);
    // Raw regions re-emit through the canonical printer (to-mdast re-parses
    // them), so the odd spacing normalizes — the blur snap makes that visible.
    expect(serializeDoc(next.doc, registry)).toBe(`${SRC}\n<Mystery a="1" b={2} />\n`);
  });

  it("places the selection on the block under the cursor line", () => {
    const state = stateOf(SRC);
    const edited = SRC.replace("Body text.", "Body.");
    const calloutLine = edited.split("\n").findIndex((l) => l.startsWith("<Callout"));
    const onCallout = applySourceText(state, edited, registry, calloutLine + 1);
    if (!onCallout.ok || !onCallout.tr) throw new Error("expected a transaction");
    const sel = state.apply(onCallout.tr).selection;
    expect(sel).toBeInstanceOf(NodeSelection);
    expect((sel as NodeSelection).node.type.name).toBe("mdmx_Callout");

    const onHeading = applySourceText(state, edited, registry, 0);
    if (!onHeading.ok || !onHeading.tr) throw new Error("expected a transaction");
    const sel2 = state.apply(onHeading.tr).selection;
    expect(sel2).toBeInstanceOf(TextSelection);
    expect(sel2.from).toBe(1);
  });
});

describe("lintSource (ADR-059)", () => {
  const collection: CollectionSpec = {
    name: "posts",
    dir: "content/posts",
    fields: [{ name: "title", required: true, control: { type: "text" } }],
  };

  it("reports validator diagnostics with codes and positions", () => {
    const diags = lintSource(`# T\n\n<Mystery />\n\n<Stat value="1" />\n`, registry);
    const codes = diags.map((d) => d.code);
    expect(codes).toContain("MDMX001");
    expect(codes).toContain("MDMX006");
    const unknown = diags.find((d) => d.code === "MDMX001")!;
    expect(unknown.line).toBe(3);
    expect(unknown.severity).toBe("error");
  });

  it("reports a syntax error as one code-less error at its position", () => {
    const diags = lintSource("# T\n\n<Callout>\n  x\n", registry);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBeUndefined();
    expect(diags[0]!.severity).toBe("error");
    expect(diags[0]!.message).toMatch(/^Syntax error/);
  });

  it("checks frontmatter against the collection, and broken YAML as MDMX010", () => {
    expect(lintSource("---\nstatus: draft\n---\n\n# T\n", registry, collection).map((d) => d.code)).toEqual(["MDMX008"]);
    expect(lintSource("---\ntitle: Hi\n---\n\n# T\n", registry, collection)).toEqual([]);
    expect(lintSource("---\ntitle: [\n---\n\n# T\n", registry, collection).map((d) => d.code)).toEqual(["MDMX010"]);
  });
});

describe("parseError", () => {
  it("reads VFileMessage-style positions and falls back to 1:1", () => {
    expect(parseError({ line: 4, column: 7, reason: "Unexpected" })).toEqual({ line: 4, column: 7, message: "Unexpected" });
    expect(parseError({ place: { start: { line: 2, column: 3 } }, message: "  multi\n  line " })).toEqual({ line: 2, column: 3, message: "multi line" });
    expect(parseError(new Error("boom"))).toEqual({ line: 1, column: 1, message: "boom" });
  });
});
