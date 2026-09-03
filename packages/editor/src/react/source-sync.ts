import {
  parseDocument,
  parseMDX,
  validateFrontmatter,
  validateTree,
  type CollectionSpec,
  type Diagnostic,
  type Registry,
} from "@mdmx/core";
import { NodeSelection, Selection, type EditorState, type Transaction } from "prosemirror-state";
import { fromMdast } from "../from-mdast.js";
import { componentNameFromNode } from "../schema.js";
import { blockIndexAtLine, blockLineMap, topLevelPosOf } from "./source-map.js";

/**
 * Two-way source (ADR-059), the headless half: text typed in the source pane
 * becomes the document through the same `parseMDX` → `fromMdast` path a file
 * load uses, so whatever the pane shows is exactly what a load of that text
 * would show. No CodeMirror here — the pane adapts these to its widgets.
 */

/** Transaction meta marking a document change that came from the source pane. */
export const SOURCE_META = "mdmx-source";

export interface SourcePosition {
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

export interface SourceError extends SourcePosition {
  message: string;
}

export type ApplyResult =
  /** `tr` is null when the text already describes the current document. */
  | { ok: true; tr: Transaction | null }
  | { ok: false; error: SourceError };

/** Position + message out of the `VFileMessage` remark throws on malformed JSX. */
export function parseError(err: unknown): SourceError {
  const e = (err ?? {}) as {
    line?: number | null;
    column?: number | null;
    place?: { line?: number; column?: number; start?: { line?: number; column?: number } } | null;
    reason?: string;
    message?: string;
  };
  const place = e.place ?? null;
  const line = e.line ?? place?.line ?? place?.start?.line ?? 1;
  const column = e.column ?? place?.column ?? place?.start?.column ?? 1;
  const message = (e.reason ?? e.message ?? String(err)).replace(/\s+/g, " ").trim();
  return { line: line || 1, column: column || 1, message };
}

/**
 * Turn source text into one document-replacing transaction. Parse failure →
 * an error with its position and nothing to dispatch. `cursorLine` (0-based)
 * places the selection on the block under the pane's cursor: a component
 * block gets a `NodeSelection`, a textblock the caret at its start.
 */
export function applySourceText(
  state: EditorState,
  text: string,
  registry: Registry,
  cursorLine?: number,
): ApplyResult {
  let doc;
  try {
    doc = fromMdast(parseMDX(text), { schema: state.schema, registry, source: text });
  } catch (err) {
    return { ok: false, error: parseError(err) };
  }
  if (doc.eq(state.doc)) return { ok: true, tr: null };

  const tr = state.tr.replaceWith(0, state.doc.content.size, doc.content);
  if (doc.attrs.frontmatter !== state.doc.attrs.frontmatter) {
    tr.setDocAttribute("frontmatter", doc.attrs.frontmatter);
  }
  tr.setMeta(SOURCE_META, true);

  if (cursorLine !== undefined) {
    const index = blockIndexAtLine(blockLineMap(tr.doc, registry), cursorLine);
    if (index !== null) {
      const pos = topLevelPosOf(tr.doc, index);
      const block = tr.doc.child(index);
      const isComponent = componentNameFromNode(block.type.name) != null && registry.has(componentNameFromNode(block.type.name)!);
      tr.setSelection(
        isComponent && NodeSelection.isSelectable(block)
          ? NodeSelection.create(tr.doc, pos)
          : Selection.near(tr.doc.resolve(pos), 1),
      );
    }
  }
  return { ok: true, tr };
}

export interface SourceDiagnostic {
  /** 1-based start. */
  line: number;
  column: number;
  /** 1-based end (inclusive of the span's end position). */
  endLine: number;
  endColumn: number;
  severity: "error" | "warning";
  message: string;
  /** MDMX code; absent for a syntax error. */
  code?: Diagnostic["code"];
}

/**
 * Lint markers for the pane: the validator's diagnostics (subset rules,
 * registry membership, props, children policies, frontmatter against the
 * collection) — informational, never blocking an apply — plus the parse
 * error itself when the text doesn't parse.
 */
export function lintSource(
  text: string,
  registry: Registry,
  collection?: CollectionSpec,
): SourceDiagnostic[] {
  let parsed;
  try {
    parsed = parseDocument(text);
  } catch (err) {
    const e = parseError(err);
    return [{ line: e.line, column: e.column, endLine: e.line, endColumn: e.column, severity: "error", message: `Syntax error: ${e.message}` }];
  }
  const diagnostics = validateTree(parsed.tree, { registry });
  if (parsed.frontmatterDiagnostic) diagnostics.push(parsed.frontmatterDiagnostic);
  else if (collection) diagnostics.push(...validateFrontmatter(parsed.frontmatter, collection));
  return diagnostics.map((d) => ({
    line: d.span?.start.line ?? 1,
    column: d.span?.start.column ?? 1,
    endLine: d.span?.end.line ?? d.span?.start.line ?? 1,
    endColumn: d.span?.end.column ?? d.span?.start.column ?? 1,
    severity: d.severity,
    message: d.message,
    code: d.code,
  }));
}
