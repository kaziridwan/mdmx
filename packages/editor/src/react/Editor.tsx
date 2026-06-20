import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { EditorState, NodeSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { NodeViewConstructor } from "prosemirror-view";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { parseMDX, type CollectionSpec, type Registry } from "@imdx/core";
import { buildSchema, componentNodeName, componentNameFromNode } from "../schema.js";
import { imdxInputRules, initialProps, resolveComponentDrop } from "../commands.js";
import { fromMdast } from "../from-mdast.js";
import { createReactNodeView } from "./react-node-view.js";
import { makeComponentBlock } from "./ComponentBlock.js";
import { slashPlugin } from "./slash-plugin.js";
import { Rail, IMDX_DRAG_MIME } from "./Rail.js";
import { EditorSidebar, type SidebarMode } from "./EditorSidebar.js";
import {
  DEFAULT_SIDEBAR_WIDTH,
  clampSidebarWidth,
  readStoredWidth,
  storeSidebarWidth,
} from "./sidebar-resize.js";
import { SlashMenu } from "./SlashMenu.js";
import { CodeIcon, SlidersIcon, LayersIcon } from "./icons.js";
import { MediaLibrary } from "./MediaLibrary.js";
import { insertImage, type MediaItem, type MediaSource } from "./media.js";
import { MediaPickerContext, type RequestMedia } from "./media-context.js";
import { listSnippets, saveSnippet, type Snippet } from "../snippets.js";
import { serializeDoc } from "./source-map.js";

/** Map of component name → the author's React component, for live rendering. */
export type ComponentMap = Record<string, ComponentType<any>>;

export interface IMDXEditorProps {
  registry: Registry;
  /** Author components keyed by registry name; missing → placeholder render. */
  components?: ComponentMap;
  /** Initial document as iMDX source (parsed + converted on mount). */
  source?: string;
  /** Collection schema for this document; enables the frontmatter panel. */
  collection?: CollectionSpec;
  /**
   * Persist the document. Receives the current canonical iMDX. When provided, a
   * save toolbar appears. Reject the promise to surface an error in the toolbar.
   */
  onSave?: (source: string) => void | Promise<void>;
  /** Label shown in the toolbar (e.g. the file path). */
  docTitle?: string;
  /**
   * Media storage adapter. When provided, an "Insert image" toolbar button
   * opens the media library; the picked asset is inserted as an image node.
   */
  media?: MediaSource;
  /** Media directory uploads are written under (default: `public/media`). */
  mediaDir?: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function buildNodeViews(
  registry: Registry,
  components: ComponentMap | undefined,
): Record<string, NodeViewConstructor> {
  const nv: Record<string, NodeViewConstructor> = {};
  for (const spec of registry.components) {
    nv[componentNodeName(spec.name)] = createReactNodeView(
      makeComponentBlock(spec, components?.[spec.name]),
      { hasContent: spec.children.policy !== "none" },
    );
  }
  return nv;
}

function isComponentSelected(state: EditorState | null, registry: Registry): boolean {
  if (!state) return false;
  const sel = state.selection;
  if (!(sel instanceof NodeSelection)) return false;
  const name = componentNameFromNode(sel.node.type.name);
  return name != null && registry.get(name) != null;
}

/** The `code` of a selected `<Html>` component node, or null. */
function selectedHtmlCode(state: EditorState | null): string | null {
  if (!state) return null;
  const sel = state.selection;
  if (!(sel instanceof NodeSelection)) return null;
  if (componentNameFromNode(sel.node.type.name) !== "Html") return null;
  const code = (sel.node.attrs.props as Record<string, unknown> | undefined)?.code;
  return typeof code === "string" ? code : "";
}

export function IMDXEditor({
  registry,
  components,
  source,
  collection,
  onSave,
  docTitle,
  media,
  mediaDir = "public/media",
}: IMDXEditorProps) {
  const schema = useMemo(() => buildSchema(registry), [registry]);
  const mountRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  // The callback awaiting a media pick; non-null ⇒ the library modal is open.
  const [mediaPick, setMediaPick] = useState<((item: MediaItem) => void) | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("source");
  const [snippets, setSnippets] = useState<Snippet[]>(() => listSnippets());
  const [snippetName, setSnippetName] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(
    () => readStoredWidth() ?? DEFAULT_SIDEBAR_WIDTH,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  // Mobile: which off-canvas sheet is open (desktop ignores this; FABs are
  // hidden by CSS and the rail/sidebar are normal columns).
  const [mobilePanel, setMobilePanel] = useState<"palette" | "sidebar" | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const doc =
      source != null
        ? fromMdast(parseMDX(source), { schema, registry, source })
        : undefined;

    const initial = EditorState.create({
      schema,
      doc,
      plugins: [
        history(),
        keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
        imdxInputRules(schema),
        keymap(baseKeymap),
        dropCursor({ class: "imdx-dropcursor", width: 2 }),
        gapCursor(),
        slashPlugin(),
      ],
    });

    const editorView = new EditorView(mount, {
      state: initial,
      nodeViews: buildNodeViews(registry, components),
      dispatchTransaction(tr) {
        const next = editorView.state.apply(tr);
        editorView.updateState(next);
        setState(next);
        if (tr.docChanged) {
          setDirty(true);
          setSaveStatus("idle");
        }
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false; // internal block move: let ProseMirror handle it
        const name = (event as DragEvent).dataTransfer?.getData(IMDX_DRAG_MIME);
        if (!name) return false;
        const spec = registry.get(name);
        const type = view.state.schema.nodes[componentNodeName(name)];
        if (!spec || !type) return false;
        const coords = view.posAtCoords({
          left: (event as DragEvent).clientX,
          top: (event as DragEvent).clientY,
        });
        if (!coords) return false;
        const node = type.createAndFill({ props: initialProps(spec) });
        if (!node) return false;
        // Resolve the drop into the deepest valid container (e.g. inside a
        // Column); reject it if the schema or `allowedParents` forbids it there.
        const at = resolveComponentDrop(registry, view.state.schema, view.state.doc, coords.pos, name);
        if (at == null) return false;
        view.dispatch(view.state.tr.insert(at, node).scrollIntoView());
        return true;
      },
    });

    setView(editorView);
    setState(editorView.state);
    setDirty(false);
    setSaveStatus("idle");
    setSaveError(null);
    return () => {
      editorView.destroy();
      setView(null);
      setState(null);
    };
  }, [schema, registry, components, source]);

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
  const startResize = useCallback((e: ReactMouseEvent) => {
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
      document.body.classList.remove("imdx-resizing");
      storeSidebarWidth(latest);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.classList.add("imdx-resizing");
  }, [sidebarWidth]);

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

  // Insert a saved snippet as an <Html> block carrying its HTML as `code`.
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

  const htmlCode = selectedHtmlCode(state);
  const commitSnippet = useCallback(() => {
    if (snippetName == null) return;
    const code = selectedHtmlCode(view?.state ?? null);
    if (code != null) {
      saveSnippet(snippetName, code);
      setSnippets(listSnippets());
    }
    setSnippetName(null);
  }, [snippetName, view]);

  const showToolbar = onSave != null || media != null || htmlCode != null;

  return (
    <MediaPickerContext.Provider value={media ? requestMedia : null}>
    <div
      className={
        "imdx-editor" +
        (mobilePanel === "palette" ? " is-palette-open" : "") +
        (mobilePanel === "sidebar" ? " is-sidebar-open" : "")
      }
      ref={rootRef}
      style={{ ["--imdx-sidebar-width"]: `${sidebarWidth}px` } as CSSProperties}
    >
      <Rail
        registry={registry}
        schema={schema}
        view={view}
        onAfterInsert={() => setMobilePanel(null)}
        snippets={snippets}
        onInsertSnippet={insertSnippet}
      />
      <div className="imdx-canvas-wrap">
        {showToolbar ? (
          <div className="imdx-toolbar">
            <span className="imdx-toolbar-title">{docTitle ?? "Untitled"}</span>
            {media ? (
              <button
                type="button"
                className="imdx-toolbar-image"
                onClick={() => requestMedia(insertPickedImage)}
                disabled={!view}
              >
                Insert image
              </button>
            ) : null}
            {htmlCode != null ? (
              snippetName == null ? (
                <button
                  type="button"
                  className="imdx-toolbar-snippet"
                  onClick={() => setSnippetName("")}
                >
                  Save as snippet
                </button>
              ) : (
                <span className="imdx-snippet-save">
                  <input
                    className="imdx-snippet-input"
                    type="text"
                    autoFocus
                    placeholder="Snippet name"
                    aria-label="Snippet name"
                    value={snippetName}
                    onChange={(e) => setSnippetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSnippet();
                      if (e.key === "Escape") setSnippetName(null);
                    }}
                  />
                  <button
                    type="button"
                    className="imdx-snippet-confirm"
                    onClick={commitSnippet}
                    disabled={snippetName.trim() === ""}
                  >
                    Save
                  </button>
                </span>
              )
            ) : null}
            {onSave ? (
              <>
                <span className="imdx-toolbar-status" data-status={saveStatus}>
                  {saveStatus === "saving"
                    ? "Saving…"
                    : saveStatus === "saved" && !dirty
                      ? "Saved"
                      : saveStatus === "error"
                        ? (saveError ?? "Save failed")
                        : dirty
                          ? "Unsaved changes"
                          : ""}
                </span>
                <button
                  type="button"
                  className="imdx-toolbar-save"
                  onClick={handleSave}
                  disabled={saveStatus === "saving" || (!dirty && saveStatus !== "error")}
                >
                  Save
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="imdx-canvas" ref={mountRef} />
        {view && state ? <SlashMenu view={view} state={state} registry={registry} schema={schema} /> : null}
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

      {/* Mobile-only floating controls (hidden on desktop via CSS). */}
      <div className="imdx-mobile-fabs imdx-fabs-left">
        <button
          type="button"
          className="imdx-fab"
          aria-label="Open components"
          onClick={() => setMobilePanel((p) => (p === "palette" ? null : "palette"))}
        >
          <LayersIcon size={20} />
        </button>
      </div>
      <div className="imdx-mobile-fabs imdx-fabs-right">
        <button
          type="button"
          className="imdx-fab"
          aria-label="Open source"
          onClick={() => {
            setSidebarMode("source");
            setMobilePanel("sidebar");
          }}
        >
          <CodeIcon size={20} />
        </button>
        <button
          type="button"
          className="imdx-fab"
          aria-label="Open properties"
          onClick={() => {
            setSidebarMode("properties");
            setMobilePanel("sidebar");
          }}
        >
          <SlidersIcon size={20} />
        </button>
      </div>
      {mobilePanel ? (
        <div
          className="imdx-mobile-backdrop"
          aria-hidden="true"
          onClick={() => setMobilePanel(null)}
        />
      ) : null}
    </div>
    </MediaPickerContext.Provider>
  );
}
