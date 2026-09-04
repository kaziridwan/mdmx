import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import type { CollectionSpec, Registry } from "@mdmx/core";
import {
  Annotation,
  EditorState as CMState,
  StateEffect,
  StateField,
  type Text,
} from "@codemirror/state";
import {
  Decoration,
  EditorView as CMView,
  drawSelection,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { tags as t } from "@lezer/highlight";
import { linter, lintGutter, type Diagnostic as CMDiagnostic } from "@codemirror/lint";
import {
  activeBlockRange,
  blockIndexAtLine,
  blockLineAt,
  blockLineMap,
  serializeDoc,
  topLevelPosOf,
  type LineRange,
} from "./source-map.js";
import {
  applySourceText,
  lintSource,
  type SourceDiagnostic,
  type SourceError,
} from "./source-sync.js";

export interface SourcePaneProps {
  /** The ProseMirror view: applies go through its dispatch. */
  view: EditorView | null;
  state: EditorState | null;
  registry: Registry;
  /** Frontmatter is linted against this collection's schema. */
  collection?: CollectionSpec;
  /** "Edit source": focus the pane on the first line of the block at `pos` (a new object per request). */
  reveal?: SourceReveal | null;
}

export interface SourceReveal {
  /** Position of the block to reveal (top-level or nested). */
  pos: number;
}

/** Live apply waits this long after the last keystroke (⌘/Ctrl-Enter applies now). */
export const SOURCE_APPLY_DELAY = 300;

// ---------------------------------------------------------------------------
// CodeMirror pieces, built once
// ---------------------------------------------------------------------------

/** Marks a pane change pushed from the canvas (never re-applied). */
const external = Annotation.define<boolean>();

const setActiveBlock = StateEffect.define<LineRange | null>();
const activeLine = Decoration.line({ class: "mdmx-source-active" });

/** Line decorations for the canvas's active block (the old `is-active` lines). */
const activeBlockField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setActiveBlock)) continue;
      const range = effect.value;
      if (!range) return Decoration.none;
      const lines = tr.state.doc.lines;
      const marks = [];
      for (let n = range.startLine + 1; n <= range.endLine + 1 && n <= lines; n++) {
        marks.push(activeLine.range(tr.state.doc.line(n).from));
      }
      return Decoration.set(marks);
    }
    return deco;
  },
  provide: (field) => CMView.decorations.from(field),
});

/** Token classes; colors live in the stylesheet (`--mdmx-code-*`) so themes follow the host. */
const highlight = HighlightStyle.define([
  { tag: t.heading, class: "mdmx-tok-heading" },
  { tag: [t.tagName, t.angleBracket], class: "mdmx-tok-tag" },
  { tag: [t.attributeName, t.propertyName], class: "mdmx-tok-attr" },
  { tag: [t.string, t.attributeValue], class: "mdmx-tok-string" },
  { tag: [t.keyword, t.bool, t.null, t.number], class: "mdmx-tok-keyword" },
  { tag: [t.comment, t.meta, t.processingInstruction], class: "mdmx-tok-meta" },
  { tag: [t.link, t.url], class: "mdmx-tok-link" },
  { tag: t.emphasis, class: "mdmx-tok-emphasis" },
  { tag: t.strong, class: "mdmx-tok-strong" },
  { tag: t.monospace, class: "mdmx-tok-code" },
]);

