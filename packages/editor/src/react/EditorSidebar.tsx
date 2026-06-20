import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { CollectionSpec, Registry } from "@imdx/core";
import { SourcePane } from "./SourcePane.js";
import { PropPanel } from "./PropPanel.js";
import { FrontmatterPanel } from "./FrontmatterPanel.js";

export type SidebarMode = "source" | "properties";

export interface EditorSidebarProps {
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  view: EditorView | null;
  state: EditorState | null;
  registry: Registry;
  collection?: CollectionSpec;
  /** True when a component node is selected → properties shows the prop panel. */
  componentSelected: boolean;
}

/** Inline icons (no dependency) so the toggle reads at a glance. */
function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

/**
 * One right sidebar with two modes — the live canonical **Source** view and the
 * **Properties** editor (component prop panel, or the document frontmatter panel
 * when nothing is selected) — toggled from a header. Replaces the old two
 * always-on columns (which overlapped on narrower screens).
 */
export function EditorSidebar({
  mode,
  onModeChange,
  view,
  state,
  registry,
  collection,
  componentSelected,
}: EditorSidebarProps) {
  return (
    <aside className="imdx-sidebar" aria-label="Editor sidebar">
      <div className="imdx-sidebar-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="imdx-sidebar-tab"
          aria-selected={mode === "source"}
          aria-label="Source"
          onClick={() => onModeChange("source")}
        >
          <CodeIcon />
          <span>Source</span>
        </button>
        <button
          type="button"
          role="tab"
          className="imdx-sidebar-tab"
          aria-selected={mode === "properties"}
          aria-label="Properties"
          onClick={() => onModeChange("properties")}
        >
          <SlidersIcon />
          <span>Properties</span>
        </button>
      </div>
      <div className="imdx-sidebar-body">
        {mode === "source" ? (
          <SourcePane state={state} registry={registry} />
        ) : componentSelected ? (
          <PropPanel view={view} state={state} registry={registry} />
        ) : (
          <FrontmatterPanel view={view} state={state} collection={collection} />
        )}
      </div>
    </aside>
  );
}
