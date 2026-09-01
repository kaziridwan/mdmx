import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { NodeSelection, Selection, type EditorState } from "prosemirror-state";
import type { CollectionSpec, Registry } from "@mdmx/core";
import { buildSchema, componentNameFromNode } from "../schema.js";
import { Rail } from "./Rail.js";
import { EditorSidebar, type SidebarMode } from "./EditorSidebar.js";
import { EditorToolbar, type SaveStatus } from "./EditorToolbar.js";
import { MobileFabs } from "./MobileFabs.js";
import { SlashMenu } from "./SlashMenu.js";
import { MediaLibrary } from "./MediaLibrary.js";
import { insertImage, type MediaItem, type MediaSource } from "./media.js";
import { MediaPickerContext, type RequestMedia } from "./media-context.js";
import { serializeDoc } from "./source-map.js";
import { useEditorView, type ComponentMap } from "./use-editor-view.js";
import { useViewport } from "./use-viewport.js";
import { useSnippets } from "./use-snippets.js";
import { readStoredCollapsed, storeCollapsed, type PanelSide } from "./panels.js";
import {
  DEFAULT_SIDEBAR_WIDTH,
  clampSidebarWidth,
  readStoredWidth,
  storeSidebarWidth,
} from "./sidebar-resize.js";

export type { ComponentMap } from "./use-editor-view.js";

/** The content class the canvas carries when the host names none (ADR-050). */
export const DEFAULT_CONTENT_CLASS = "mdmx-page";

export interface MDMXEditorProps {
  registry: Registry;
  /** Author components keyed by registry name; missing → placeholder render. */
  components?: ComponentMap;
  /** Initial document as MDMX source (parsed + converted on mount). */
  source?: string;
  /** Collection schema for this document; enables the frontmatter panel. */
  collection?: CollectionSpec;
  /**
   * Persist the document. Receives the current canonical MDMX. When provided, a
   * save toolbar appears. Reject the promise to surface an error in the toolbar.
   */
  onSave?: (source: string) => void | Promise<void>;
  /** Label shown in the toolbar (e.g. the file path). */
  docTitle?: string;
  /** When set, a back link renders at the start of the toolbar. */
  backHref?: string;
  /** Text for the back link (default: "Back"). */
  backLabel?: string;
  /**
   * Media storage adapter. When provided, an "Insert image" toolbar button
   * opens the media library; the picked asset is inserted as an image node.
   */
  media?: MediaSource;
  /** Media directory uploads are written under (default: `public/media`). */
  mediaDir?: string;
  /**
   * Class placed on the canvas content root — the same class the site puts on
   * its article wrapper — so the site's own content styles apply in the
   * editor (ADR-050). Default `mdmx-page`; pass `""` to opt out.
   */
  contentClassName?: string;
}

function isComponentSelected(state: EditorState | null, registry: Registry): boolean {
  if (!state) return false;
  const sel = state.selection;
  if (!(sel instanceof NodeSelection)) return false;
  const name = componentNameFromNode(sel.node.type.name);
  return name != null && registry.get(name) != null;
}

function usePanelCollapsed(side: PanelSide): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readStoredCollapsed(side) ?? false);
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      storeCollapsed(side, !current);
      return !current;
    });
  }, [side]);
  return [collapsed, toggle];
}

