import { Schema, type NodeSpec, type MarkSpec } from "prosemirror-model";
import type { ComponentSpec, Registry } from "@imdx/core";

/** Name of the ProseMirror node generated for a registered component. */
export function componentNodeName(componentName: string): string {
  return `imdx_${componentName}`;
}

/** Inverse of componentNodeName; null if the node is not a component node. */
export function componentNameFromNode(nodeName: string): string | null {
  return nodeName.startsWith("imdx_") && nodeName !== "imdx_raw"
    ? nodeName.slice("imdx_".length)
    : null;
}

// ---------------------------------------------------------------------------
// Static core: the markdown subset
// ---------------------------------------------------------------------------

const coreNodes: Record<string, NodeSpec> = {
  doc: {
    content: "block+",
    attrs: { frontmatter: { default: null } }, // raw YAML string | null
  },
  paragraph: {
    group: "block",
    content: "inline*",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0],
  },
  heading: {
    group: "block",
    content: "inline*",
    attrs: { level: { default: 1 } },
    defining: true,
    toDOM: (n) => [`h${n.attrs.level}`, 0],
  },
  blockquote: {
    group: "block",
    content: "block+",
    toDOM: () => ["blockquote", 0],
  },
  code_block: {
    group: "block",
    content: "text*",
    marks: "",
    code: true,
    defining: true,
    attrs: { lang: { default: null }, meta: { default: null } },
    toDOM: () => ["pre", ["code", 0]],
  },
  bullet_list: {
    group: "block",
    content: "list_item+",
    toDOM: () => ["ul", 0],
  },
  ordered_list: {
    group: "block",
    content: "list_item+",
    attrs: { start: { default: 1 } },
    toDOM: (n) => ["ol", { start: n.attrs.start }, 0],
  },
  list_item: {
    content: "block+",
    defining: true,
    attrs: { checked: { default: null } }, // null | boolean (GFM task list)
    toDOM: () => ["li", 0],
  },
  table: {
    group: "block",
    content: "table_row+",
    attrs: { align: { default: null } }, // (null | "left" | "right" | "center")[]
    toDOM: () => ["table", 0],
  },
  table_row: {
    content: "table_cell+",
    toDOM: () => ["tr", 0],
  },
  table_cell: {
    content: "inline*",
    attrs: { header: { default: false } },
    toDOM: (n) => [n.attrs.header ? "th" : "td", 0],
  },
  horizontal_rule: {
    group: "block",
    toDOM: () => ["hr"],
  },
  image: {
    group: "inline",
    inline: true,
    attrs: { src: {}, alt: { default: "" }, title: { default: null } },
    draggable: true,
    toDOM: (n) => ["img", n.attrs],
  },
  hard_break: {
    group: "inline",
    inline: true,
    selectable: false,
    toDOM: () => ["br"],
  },
  text: { group: "inline" },
  /** Escape hatch: preserves out-of-subset source byte-for-byte. */
  imdx_raw: {
    group: "block",
    atom: true,
    selectable: true,
    attrs: { source: { default: "" } },
    toDOM: () => ["div", { class: "imdx-raw", "data-imdx-raw": "true" }],
  },
};

const coreMarks: Record<string, MarkSpec> = {
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    toDOM: (m) => ["a", { href: m.attrs.href }, 0],
  },
  strong: { toDOM: () => ["strong", 0] },
  em: { toDOM: () => ["em", 0] },
  strike: { toDOM: () => ["s", 0] },
  code: { toDOM: () => ["code", 0] },
};

/**
 * Canonical mark serialization priority. Outermost first: links must wrap
 * other marks so they are never split, and `code` is innermost because
 * mdast inlineCode is a leaf.
 */
export const MARK_PRIORITY = ["link", "strong", "em", "strike", "code"] as const;

// ---------------------------------------------------------------------------
// Dynamic half: component nodes from the registry
// ---------------------------------------------------------------------------

function contentExprFor(spec: ComponentSpec): string | undefined {
  const allowed = spec.constraints?.allowedChildren ?? null;
  if (allowed && allowed.length > 0) {
    // Slot containers: only the named components, regardless of policy.
    return allowed.map(componentNodeName).join(" | ") + "*";
  }
  switch (spec.children.policy) {
    case "none":
      return undefined;
    case "rich-text":
      // Paragraphs of phrasing content; matches how MDX parses flow JSX bodies.
      return "paragraph*";
    case "blocks":
      return "block*";
  }
}

function nodeSpecFor(spec: ComponentSpec): NodeSpec {
  const content = contentExprFor(spec);
  return {
    group: "block",
    ...(content ? { content } : { atom: true }),
    attrs: {
      /** All component props as a single JSON object (one attr = one undo step). */
      props: { default: {} },
    },
    selectable: true,
    draggable: true,
    toDOM: () => ["div", { "data-imdx-component": spec.name }, ...(content ? [0] : [])],
  };
}

/** Build the full editor schema for a registry. */
export function buildSchema(registry: Registry): Schema {
  const nodes: Record<string, NodeSpec> = { ...coreNodes };
  for (const spec of registry.components) {
    nodes[componentNodeName(spec.name)] = nodeSpecFor(spec);
  }
  return new Schema({ nodes, marks: coreMarks, topNode: "doc" });
}
