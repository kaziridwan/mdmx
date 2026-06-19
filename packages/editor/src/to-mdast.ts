import type {
  BlockContent,
  Content,
  PhrasingContent,
  Root,
  RootContent,
  TableCell,
  TableRow,
} from "mdast";
import type {
  MdxJsxAttribute,
  MdxJsxFlowElement,
} from "mdast-util-mdx-jsx";
import type { Mark, Node as PMNode } from "prosemirror-model";
import { parseMDX, type JsonValue, type Registry } from "@imdx/core";
import { componentNameFromNode, MARK_PRIORITY } from "./schema.js";

export interface ToMdastOptions {
  registry: Registry;
}

/** Convert a ProseMirror document back into an mdast Root. */
export function toMdast(doc: PMNode, _options: ToMdastOptions): Root {
  const children: RootContent[] = [];
  const frontmatter = doc.attrs.frontmatter as string | null;
  if (frontmatter != null) {
    children.push({ type: "yaml", value: frontmatter });
  }
  doc.forEach((child) => children.push(...blockToMdast(child)));
  return { type: "root", children };
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function blockToMdast(node: PMNode): RootContent[] {
  switch (node.type.name) {
    case "paragraph": {
      const children = inlineToMdast(collectInline(node));
      return children.length > 0 ? [{ type: "paragraph", children }] : [];
    }
    case "heading":
      return [
        {
          type: "heading",
          depth: clampDepth(node.attrs.level as number),
          children: inlineToMdast(collectInline(node)),
        },
      ];
    case "blockquote":
      return [{ type: "blockquote", children: childBlocks(node) as BlockContent[] }];
    case "code_block":
      return [
        {
          type: "code",
          lang: (node.attrs.lang as string | null) ?? undefined,
          meta: (node.attrs.meta as string | null) ?? undefined,
          value: node.textContent,
        },
      ];
    case "bullet_list":
      return [list(node, false)];
    case "ordered_list":
      return [list(node, true)];
    case "horizontal_rule":
      return [{ type: "thematicBreak" }];
    case "table":
      return [tableToMdast(node)];
    case "imdx_raw": {
      const source = node.attrs.source as string;
      return parseMDX(source).children;
    }
    default: {
      const componentName = componentNameFromNode(node.type.name);
      if (componentName) return [componentToMdast(node, componentName)];
      // Unknown node type: drop with a comment-free best effort (shouldn't
      // happen for schema-valid docs).
      return [];
    }
  }
}

function clampDepth(level: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return Math.min(6, Math.max(1, Math.round(level))) as 1 | 2 | 3 | 4 | 5 | 6;
}

function childBlocks(node: PMNode): RootContent[] {
  const out: RootContent[] = [];
  node.forEach((child) => out.push(...blockToMdast(child)));
  return out;
}

function list(node: PMNode, ordered: boolean): Content & { type: "list" } {
  const items: Array<Content & { type: "listItem" }> = [];
  node.forEach((item) => {
    items.push({
      type: "listItem",
      checked: (item.attrs.checked as boolean | null) ?? null,
      spread: false,
      children: childBlocks(item) as BlockContent[],
    });
  });
  return {
    type: "list",
    ordered,
    ...(ordered ? { start: node.attrs.start as number } : {}),
    spread: false,
    children: items,
  };
}

function tableToMdast(node: PMNode): Content & { type: "table" } {
  const rows: TableRow[] = [];
  node.forEach((row) => {
    const cells: TableCell[] = [];
    row.forEach((cell) => {
      cells.push({ type: "tableCell", children: inlineToMdast(collectInline(cell)) });
    });
    rows.push({ type: "tableRow", children: cells });
  });
  return {
    type: "table",
    align: (node.attrs.align as Array<"left" | "right" | "center" | null> | null) ?? undefined,
    children: rows,
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function componentToMdast(node: PMNode, name: string): MdxJsxFlowElement {
  const props = node.attrs.props as Record<string, JsonValue>;
  const attributes: MdxJsxAttribute[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (value === true) {
      attributes.push({ type: "mdxJsxAttribute", name: key, value: null });
    } else if (typeof value === "string") {
      attributes.push({ type: "mdxJsxAttribute", name: key, value });
    } else {
      attributes.push({
        type: "mdxJsxAttribute",
        name: key,
        value: {
          type: "mdxJsxAttributeValueExpression",
          value: printPropValue(value),
        },
      });
    }
  }
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes,
    children: childBlocks(node) as BlockContent[],
  };
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Canonical printing for prop expressions. Part of the iMDX canonical form:
 * `, ` separators, unquoted identifier keys, double-quoted strings.
 */
export function printPropValue(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(printPropValue).join(", ")}]`;
  }
  const entries = Object.entries(value).map(([k, v]) => {
    const key = IDENTIFIER.test(k) ? k : JSON.stringify(k);
    return `${key}: ${printPropValue(v)}`;
  });
  return `{${entries.join(", ")}}`;
}

// ---------------------------------------------------------------------------
// Inline: mark grouping
// ---------------------------------------------------------------------------

interface InlineLeaf {
  node: PMNode;
  marks: readonly Mark[];
}

function collectInline(parent: PMNode): InlineLeaf[] {
  const out: InlineLeaf[] = [];
  parent.forEach((child) => out.push({ node: child, marks: child.marks }));
  return out;
}

function priorityOf(mark: Mark): number {
  const i = (MARK_PRIORITY as readonly string[]).indexOf(mark.type.name);
  return i === -1 ? MARK_PRIORITY.length : i;
}

/**
 * Convert a flat run of inline leaves into nested mdast phrasing.
 * Strategy: take the highest-priority mark on the first leaf, extend the run
 * for as long as that exact mark is present, wrap, and recurse with the mark
 * removed. Links carry attrs, so "same mark" is mark.eq (href-sensitive).
 */
export function inlineToMdast(leaves: InlineLeaf[]): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let i = 0;
  while (i < leaves.length) {
    const leaf = leaves[i]!;
    if (leaf.marks.length === 0) {
      out.push(leafToMdast(leaf.node));
      i += 1;
      continue;
    }
    const mark = [...leaf.marks].sort((a, b) => priorityOf(a) - priorityOf(b))[0]!;
    let j = i;
    while (j < leaves.length && leaves[j]!.marks.some((m) => m.eq(mark))) j += 1;
    const run = leaves.slice(i, j).map((l) => ({
      node: l.node,
      marks: l.marks.filter((m) => !m.eq(mark)),
    }));
    out.push(wrapWithMark(mark, run));
    i = j;
  }
  return mergeAdjacentText(out);
}

function wrapWithMark(mark: Mark, run: InlineLeaf[]): PhrasingContent {
  switch (mark.type.name) {
    case "link":
      return {
        type: "link",
        url: mark.attrs.href as string,
        title: (mark.attrs.title as string | null) ?? null,
        children: inlineToMdast(run),
      };
    case "strong":
      return { type: "strong", children: inlineToMdast(run) };
    case "em":
      return { type: "emphasis", children: inlineToMdast(run) };
    case "strike":
      return { type: "delete", children: inlineToMdast(run) };
    case "code":
      // inlineCode is a leaf in mdast: concatenate the run's text.
      return {
        type: "inlineCode",
        value: run.map((l) => l.node.text ?? "").join(""),
      };
    default:
      // Unknown mark: drop the mark, keep content.
      return { type: "text", value: run.map((l) => l.node.text ?? "").join("") };
  }
}

function leafToMdast(node: PMNode): PhrasingContent {
  switch (node.type.name) {
    case "text":
      return { type: "text", value: node.text ?? "" };
    case "hard_break":
      return { type: "break" };
    case "image":
      return {
        type: "image",
        url: node.attrs.src as string,
        alt: (node.attrs.alt as string) || null,
        title: (node.attrs.title as string | null) ?? null,
      };
    default:
      return { type: "text", value: node.textContent };
  }
}

function mergeAdjacentText(nodes: PhrasingContent[]): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === "text" && last?.type === "text") {
      last.value += node.value;
    } else {
      out.push(node);
    }
  }
  return out;
}
