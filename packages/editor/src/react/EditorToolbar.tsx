import type { ReactNode } from "react";
import {
  FitIcon,
  MonitorIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SmartphoneIcon,
  TabletIcon,
} from "./icons.js";
import { DEVICE_WIDTHS, VIEWPORT_MODES, type ViewportMode } from "./viewport.js";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface EditorToolbarProps {
  backHref?: string;
  backLabel: string;
  docTitle?: string;
  viewport: ViewportMode;
  onViewportChange: (mode: ViewportMode) => void;
  /** Desktop panel toggles (ADR-051). */
  railCollapsed: boolean;
  sidebarCollapsed: boolean;
  onToggleRail: () => void;
  onToggleSidebar: () => void;
  /** Present when a media adapter is configured. */
  onInsertImage?: () => void;
  insertImageDisabled?: boolean;
  /** The "save as snippet" flow; `canSave` is true while an `<Html>` block is selected. */
  snippet: {
    canSave: boolean;
    name: string | null;
    onStart: () => void;
    onNameChange: (name: string) => void;
    onCommit: () => void;
    onCancel: () => void;
  };
  /** Present when the host supplied `onSave`. */
  save?: {
    status: SaveStatus;
    dirty: boolean;
    error: string | null;
    onSave: () => void;
  };
}

const VIEWPORT_ICONS: Record<ViewportMode, ReactNode> = {
  fit: <FitIcon size={14} />,
  mobile: <SmartphoneIcon size={14} />,
  tablet: <TabletIcon size={14} />,
  desktop: <MonitorIcon size={14} />,
};

function viewportTitle(mode: ViewportMode): string {
  if (mode === "fit") return "Fit to pane (real size)";
  const label = `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
  return `${label} preview (${DEVICE_WIDTHS[mode]}px)`;
}

function saveLabel(save: NonNullable<EditorToolbarProps["save"]>): string {
  if (save.status === "saving") return "Saving…";
  if (save.status === "saved" && !save.dirty) return "Saved";
  if (save.status === "error") return save.error ?? "Save failed";
  return save.dirty ? "Unsaved changes" : "";
}

/** The sticky bar above the canvas: navigation, preview mode, panel toggles, actions. */
export function EditorToolbar({
  backHref,
  backLabel,
  docTitle,
  viewport,
  onViewportChange,
  railCollapsed,
  sidebarCollapsed,
  onToggleRail,
  onToggleSidebar,
  onInsertImage,
  insertImageDisabled,
  snippet,
  save,
}: EditorToolbarProps) {
  return (
    <div className="mdmx-toolbar">
      <button
        type="button"
        className="mdmx-toolbar-panel"
        aria-label="Toggle components panel"
        aria-pressed={!railCollapsed}
        title={railCollapsed ? "Show components" : "Hide components"}
        onClick={onToggleRail}
      >
        <PanelLeftIcon size={14} />
      </button>
      {backHref ? (
        <a className="mdmx-toolbar-back" href={backHref}>
          ← {backLabel}
        </a>
      ) : null}
      <span className="mdmx-toolbar-title">{docTitle ?? "Untitled"}</span>
      <div className="mdmx-viewport-switch" role="group" aria-label="Preview viewport">
        {VIEWPORT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="mdmx-viewport-btn"
            title={viewportTitle(mode)}
            aria-label={`${mode} preview`}
            aria-pressed={viewport === mode}
            onClick={() => onViewportChange(mode)}
          >
            {VIEWPORT_ICONS[mode]}
          </button>
        ))}
      </div>
      {onInsertImage ? (
        <button
          type="button"
          className="mdmx-toolbar-image"
          onClick={onInsertImage}
          disabled={insertImageDisabled}
        >
          Insert image
        </button>
      ) : null}
      {snippet.canSave ? (
        snippet.name == null ? (
          <button type="button" className="mdmx-toolbar-snippet" onClick={snippet.onStart}>
            Save as snippet
          </button>
        ) : (
          <span className="mdmx-snippet-save">
            <input
              className="mdmx-snippet-input"
              type="text"
              autoFocus
              placeholder="Snippet name"
              aria-label="Snippet name"
              value={snippet.name}
              onChange={(e) => snippet.onNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") snippet.onCommit();
                if (e.key === "Escape") snippet.onCancel();
              }}
            />
            <button
              type="button"
              className="mdmx-snippet-confirm"
              onClick={snippet.onCommit}
              disabled={snippet.name.trim() === ""}
            >
              Save
            </button>
          </span>
        )
      ) : null}
      {save ? (
        <>
          <span className="mdmx-toolbar-status" data-status={save.status}>
            {saveLabel(save)}
          </span>
          <button
            type="button"
            className="mdmx-toolbar-save"
            onClick={save.onSave}
            disabled={save.status === "saving" || (!save.dirty && save.status !== "error")}
          >
            Save
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="mdmx-toolbar-panel"
        aria-label="Toggle sidebar"
        aria-pressed={!sidebarCollapsed}
        title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        onClick={onToggleSidebar}
      >
        <PanelRightIcon size={14} />
      </button>
    </div>
  );
}
