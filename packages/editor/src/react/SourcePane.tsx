import { useEffect, useMemo, useRef } from "react";
import type { EditorState } from "prosemirror-state";
import type { Registry } from "@mdmx/core";
import { activeBlockRange, serializeDoc, type LineRange } from "./source-map.js";

export interface SourcePaneProps {
  state: EditorState | null;
  registry: Registry;
  /** Bumped by "edit source": scroll the active block's lines into view. */
  reveal?: number;
}

/**
 * The signature pane: live canonical MDMX on the right, the active block's lines
 * marked. Watching the round-trip happen is the product thesis (DESIGN_NOTES).
 */
export function SourcePane({ state, registry, reveal }: SourcePaneProps) {
  const preRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (!reveal) return;
    const line = preRef.current?.querySelector<HTMLElement>(".mdmx-source-line.is-active");
    if (line && typeof line.scrollIntoView === "function") {
      line.scrollIntoView({ block: "center" });
    }
  }, [reveal]);

  const { text, range } = useMemo((): { text: string; range: LineRange | null } => {
    if (!state) return { text: "", range: null };
    try {
      return {
        text: serializeDoc(state.doc, registry),
        range: activeBlockRange(state.doc, registry, state.selection.from),
      };
    } catch {
      return { text: "/* serialization error */", range: null };
    }
  }, [state, registry]);

  const lines = text.split("\n");

  return (
    <aside className="mdmx-source" aria-label="Canonical MDMX source">
      <div className="mdmx-source-label">source · MDMX</div>
      <pre className="mdmx-source-pre" ref={preRef}>
        <code>
          {lines.map((line, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={
                "mdmx-source-line" +
                (range && i >= range.startLine && i <= range.endLine ? " is-active" : "")
              }
            >
              {line === "" ? " " : line}
            </div>
          ))}
        </code>
      </pre>
    </aside>
  );
}
