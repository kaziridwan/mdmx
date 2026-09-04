import { NodeSelection, type EditorState } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import type { ComponentSpec, Registry } from "@mdmx/core";
import { componentNameFromNode } from "./schema.js";

/** One registered component on the path from the document to the caret. */
export interface ComponentContextEntry {
  spec: ComponentSpec;
  node: PMNode;
  /** Position before the node (what `NodeSelection.create` and `nodeDOM` take). */
  pos: number;
}

/**
 * Which component the prop panel and block actions address (ADR-058): the
 * selected component node, else the deepest component around the caret —
 * so a caret inside a Tab's text edits the Tab, not the document.
 */
export interface ComponentContext {
  target: ComponentContextEntry;
  /** Component ancestors of the target, outermost first (the breadcrumb). */
  ancestors: ComponentContextEntry[];
}

function entryFor(node: PMNode, pos: number, registry: Registry): ComponentContextEntry | null {
  const name = componentNameFromNode(node.type.name);
  const spec = name ? registry.get(name) : undefined;
  return spec ? { spec, node, pos } : null;
}

/** Pure: derive the component context from a selection. Null when the caret is in plain content. */
export function componentContext(
  state: EditorState | null,
  registry: Registry,
): ComponentContext | null {
  if (!state) return null;
  const sel = state.selection;
  const $from = sel.$from;
  const chain: ComponentContextEntry[] = [];
  for (let depth = 1; depth <= $from.depth; depth++) {
    const entry = entryFor($from.node(depth), $from.before(depth), registry);
    if (entry) chain.push(entry);
  }
  if (sel instanceof NodeSelection) {
    const entry = entryFor(sel.node, sel.from, registry);
    if (entry) return { target: entry, ancestors: chain };
    // A selected image or raw block still sits inside components: fall through.
  }
  const target = chain.pop();
  return target ? { target, ancestors: chain } : null;
}

/** Outermost → target, for a breadcrumb. */
export function contextChain(context: ComponentContext): ComponentContextEntry[] {
  return [...context.ancestors, context.target];
}
