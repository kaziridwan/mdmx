import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
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
import { SourcePane } from "./SourcePane.js";
import { PropPanel } from "./PropPanel.js";
import { FrontmatterPanel } from "./FrontmatterPanel.js";
import { SlashMenu } from "./SlashMenu.js";
import { MediaLibrary } from "./MediaLibrary.js";
import { insertImage, type MediaItem, type MediaSource } from "./media.js";
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
  const [mediaOpen, setMediaOpen] = useState(false);

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

  const handlePickMedia = useCallback(
    (item: MediaItem) => {
      setMediaOpen(false);
      if (view) {
        insertImage(view, { src: item.url, alt: "" });
        view.focus();
      }
    },
    [view],
  );

  const showToolbar = onSave != null || media != null;

  return (
    <div className="imdx-editor">
      <Rail registry={registry} schema={schema} view={view} />
      <div className="imdx-canvas-wrap">
        {showToolbar ? (
          <div className="imdx-toolbar">
            <span className="imdx-toolbar-title">{docTitle ?? "Untitled"}</span>
            {media ? (
              <button
                type="button"
                className="imdx-toolbar-image"
                onClick={() => setMediaOpen(true)}
                disabled={!view}
              >
                Insert image
              </button>
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
        {media && mediaOpen ? (
          <MediaLibrary
            media={media}
            mediaDir={mediaDir}
            onPick={handlePickMedia}
            onClose={() => setMediaOpen(false)}
          />
        ) : null}
      </div>
      <SourcePane state={state} registry={registry} />
      {isComponentSelected(state, registry) ? (
        <PropPanel view={view} state={state} registry={registry} />
      ) : (
        <FrontmatterPanel view={view} state={state} collection={collection} />
      )}
    </div>
  );
}
