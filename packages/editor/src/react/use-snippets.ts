import { useCallback, useState } from "react";
import { NodeSelection, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { componentNodeName, componentNameFromNode } from "../schema.js";
import { listSnippets, saveSnippet, type Snippet } from "../snippets.js";

/** The `code` of a selected `<Html>` component node, or null. */
export function selectedHtmlCode(state: EditorState | null): string | null {
  if (!state) return null;
  const sel = state.selection;
  if (!(sel instanceof NodeSelection)) return null;
  if (componentNameFromNode(sel.node.type.name) !== "Html") return null;
  const code = (sel.node.attrs.props as Record<string, unknown> | undefined)?.code;
  return typeof code === "string" ? code : "";
}

export interface SnippetsHandle {
  /** Saved snippets for the rail. */
  snippets: Snippet[];
  /** Insert a saved snippet as an `<Html>` block carrying its HTML as `code`. */
  insertSnippet: (snippet: Snippet) => void;
  /** True while an `<Html>` block is selected (so it can be saved as a snippet). */
  canSave: boolean;
  /** The name being typed for a new snippet; null when not saving. */
  snippetName: string | null;
  setSnippetName: (name: string | null) => void;
  commitSnippet: () => void;
}

/** The "save as snippet" toolbar flow + the rail's snippet group (ADR-032). */
export function useSnippets(view: EditorView | null, state: EditorState | null): SnippetsHandle {
  const [snippets, setSnippets] = useState<Snippet[]>(() => listSnippets());
  const [snippetName, setSnippetName] = useState<string | null>(null);

  const insertSnippet = useCallback(
    (snippet: Snippet) => {
      if (!view) return;
      const type = view.state.schema.nodes[componentNodeName("Html")];
      const node = type?.createAndFill({ props: { code: snippet.html } });
      if (!node) return;
      view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
      view.focus();
    },
    [view],
  );

  const commitSnippet = useCallback(() => {
    if (snippetName == null) return;
    const code = selectedHtmlCode(view?.state ?? null);
    if (code != null) {
      saveSnippet(snippetName, code);
      setSnippets(listSnippets());
    }
    setSnippetName(null);
  }, [snippetName, view]);

  return {
    snippets,
    insertSnippet,
    canSave: selectedHtmlCode(state) != null,
    snippetName,
    setSnippetName,
    commitSnippet,
  };
}
