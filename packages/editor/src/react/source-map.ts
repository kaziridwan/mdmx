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

/** Document position before top-level block `index`. */
export function topLevelPosOf(doc: PMNode, index: number): number {
  let pos = 0;
  for (let i = 0; i < index && i < doc.childCount; i++) pos += doc.child(i).nodeSize;
  return pos;
}

export interface LineRange {
  /** 0-based first line. */
  startLine: number;
  /** 0-based last line (inclusive). */
  endLine: number;
}

/**
 * Line span of every top-level block in the canonical source, in order.
 * Each block is serialized alone and located in the full text *after the
 * previous block*, so two identical blocks get their own ranges (a plain
 * `indexOf` found the first one twice). Null for a block that serializes to
 * nothing or can't be located. `upTo` stops after that index (the active
 * block only needs the walk up to itself).
 */
export function blockLineMap(
  doc: PMNode,
  registry: Registry,
  upTo: number = doc.childCount - 1,
): (LineRange | null)[] {
  let full: string;
  try {
    full = serializeDoc(doc, registry);
  } catch {
    return [];
  }
  const out: (LineRange | null)[] = [];
  let cursor = 0;
  for (let i = 0; i <= upTo && i < doc.childCount; i++) {
    let seg: string;
    try {
      const single = doc.type.create({ frontmatter: null }, doc.child(i));
      seg = toMDX(toMdast(single, { registry })).replace(/\n+$/, "");
    } catch {
      out.push(null);
      continue;
    }
    if (seg === "") {
      out.push(null);
      continue;
    }
    const idx = full.indexOf(seg, cursor);
    if (idx < 0) {
      out.push(null);
      continue;
    }
    const startLine = full.slice(0, idx).split("\n").length - 1;
    out.push({ startLine, endLine: startLine + seg.split("\n").length - 1 });
    cursor = idx + seg.length;
  }
  return out;
}

/** Line span of the top-level block containing `pos`, or null if it can't be located. */
export function activeBlockRange(
  doc: PMNode,
  registry: Registry,
  pos: number,
): LineRange | null {
  const index = topLevelIndexAt(doc, pos);
  return blockLineMap(doc, registry, index)[index] ?? null;
}

/**
 * The top-level block under a 0-based source line: the block whose range
 * contains it, else the nearest block that starts above it (a blank line
 * between blocks belongs to the one before). Null above the first block.
 */
export function blockIndexAtLine(map: readonly (LineRange | null)[], line: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < map.length; i++) {
    const range = map[i];
    if (!range) continue;
    if (line >= range.startLine && line <= range.endLine) return i;
    if (range.startLine <= line) best = i;
  }
  return best;
}

/**
 * 0-based source line where the block at `pos` starts — a top-level block or
 * one nested inside it. Nested blocks are found by their serialization's
 * first line within the enclosing top-level block's range (first match wins
 * for identical siblings). Null when nothing can be located.
 */
export function blockLineAt(doc: PMNode, registry: Registry, pos: number): number | null {
  const index = topLevelIndexAt(doc, pos);
  const range = blockLineMap(doc, registry, index)[index];
  if (!range) return null;
  const node = doc.nodeAt(pos);
  if (!node || pos === topLevelPosOf(doc, index)) return range.startLine;
  let first: string | undefined;
  try {
    const single = doc.type.create({ frontmatter: null }, node);
    first = toMDX(toMdast(single, { registry })).split("\n")[0]?.trim();
  } catch {
    return range.startLine;
  }
  if (!first) return range.startLine;
  let lines: string[];
  try {
    lines = serializeDoc(doc, registry).split("\n");
  } catch {
    return range.startLine;
  }
  for (let line = range.startLine; line <= range.endLine; line++) {
    if (lines[line]?.trim() === first) return line;
  }
  return range.startLine;
}
