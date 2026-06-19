import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateAttributes,
  parseDocument,
  parseMDX,
  toMDX,
} from "../src/index.js";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";

const fixture = (name: string): string =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

/** Strip `position` info so trees can be deep-compared structurally. */
function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "position") continue;
      // estree nodes carry their own location fields
      if (k === "start" || k === "end" || k === "loc" || k === "range") continue;
      out[k] = strip(v);
    }
    return out;
  }
  return node;
}

describe("round-trip", () => {
  const source = fixture("kitchen-sink.mdx");

  it("serialization is idempotent (canonical fixed point)", () => {
    const once = toMDX(parseMDX(source));
    const twice = toMDX(parseMDX(once));
    expect(twice).toBe(once);
  });

  it("AST survives a serialize/parse cycle", () => {
    const tree1 = parseMDX(source);
    const tree2 = parseMDX(toMDX(tree1));
    expect(strip(tree2)).toEqual(strip(tree1));
  });

  it("canonical output ends with exactly one newline", () => {
    const out = toMDX(parseMDX(source));
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("a one-line edit produces a localized diff", () => {
    const canonical = toMDX(parseMDX(source));
    const tree = parseMDX(canonical);
    // Mutate the Callout's title prop only.
    const callout = tree.children.find(
      (n): n is MdxJsxFlowElement =>
        n.type === "mdxJsxFlowElement" && (n as MdxJsxFlowElement).name === "Callout",
    );
    expect(callout).toBeDefined();
    const titleAttr = callout!.attributes.find(
      (a) => a.type === "mdxJsxAttribute" && a.name === "title",
    );
    expect(titleAttr).toBeDefined();
    (titleAttr as { value: string }).value = "Changed!";

    const edited = toMDX(tree);
    const before = canonical.split("\n");
    const after = edited.split("\n");
    expect(after.length).toBe(before.length);
    const changed = before.filter((line, i) => line !== after[i]);
    expect(changed.length).toBe(1);
    expect(changed[0]).toContain("Heads up");
  });
});

describe("frontmatter", () => {
  it("parses YAML frontmatter into an object", () => {
    const { frontmatter } = parseDocument(fixture("kitchen-sink.mdx"));
    expect(frontmatter).toEqual({
      title: "Hello iMDX",
      slug: "hello-imdx",
      status: "draft",
    });
  });
});

describe("prop evaluation", () => {
  it("evaluates all JSON-shaped attribute forms", () => {
    const tree = parseMDX(fixture("kitchen-sink.mdx"));
    const chart = tree.children.find(
      (n): n is MdxJsxFlowElement =>
        n.type === "mdxJsxFlowElement" && (n as MdxJsxFlowElement).name === "Chart",
    );
    expect(chart).toBeDefined();
    const { props, diagnostics } = evaluateAttributes(chart!);
    expect(diagnostics).toEqual([]);
    expect(props).toEqual({
      title: "Revenue",
      height: 320,
      stacked: true,
      series: ["q1", "q2"],
      config: { legend: "top", max: -5 },
    });
  });
});
