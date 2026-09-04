import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { inputRules, textblockTypeInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { insertPoint } from "prosemirror-transform";
import { NodeSelection, Selection, type Command, type EditorState, type Transaction } from "prosemirror-state";
import { Fragment, type Node as PMNode, type NodeType, type Schema } from "prosemirror-model";
import type { ComponentSpec, Registry } from "@mdmx/core";
import { componentNodeName, componentNameFromNode } from "./schema.js";
import { componentContext } from "./component-context.js";

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

/**
 * Keyboard shortcuts for the marks the schema actually has. Bindings follow
 * the conventions writers already know from every other editor; a mark the
 * registry's schema doesn't include simply gets no binding.
 */
export function markKeymap(schema: Schema): Record<string, Command> {
  const marks = markCommands(schema);
  const out: Record<string, Command> = {};
  if (marks.strong) {
    out["Mod-b"] = marks.strong;
    out["Mod-B"] = marks.strong;
  }
  if (marks.em) {
    out["Mod-i"] = marks.em;
    out["Mod-I"] = marks.em;
  }
  if (marks.code) out["Mod-e"] = marks.code;
  if (marks.strike) out["Mod-Shift-x"] = marks.strike;
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

/**
 * The props a freshly inserted component starts with: every `default`, then
 * the spec's insert-time `preview` over it (registry v3; `preview.children`
 * is paragraph text, not a prop — see `previewChildren`).
 */
export function initialProps(spec: ComponentSpec): Record<string, unknown> {
  const preview = spec.preview ?? {};
  // Spec declaration order, so the serialized attributes read the way the
  // author declared them regardless of where each value came from.
  const props: Record<string, unknown> = {};
  for (const p of spec.props) {
    const value = preview[p.name] !== undefined ? preview[p.name] : p.default;
    if (value !== undefined) props[p.name] = value;
  }
  return props;
}

/** The text a component's seeded first paragraph carries on insert, if any. */
export function previewChildren(spec: ComponentSpec): string | null {
  const text = spec.preview?.children;
  return typeof text === "string" && text.length > 0 && spec.children.policy !== "none"
    ? text
    : null;
}

/** Cap recursion when seeding container subtrees (guards self-allowing specs). */
const MAX_SEED_DEPTH = 4;

/**
 * Build a component node, seeding a usable initial subtree so containers land
 * editable rather than empty:
 * - `none` → atom (no content)
 * - `rich-text` / `blocks` → one paragraph, carrying the spec's
 *   `preview.children` text when it has one (registry v3), else empty
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
      const text = previewChildren(spec);
      content.push(schema.nodes.paragraph!.create(null, text ? schema.text(text) : null));
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

// ---------------------------------------------------------------------------
// Block actions (ADR-058): pure commands over the block at a position
// ---------------------------------------------------------------------------

/**
 * Delete the block at `pos`. If that empties a container that accepts
 * paragraphs (a Column, a Card), one empty paragraph is left behind so the
 * container stays enterable; the selection lands where the block was.
 */
export function deleteBlockAt(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || !node.isBlock) return false;
    if (dispatch) {
      const tr = state.tr.delete(pos, pos + node.nodeSize);
      const $at = tr.doc.resolve(Math.min(pos, tr.doc.content.size));
      const paragraph = state.schema.nodes.paragraph;
      if ($at.parent.childCount === 0 && paragraph && $at.parent.type.contentMatch.matchType(paragraph)) {
        tr.insert($at.pos, paragraph.create());
      }
      tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), 1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Insert a copy of the block at `pos` (children included) right after it, and select the copy. */
export function duplicateBlockAt(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || !node.isBlock) return false;
    if (dispatch) {
      const at = pos + node.nodeSize;
      const tr = state.tr.insert(at, node);
      tr.setSelection(NodeSelection.create(tr.doc, at));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/**
 * Swap the block at `pos` with its previous/next sibling. Same parent, so
 * every `allowedParents`/`allowedChildren` constraint holds by construction;
 * a no-op (false) at the edge.
 */
export function moveBlockAt(pos: number, dir: "up" | "down"): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || !node.isBlock) return false;
    const $pos = state.doc.resolve(pos);
    const parent = $pos.parent;
    const index = $pos.index();
    let to: number;
    if (dir === "up") {
      if (index === 0) return false;
      to = pos - parent.child(index - 1).nodeSize;
    } else {
      if (index >= parent.childCount - 1) return false;
      to = pos + parent.child(index + 1).nodeSize;
    }
    if (dispatch) {
      const tr = state.tr.delete(pos, pos + node.nodeSize).insert(to, node);
      tr.setSelection(NodeSelection.create(tr.doc, to));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/**
 * Keyboard bindings for the block actions, resolved against the component
 * context at keypress (the selected component, else the deepest one around
 * the caret): `Mod-Shift-Backspace` delete, `Mod-Shift-d` duplicate,
 * `Mod-Shift-ArrowUp/Down` move.
 */
export function blockActionKeymap(registry: Registry): Record<string, Command> {
  const onTarget =
    (make: (pos: number) => Command): Command =>
    (state, dispatch, view) => {
      const context = componentContext(state, registry);
      return context ? make(context.target.pos)(state, dispatch, view) : false;
    };
  return {
    "Mod-Shift-Backspace": onTarget(deleteBlockAt),
    "Mod-Shift-d": onTarget(duplicateBlockAt),
    "Mod-Shift-D": onTarget(duplicateBlockAt),
    "Mod-Shift-ArrowUp": onTarget((pos) => moveBlockAt(pos, "up")),
    "Mod-Shift-ArrowDown": onTarget((pos) => moveBlockAt(pos, "down")),
  };
}
