import type {
  Content,
  List,
  ListItem,
  Node as MdastNode,
  PhrasingContent,
  Root,
  Table,
} from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import {
  Fragment,
  Mark,
  type Node as PMNode,
  type Schema,
} from "prosemirror-model";
import { evaluateAttributes, toMDX, type Registry } from "@imdx/core";
import { componentNodeName } from "./schema.js";

export interface FromMdastOptions {
  schema: Schema;
  registry: Registry;
  /** Original source text; enables byte-exact raw fallbacks via positions. */
  source?: string;
}

/** Convert an mdast Root into a ProseMirror document node. */
export function fromMdast(tree: Root, options: FromMdastOptions): PMNode {
  const ctx = new Ctx(options);
  let frontmatter: string | null = null;
  const blocks: PMNode[] = [];
  for (const child of tree.children) {
    if (child.type === "yaml") {
      frontmatter = child.value;
      continue;
    }
    blocks.push(...ctx.block(child));
  }
  const doc = options.schema.nodes.doc!.createAndFill(
    { frontmatter },
    Fragment.from(blocks),
  );
  if (!doc) throw new Error("Could not create document node");
  return doc;
}

class Ctx {
  readonly schema: Schema;
  readonly registry: Registry;
  readonly source?: string;

  constructor(options: FromMdastOptions) {
    this.schema = options.schema;
    this.registry = options.registry;
    this.source = options.source;
  }

  // -- blocks ---------------------------------------------------------------

  block(node: Content): PMNode[] {
    const n = this.schema.nodes;
    switch (node.type) {
      case "paragraph":
        return [n.paragraph!.create(null, this.inline(node.children))];
      case "heading":
        return [n.heading!.create({ level: node.depth }, this.inline(node.children))];
      case "blockquote":
        return [n.blockquote!.create(null, Fragment.from(node.children.flatMap((c) => this.block(c))))];
      case "code":
        return [
          n.code_block!.create(
            { lang: node.lang ?? null, meta: node.meta ?? null },
            node.value ? this.schema.text(node.value) : Fragment.empty,
          ),
        ];
      case "list":
        return [this.list(node)];
      case "thematicBreak":
        return [n.horizontal_rule!.create()];
      case "table":
        return [this.table(node)];
      case "mdxJsxFlowElement":
        return [this.component(node as MdxJsxFlowElement)];
      default:
        return [this.raw(node)];
    }
  }

  list(node: List): PMNode {
    const n = this.schema.nodes;
    const items = node.children.map((item: ListItem) =>
      n.list_item!.create(
        { checked: item.checked ?? null },
        Fragment.from(item.children.flatMap((c) => this.block(c as Content))),
      ),
    );
    return node.ordered
      ? n.ordered_list!.create({ start: node.start ?? 1 }, Fragment.from(items))
      : n.bullet_list!.create(null, Fragment.from(items));
  }

  table(node: Table): PMNode {
    const n = this.schema.nodes;
    const rows = node.children.map((row, rowIndex) =>
      n.table_row!.create(
        null,
        Fragment.from(
          row.children.map((cell) =>
            n.table_cell!.create(
              { header: rowIndex === 0 },
              this.inline(cell.children),
            ),
          ),
        ),
      ),
    );
    return n.table!.create({ align: node.align ?? null }, Fragment.from(rows));
  }

  component(el: MdxJsxFlowElement): PMNode {
    const name = el.name;
    const spec = name ? this.registry.get(name) : undefined;
    if (!name || !spec) return this.raw(el);

    const { props, diagnostics } = evaluateAttributes(el);
    if (diagnostics.some((d) => d.severity === "error")) return this.raw(el);

    const nodeType = this.schema.nodes[componentNodeName(name)];
    if (!nodeType) return this.raw(el);

    let content: Fragment = Fragment.empty;
    if (spec.children.policy === "rich-text") {
      const paragraphs: PMNode[] = [];
      for (const child of el.children) {
        if (child.type !== "paragraph") return this.raw(el);
        paragraphs.push(
          this.schema.nodes.paragraph!.create(null, this.inline(child.children)),
        );
      }
      content = Fragment.from(paragraphs);
    } else if (spec.children.policy === "blocks") {
      content = Fragment.from(el.children.flatMap((c) => this.block(c as Content)));
    } else if (el.children.length > 0) {
      return this.raw(el); // children on a children:none component
    }

    const node = nodeType.createAndFill({ props }, content);
    return node ?? this.raw(el);
  }

  /** Preserve out-of-subset content byte-for-byte. */
  raw(node: MdastNode): PMNode {
    let source: string | undefined;
    const pos = node.position;
    if (
      this.source !== undefined &&
      pos?.start.offset !== undefined &&
      pos?.end.offset !== undefined
    ) {
      source = this.source.slice(pos.start.offset, pos.end.offset);
    } else {
      source = toMDX({ type: "root", children: [node as Content] }).replace(/\n$/, "");
    }
    return this.schema.nodes.imdx_raw!.create({ source });
  }

  // -- inline ---------------------------------------------------------------

  inline(children: PhrasingContent[], marks: readonly Mark[] = []): Fragment {
    const out: PMNode[] = [];
    for (const child of children) {
      out.push(...this.phrasing(child, marks));
    }
    return Fragment.from(out);
  }

  phrasing(node: PhrasingContent, marks: readonly Mark[]): PMNode[] {
    const m = this.schema.marks;
    switch (node.type) {
      case "text":
        return node.value ? [this.schema.text(node.value, marks as Mark[])] : [];
      case "emphasis":
        return this.spread(node.children, marks, m.em!.create());
      case "strong":
        return this.spread(node.children, marks, m.strong!.create());
      case "delete":
        return this.spread(node.children, marks, m.strike!.create());
      case "link":
        return this.spread(
          node.children,
          marks,
          m.link!.create({ href: node.url, title: node.title ?? null }),
        );
      case "inlineCode":
        return [this.schema.text(node.value, [...marks, m.code!.create()])];
      case "break":
        return [this.schema.nodes.hard_break!.create(null, null, marks as Mark[])];
      case "image":
        return [
          this.schema.nodes.image!.create(
            { src: node.url, alt: node.alt ?? "", title: node.title ?? null },
            null,
            marks as Mark[],
          ),
        ];
      default:
        // Out-of-subset phrasing (e.g. inline JSX) cannot become a block-level
        // raw node here; degrade to its serialized text so nothing is lost.
        return [
          this.schema.text(
            toMDX({
              type: "root",
              children: [{ type: "paragraph", children: [node] }],
            }).trim(),
            marks as Mark[],
          ),
        ];
    }
  }

  private spread(
    children: PhrasingContent[],
    marks: readonly Mark[],
    mark: Mark,
  ): PMNode[] {
    const next = mark.addToSet(marks as Mark[]);
    const out: PMNode[] = [];
    for (const child of children) out.push(...this.phrasing(child, next));
    return out;
  }
}
