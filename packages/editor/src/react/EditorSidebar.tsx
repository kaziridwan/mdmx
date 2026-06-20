import type { MouseEvent as ReactMouseEvent } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { CollectionSpec, Registry } from "@imdx/core";
import { SourcePane } from "./SourcePane.js";
import { PropPanel } from "./PropPanel.js";
import { FrontmatterPanel } from "./FrontmatterPanel.js";
import { CodeIcon, SlidersIcon } from "./icons.js";

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
  /** Begin a drag-to-resize from the sidebar's left edge (desktop). */
  onResizeStart?: (e: ReactMouseEvent) => void;
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
  onResizeStart,
}: EditorSidebarProps) {
  return (
    <aside className="imdx-sidebar" aria-label="Editor sidebar">
      {onResizeStart ? (
        <div
          className="imdx-sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={onResizeStart}
        />
      ) : null}
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