export function MDMXEditor({
  registry,
  components,
  source,
  collection,
  onSave,
  docTitle,
  backHref,
  backLabel = "Back",
  media,
  mediaDir = "public/media",
  contentClassName = DEFAULT_CONTENT_CLASS,
}: MDMXEditorProps) {
  const schema = useMemo(() => buildSchema(registry), [registry]);
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const { view, state } = useEditorView({
    mountRef,
    schema,
    registry,
    components,
    source,
    contentClassName,
    media,
    mediaDir,
    collection,
    onDocChanged: () => {
      setDirty(true);
      setSaveStatus("idle");
    },
  });

  // A fresh view is a clean document.
  useEffect(() => {
    setDirty(false);
    setSaveStatus("idle");
    setSaveError(null);
  }, [view]);

  // The callback awaiting a media pick; non-null ⇒ the library modal is open.
  const [mediaPick, setMediaPick] = useState<((item: MediaItem) => void) | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("source");
  const [sidebarWidth, setSidebarWidth] = useState<number>(
    () => readStoredWidth() ?? DEFAULT_SIDEBAR_WIDTH,
  );
  // Desktop: collapsible rail/sidebar (ADR-051). Mobile: which off-canvas
  // sheet is open (desktop ignores this; FABs are hidden by CSS).
  const [railCollapsed, toggleRail] = usePanelCollapsed("rail");
  const [sidebarCollapsed, toggleSidebar] = usePanelCollapsed("sidebar");
  const [mobilePanel, setMobilePanel] = useState<"palette" | "sidebar" | null>(null);

  const { viewport, selectViewport, canvasStyle } = useViewport(wrapRef);
  const snippets = useSnippets(view, state);

  const handleSave = useCallback(async () => {
    if (!view || !onSave) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await onSave(serializeDoc(view.state.doc, registry));
      setDirty(false);
      setSaveStatus("saved");
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [view, onSave, registry]);

  // Drag the sidebar's left edge: width = distance from the editor's right edge
  // to the cursor, clamped, persisted on release.
  const startResize = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const root = rootRef.current;
      if (!root) return;
      let latest = sidebarWidth;
      const onMove = (ev: MouseEvent) => {
        const rect = root.getBoundingClientRect();
        latest = clampSidebarWidth(rect.right - ev.clientX);
        setSidebarWidth(latest);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.classList.remove("mdmx-resizing");
        storeSidebarWidth(latest);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      document.body.classList.add("mdmx-resizing");
    },
    [sidebarWidth],
  );

  // Open the library, remembering who asked so its pick is routed back to them.
  const requestMedia = useCallback<RequestMedia>((onPick) => {
    setMediaPick(() => onPick);
  }, []);

  const insertPickedImage = useCallback(
    (item: MediaItem) => {
      if (view) {
        insertImage(view, { src: item.url, alt: "" });
        view.focus();
      }
    },
    [view],
  );

  // Clicking the canvas padding below (or above) the content lands on the mount
  // element itself, never on the ProseMirror editable child, so ProseMirror's
  // own click handling never fires — the cursor appears to "vanish". Place it at
  // the document edge instead. If the document ends in a non-textblock component
  // (an atom block you can't type into), append a trailing paragraph so there's
  // somewhere to put the caret.
  const handleCanvasPointerDown = useCallback(
    (e: ReactMouseEvent) => {
      if (!view || e.target !== mountRef.current) return;
      const editable = view.dom as HTMLElement;
      const rect = editable.getBoundingClientRect();
      const below = e.clientY >= rect.bottom;
      const above = e.clientY <= rect.top;
      if (!below && !above) return; // side padding: leave default behavior
      e.preventDefault();
      const { state } = view;
      if (below) {
        const last = state.doc.lastChild;
        if (last && !last.isTextblock) {
          const paragraph = state.schema.nodes.paragraph?.createAndFill();
          if (paragraph) {
            const tr = state.tr.insert(state.doc.content.size, paragraph);
            tr.setSelection(Selection.atEnd(tr.doc)).scrollIntoView();
            view.dispatch(tr);
          }
        } else {
          view.dispatch(state.tr.setSelection(Selection.atEnd(state.doc)).scrollIntoView());
        }
      } else {
        view.dispatch(state.tr.setSelection(Selection.atStart(state.doc)).scrollIntoView());
      }
      view.focus();
    },
    [view],
  );

  const rootClass =
    "mdmx-editor" +
    (railCollapsed ? " is-rail-collapsed" : "") +
    (sidebarCollapsed ? " is-sidebar-collapsed" : "") +
    (mobilePanel === "palette" ? " is-palette-open" : "") +
    (mobilePanel === "sidebar" ? " is-sidebar-open" : "");

  return (
    <MediaPickerContext.Provider value={media ? requestMedia : null}>
      <div
        className={rootClass}
        ref={rootRef}
        style={{ ["--mdmx-sidebar-width"]: `${sidebarWidth}px` } as CSSProperties}
      >
        <Rail
          registry={registry}
          schema={schema}
          view={view}
          onAfterInsert={() => setMobilePanel(null)}
          snippets={snippets.snippets}
          onInsertSnippet={snippets.insertSnippet}
        />
        <div className="mdmx-canvas-wrap" ref={wrapRef}>
          <EditorToolbar
            backHref={backHref}
            backLabel={backLabel}
            docTitle={docTitle}
            viewport={viewport}
            onViewportChange={selectViewport}
            railCollapsed={railCollapsed}
            sidebarCollapsed={sidebarCollapsed}
            onToggleRail={toggleRail}
            onToggleSidebar={toggleSidebar}
            onInsertImage={media ? () => requestMedia(insertPickedImage) : undefined}
            insertImageDisabled={!view}
            snippet={{
              canSave: snippets.canSave,
              name: snippets.snippetName,
              onStart: () => snippets.setSnippetName(""),
              onNameChange: snippets.setSnippetName,
              onCommit: snippets.commitSnippet,
              onCancel: () => snippets.setSnippetName(null),
            }}
            save={
              onSave
                ? { status: saveStatus, dirty, error: saveError, onSave: handleSave }
                : undefined
            }
          />
          <div
            className="mdmx-canvas"
            ref={mountRef}
            onMouseDown={handleCanvasPointerDown}
            data-viewport={viewport}
            style={canvasStyle}
          />
          {view && state ? (
            <SlashMenu view={view} state={state} registry={registry} schema={schema} />
          ) : null}
          {media && mediaPick ? (
            <MediaLibrary
              media={media}
              mediaDir={mediaDir}
              onPick={(item) => {
                mediaPick(item);
                setMediaPick(null);
              }}
              onClose={() => setMediaPick(null)}
            />
          ) : null}
        </div>
        <EditorSidebar
          mode={sidebarMode}
          onModeChange={setSidebarMode}
          view={view}
          state={state}
          registry={registry}
          collection={collection}
          componentSelected={isComponentSelected(state, registry)}
          onResizeStart={startResize}
        />
        <MobileFabs
          onOpenPalette={() => setMobilePanel((p) => (p === "palette" ? null : "palette"))}
          onOpenSource={() => {
            setSidebarMode("source");
            setMobilePanel("sidebar");
          }}
          onOpenProperties={() => {
            setSidebarMode("properties");
            setMobilePanel("sidebar");
          }}
        />
        {mobilePanel ? (
          <div
            className="mdmx-mobile-backdrop"
            aria-hidden="true"
            onClick={() => setMobilePanel(null)}
          />
        ) : null}
      </div>
    </MediaPickerContext.Provider>
  );
}
