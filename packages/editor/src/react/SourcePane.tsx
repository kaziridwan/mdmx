import { useMemo } from "react";
import type { EditorState } from "prosemirror-state";
import type { Registry } from "@imdx/core";
import { activeBlockRange, serializeDoc, type LineRange } from "./source-map.js";

export interface SourcePaneProps {
  state: EditorState | null;
  registry: Registry;
}

/**
 * The signature pane: live canonical iMDX on the right, the active block's lines
 * marked. Watching the round-trip happen is the product thesis (DESIGN_NOTES).
 */
export function SourcePane({ state, registry }: SourcePaneProps) {
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
    <aside className="imdx-source" aria-label="Canonical iMDX source">
      <div className="imdx-source-label">source · iMDX</div>
      <pre className="imdx-source-pre">
        <code>
          {lines.map((line, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={
                "imdx-source-line" +
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
