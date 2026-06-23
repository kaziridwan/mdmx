import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { inputRules, textblockTypeInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { insertPoint } from "prosemirror-transform";
import type { Command, EditorState, Transaction } from "prosemirror-state";
import { Fragment, type Node as PMNode, type NodeType, type Schema } from "prosemirror-model";
import type { ComponentSpec, Registry } from "@mdmx/core";
import { componentNodeName, componentNameFromNode } from "./schema.js";

/** Markdown input rules: type the shortcut, the block transforms. */
export function mdmxInputRules(schema: Schema) {
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
 * `allowedParents` is enforced by the core validator, not the ProseMirror
 * schema (every component node is in the `block` group), so the editor must
 * check it explicitly on insert. Returns true when `spec` permits living
 * directly inside `container` (null/empty constraint ⇒ anywhere).
 */
function parentAllowed(spec: ComponentSpec, container: PMNode | null): boolean {
  const allowed = spec.constraints?.allowedParents ?? null;
  if (!allowed || allowed.length === 0) return true;
  const containerComponent = container ? componentNameFromNode(container.type.name) : null;
  return containerComponent != null && allowed.includes(containerComponent);
}

interface InsertPlan {
  /** Range to replace (`from === to` ⇒ a plain insert). */
  from: number;
  to: number;
  /** The node the component would land inside (for `allowedParents` checks). */
  container: PMNode | null;
}

/**
 * Decide where a component `type` lands for the current selection, preferring
 * the **deepest** valid container so an insert inside a Column stays inside it.
 * When the cursor is in an empty textblock the container accepts, that block is
 * replaced; otherwise the nearest `insertPoint` is used. Null ⇒ the schema has
 * nowhere to put it near the cursor.
 */
function planComponentInsert(
  state: EditorState,
  type: NodeType,
): InsertPlan | null {
  const { $from, empty } = state.selection;
  const depth = $from.depth;
  if (empty && depth > 0 && $from.parent.isTextblock && $from.parent.content.size === 0) {
    const container = $from.node(depth - 1);
    const index = $from.index(depth - 1);
    if (container.canReplaceWith(index, index + 1, type)) {
      return { from: $from.before(depth), to: $from.after(depth), container };
    }
  }
  const point = insertPoint(state.doc, state.selection.from, type);
  if (point == null) return null;
  return { from: point, to: point, container: state.doc.resolve(point).parent };
}

/**
 * Whether `name` can be inserted at the current selection — both the schema can
 * place it nearby AND its `allowedParents` constraint is satisfied. Drives the
 * context-aware slash palette (`slashItemsFor`).
 */
export function canInsertComponent(
  registry: Registry,
  schema: Schema,
  state: EditorState,
  name: string,
): boolean {
  const spec = registry.get(name);
  const type = schema.nodes[componentNodeName(name)];
  if (!spec || !type) return false;
  const plan = planComponentInsert(state, type);
  return plan != null && parentAllowed(spec, plan.container);
}

/**
 * Resolve where a rail-dropped component lands at document `pos`, honouring both
 * the schema and `allowedParents`. Returns the insert position, or null when the
 * component may not go there (so the drop is rejected rather than forced).
 */
export function resolveComponentDrop(
  registry: Registry,
  schema: Schema,
  doc: PMNode,
  pos: number,
  name: string,
): number | null {
  const spec = registry.get(name);
  const type = schema.nodes[componentNodeName(name)];
  if (!spec || !type) return null;
  const at = insertPoint(doc, pos, type);
  if (at == null) return null;
  return parentAllowed(spec, doc.resolve(at).parent) ? at : null;
}

/**
 * Insert a component at the current selection, seeding a usable subtree
 * (see `buildComponentNode`) so the block never lands broken or empty.
 *
 * Insertion is **region-local and constraint-aware**: it lands in the Column
 * (or other container) the cursor is in rather than lifting to the document top
 * level, and it refuses (a no-op, returns false) when the component's
 * `allowedParents` forbids the target container — so a `Column` is never
 * slash-inserted outside a `TwoColumn`.
 */
export function insertComponent(
  registry: Registry,
  schema: Schema,
  name: string,
): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const node = buildComponentNode(registry, schema, name);
    const spec = registry.get(name);
    if (!node || !spec) return false;

    const plan = planComponentInsert(state, node.type);
    if (!plan || !parentAllowed(spec, plan.container)) return false;

    if (dispatch) {
      const tr =
        plan.from === plan.to
          ? state.tr.insert(plan.from, node)
          : state.tr.replaceWith(plan.from, plan.to, node);
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

/**
 * Group slash items for display: core blocks under "Blocks", components under
 * their `category`. First-appearance order is preserved for both groups and
 * items, so flattening the result reproduces the input order (the slash menu
 * relies on this to keep keyboard-nav indices aligned). Pure.
 */
export function groupSlashItems(items: SlashItem[]): [string, SlashItem[]][] {
  const order: string[] = [];
  const groups = new Map<string, SlashItem[]>();
  for (const item of items) {
    const key = item.kind === "core" ? "Blocks" : (item.category ?? "Components");
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }
  return order.map((key) => [key, groups.get(key)!]);
}

/**
 * Context-aware palette: like `slashItems`, but component items are filtered to
 * those insertable at the current selection (schema + `allowedParents`). Core
 * blocks are always offered. This is what makes the slash menu region-aware —
 * inside a Column you won't be offered a `TwoColumn`-only child, and `Column`
 * never appears outside a `TwoColumn`.
 */
export function slashItemsFor(
  registry: Registry,
  schema: Schema,
  state: EditorState,
): SlashItem[] {
  return slashItems(registry, schema).filter(
    (item) => item.kind === "core" || canInsertComponent(registry, schema, state, item.id),
  );
}