function toCMDiagnostics(doc: Text, diagnostics: SourceDiagnostic[]): CMDiagnostic[] {
  const clampLine = (n: number) => Math.min(Math.max(1, n), doc.lines);
  return diagnostics.map((d) => {
    const start = doc.line(clampLine(d.line));
    const end = doc.line(clampLine(d.endLine));
    const from = Math.min(start.from + Math.max(0, d.column - 1), start.to);
    let to = Math.min(end.from + Math.max(0, d.endColumn - 1), end.to);
    if (to < from) to = from;
    return {
      from,
      to,
      severity: d.severity,
      message: d.message,
      ...(d.code ? { source: d.code } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// The pane
// ---------------------------------------------------------------------------

/**
 * The source pane is an editor (ADR-059): CodeMirror over the canonical MDMX.
 * Canvas edits stream in as text; typed text applies to the canvas live
 * (debounced, only when it parses — a syntax error keeps the last applied
 * canvas and says so); while the pane is focused its text is authoritative,
 * and on blur it snaps to the canonical serialization once.
 */
export function SourcePane({ view, state, registry, collection, reveal }: SourcePaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<CMView | null>(null);
  const [error, setError] = useState<SourceError | null>(null);

  // Read at event time so the CM view is created once, not per state change.
  const latest = useRef({ view, state, registry, collection });
  latest.current = { view, state, registry, collection };
  const focused = useRef(false);
  /** The PM doc the pane produced last: that state must not be pushed back while typing. */
  const lastAppliedDoc = useRef<PMNode | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetEl = useRef<Element | null>(null);

  const clearTarget = useCallback(() => {
    targetEl.current?.classList.remove("mdmx-source-target");
    targetEl.current = null;
  }, []);

  /** The canvas block under the pane's cursor gets a marker and scrolls into view. */
  const pointCanvasAtCursor = useCallback(() => {
    const cm = cmRef.current;
    const pm = latest.current.view;
    if (!cm || !pm) return;
    const line = cm.state.doc.lineAt(cm.state.selection.main.head).number - 1;
    const index = blockIndexAtLine(blockLineMap(pm.state.doc, latest.current.registry), line);
    const dom = index === null ? null : (pm.nodeDOM(topLevelPosOf(pm.state.doc, index)) as Element | null);
    if (dom === targetEl.current) return;
    clearTarget();
    if (dom && dom.classList) {
      dom.classList.add("mdmx-source-target");
      targetEl.current = dom;
      if (typeof dom.scrollIntoView === "function") dom.scrollIntoView({ block: "nearest" });
    }
  }, [clearTarget]);

  /** Apply the pane text to the canvas now. False when it does not parse. */
  const applyNow = useCallback((): boolean => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const cm = cmRef.current;
    const pm = latest.current.view;
    if (!cm || !pm) return false;
    const text = cm.state.doc.toString();
    const line = cm.state.doc.lineAt(cm.state.selection.main.head).number - 1;
    const result = applySourceText(pm.state, text, latest.current.registry, line);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    if (result.tr) {
      lastAppliedDoc.current = result.tr.doc;
      pm.dispatch(result.tr);
    }
    return true;
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(applyNow, SOURCE_APPLY_DELAY);
  }, [applyNow]);

  /** Replace the pane text with the canonical serialization (marked external). */
  const pushCanonical = useCallback((doc: PMNode, selectionFrom: number) => {
    const cm = cmRef.current;
    if (!cm) return;
    const reg = latest.current.registry;
    let text: string;
    try {
      text = serializeDoc(doc, reg);
    } catch {
      return;
    }
    const current = cm.state.doc.toString();
    const range = activeBlockRange(doc, reg, selectionFrom);
    cm.dispatch({
      ...(current !== text ? { changes: { from: 0, to: current.length, insert: text } } : {}),
      effects: setActiveBlock.of(range),
      annotations: external.of(true),
    });
  }, []);

  // Create the CodeMirror view once per ProseMirror view (a new document) or registry.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !view) return;
    const initialDoc = latest.current.state?.doc ?? view.state.doc;
    let initial = "";
    try {
      initial = serializeDoc(initialDoc, registry);
    } catch {
      initial = "";
    }
    const cm = new CMView({
      parent: host,
      state: CMState.create({
        doc: initial,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          CMView.lineWrapping,
          markdown({ defaultCodeLanguage: javascript({ jsx: true }) }),
          syntaxHighlighting(highlight),
          activeBlockField,
          lintGutter(),
          linter(
            (v) =>
              toCMDiagnostics(
                v.state.doc,
                lintSource(v.state.doc.toString(), latest.current.registry, latest.current.collection),
              ),
            { delay: 400 },
          ),
          keymap.of([
            { key: "Mod-Enter", run: () => (applyNow(), true) },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          CMView.updateListener.of((update) => {
            const own = !update.transactions.some((tr) => tr.annotation(external));
            if (update.docChanged && own) schedule();
            if (update.selectionSet && own && focused.current) pointCanvasAtCursor();
          }),
          CMView.domEventHandlers({
            focus: () => {
              focused.current = true;
              pointCanvasAtCursor();
              return false;
            },
            blur: () => {
              focused.current = false;
              clearTarget();
              // Flush a pending apply; a clean text snaps to canonical (the
              // round-trip made visible, once). Broken text stays, with its
              // error, so a fix is still possible.
              const pm = latest.current.view;
              if (applyNow() && pm) pushCanonical(pm.state.doc, pm.state.selection.from);
              return false;
            },
          }),
        ],
      }),
    });
    cmRef.current = cm;
    const range = activeBlockRange(initialDoc, registry, latest.current.state?.selection.from ?? 0);
    cm.dispatch({ effects: setActiveBlock.of(range), annotations: external.of(true) });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      clearTarget();
      cm.destroy();
      cmRef.current = null;
    };
  }, [view, registry, applyNow, schedule, pointCanvasAtCursor, pushCanonical, clearTarget]);

  // Canvas → pane: every document/selection change that the pane did not
  // produce replaces the text with the canonical serialization and marks the
  // active block. The pane's own applies are skipped so the author's text
  // stays as typed until blur.
  useEffect(() => {
    if (!state || !cmRef.current) return;
    if (state.doc === lastAppliedDoc.current) return;
    pushCanonical(state.doc, state.selection.from);
  }, [state, pushCanonical]);

  // "Edit source": put the cursor on the block's first line and focus. The
  // block may be nested (a Tab inside Tabs): `blockLineAt` finds its line
  // inside the enclosing top-level block's range.
  useEffect(() => {
    const cm = cmRef.current;
    const pm = latest.current.view;
    if (!reveal || !cm || !pm) return;
    const reg = latest.current.registry;
    const range = activeBlockRange(pm.state.doc, reg, reveal.pos);
    const at = blockLineAt(pm.state.doc, reg, reveal.pos);
    if (at === null) {
      cm.focus();
      return;
    }
    const line = cm.state.doc.line(Math.min(at + 1, cm.state.doc.lines));
    cm.dispatch({
      selection: { anchor: line.from },
      effects: [setActiveBlock.of(range), CMView.scrollIntoView(line.from, { y: "center" })],
      annotations: external.of(true),
    });
    cm.focus();
  }, [reveal]);

  return (
    <aside className="mdmx-source" aria-label="Canonical MDMX source">
      <div className="mdmx-source-label">
        <span>source · MDMX</span>
        <span className="mdmx-source-hint">edits apply live · ⌘⏎ applies now</span>
      </div>
      <div className="mdmx-source-editor" ref={hostRef} />
      {error ? (
        <div className="mdmx-source-status is-error" role="status">
          Syntax error, line {error.line} — canvas shows the last applied version
          <span className="mdmx-source-status-detail">{error.message}</span>
        </div>
      ) : null}
    </aside>
  );
}
