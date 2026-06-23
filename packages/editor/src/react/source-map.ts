import { toMDX, type Registry } from "@mdmx/core";
import type { Node as PMNode } from "prosemirror-model";
import { toMdast } from "../to-mdast.js";

/** Canonical MDMX for the whole document — the live source-pane text. */
export function serializeDoc(doc: PMNode, registry: Registry): string {
  return toMDX(toMdast(doc, { registry }));
}

/** Index of the top-level block containing document position `pos`. */
export function topLevelIndexAt(doc: PMNode, pos: number): number {
  let before = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const after = before + doc.child(i).nodeSize;
    if (pos >= before && pos < after) return i;
    before = after;
  }
  return Math.max(0, doc.childCount - 1);
}

export interface LineRange {
  /** 0-based first highlighted line. */
  startLine: number;
  /** 0-based last highlighted line (inclusive). */
  endLine: number;
}

/**
 * Line span of the active top-level block within the canonical source. Works by
 * serializing that block alone and locating its text in the full output — robust
 * to canonical inter-block spacing without a position map. Best-effort: returns
 * the first match, null if it can't be located.
 */
export function activeBlockRange(
  doc: PMNode,
  registry: Registry,
  pos: number,
): LineRange | null {
  let full: string;
  try {
    full = serializeDoc(doc, registry);
  } catch {
    return null;
  }
  const child = doc.maybeChild(topLevelIndexAt(doc, pos));
  if (!child) return null;

  let seg: string;
  try {
    const single = doc.type.create({ frontmatter: null }, child);
    seg = toMDX(toMdast(single, { registry })).replace(/\n+$/, "");
  } catch {
    return null;
  }
  if (seg === "") return null;

  const idx = full.indexOf(seg);
  if (idx < 0) return null;
  const startLine = full.slice(0, idx).split("\n").length - 1;
  const endLine = startLine + seg.split("\n").length - 1;
  return { startLine, endLine };
}
