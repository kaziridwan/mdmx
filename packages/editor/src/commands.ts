import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { inputRules, textblockTypeInputRule, wrappingInputRule } from "prosemirror-inputrules";
import type { Command, EditorState, Transaction } from "prosemirror-state";
import { Fragment, type Node as PMNode, type Schema } from "prosemirror-model";
import type { ComponentSpec, Registry } from "@imdx/core";
import { componentNodeName } from "./schema.js";

/** Markdown input rules: type the shortcut, the block transforms. */
export function imdxInputRules(schema: Schema) {
  const rules = [];
  if (schema.nodes.heading) {
    rules.push(
      textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (m) => ({
        level: m[1]!.length,
      })),
    );
  }
  if (schema.nodes.blockquote) {
    rules.push(wrappingInputRule(/^>\s$/, schema.nodes.blockquote));
  }
  if (schema.nodes.bullet_list) {
    rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list));
  }
  if (schema.nodes.ordered_list) {
    rules.push(
      wrappingInputRule(
        /^(\d+)\.\s$/,
        schema.nodes.ordered_list,
        (m) => ({ start: Number(m[1]) }),
        (m, node) => node.childCount + node.attrs.start === Number(m[1]),
      ),
    );
  }
  return inputRules({ rules });
}

export function markCommands(schema: Schema): Record<string, Command> {
  const out: Record<string, Command> = {};
  if (schema.marks.strong) out.strong = toggleMark(schema.marks.strong);
  if (schema.marks.em) out.em = toggleMark(schema.marks.em);
  if (schema.marks.strike) out.strike = toggleMark(schema.marks.strike);
  if (schema.marks.code) out.code = toggleMark(schema.marks.code);
  return out;
}

export function setHeading(schema: Schema, level: number): Command {
  return setBlockType(schema.nodes.heading!, { level });
}

export function setParagraph(schema: Schema): Command {
  return setBlockType(schema.nodes.paragraph!);
}

export function wrapBlockquote(schema: Schema): Command {
  return wrapIn(schema.nodes.blockquote!);
}

// ---------------------------------------------------------------------------
// Component insertion
// ---------------------------------------------------------------------------

/** Build the initial props object for a freshly inserted component. */
export function initialProps(spec: ComponentSpec): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const p of spec.props) {
    if (p.default !== undefined) props[p.name] = p.default;
  }
  return props;
}

/** Cap recursion when seeding container subtrees (guards self-allowing specs). */
const MAX_SEED_DEPTH = 4;

/**
 * Build a component node, seeding a usable initial subtree so containers land
 * editable rather than empty:
 * - `none` → atom (no content)
 * - `rich-text` / `blocks` → one empty paragraph
 * - slot containers (`allowedChildren`) → one of each allowed child, or **two**
 *   when there is a single allowed type (the TwoColumn / repeater case),
 *   recursively seeded.
 * Returns null if the component isn't in the registry/schema.
 */
export function buildComponentNode(
  registry: Registry,
  schema: Schema,
  name: string,
  depth = 0,
): PMNode | null {
  const spec = registry.get(name);
  const nodeType = schema.nodes[componentNodeName(name)];
  if (!spec || !nodeType) return null;

  const props = initialProps(spec);
  const content: PMNode[] = [];
  if (depth < MAX_SEED_DEPTH) {
    const allowed = spec.constraints?.allowedChildren ?? null;
    if (allowed && allowed.length > 0) {
      const seedNames = allowed.length === 1 ? [allowed[0]!, allowed[0]!] : allowed;
      for (const childName of seedNames) {
        const child = buildComponentNode(registry, schema, childName, depth + 1);
        if (child) content.push(child);
      }
    } else if (spec.children.policy === "rich-text" || spec.children.policy === "blocks") {
      content.push(schema.nodes.paragraph!.create());
    }
  }

  return content.length > 0
    ? nodeType.createAndFill({ props }, Fragment.from(content))
    : nodeType.createAndFill({ props });
}

/**
 * Insert a component at the current selection, seeding a usable subtree
 * (see `buildComponentNode`) so the block never lands broken or empty.
 */
export function insertComponent(
  registry: Registry,
  schema: Schema,
  name: string,
): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const node = buildComponentNode(registry, schema, name);
    if (!node) return false;

    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(node);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export interface SlashItem {
  /** "core" blocks vs registry components. */
  kind: "core" | "component";
  id: string;
  label: string;
  description?: string;
  category?: string;
  icon?: string;
  run: Command;
}

/** Derive the slash-menu / palette items for a registry. */
export function slashItems(registry: Registry, schema: Schema): SlashItem[] {
  const core: SlashItem[] = [
    { kind: "core", id: "p", label: "Text", description: "Plain paragraph", icon: "type", run: setParagraph(schema) },
    { kind: "core", id: "h1", label: "Heading 1", icon: "heading-1", run: setHeading(schema, 1) },
    { kind: "core", id: "h2", label: "Heading 2", icon: "heading-2", run: setHeading(schema, 2) },
    { kind: "core", id: "h3", label: "Heading 3", icon: "heading-3", run: setHeading(schema, 3) },
    { kind: "core", id: "quote", label: "Quote", description: "Blockquote", icon: "quote", run: wrapBlockquote(schema) },
  ];
  const components: SlashItem[] = registry.components.map((spec) => ({
    kind: "component",
    id: spec.name,
    label: spec.name,
    description: spec.description,
    category: spec.category,
    icon: spec.icon,
    run: insertComponent(registry, schema, spec.name),
  }));
  return [...core, ...components];
}
