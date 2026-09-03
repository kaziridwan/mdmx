import { useEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import type { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView, type NodeViewConstructor } from "prosemirror-view";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { parseMDX, type CollectionSpec, type Registry } from "@mdmx/core";
import { componentNodeName } from "../schema.js";
import {
  blockActionKeymap,
  buildComponentNode,
  markKeymap,
  mdmxInputRules,
  resolveComponentDrop,
} from "../commands.js";
import { fromMdast } from "../from-mdast.js";
import { createReactNodeView } from "./react-node-view.js";
import { makeComponentBlock } from "./ComponentBlock.js";
import { slashPlugin } from "./slash-plugin.js";
import { MDMX_DRAG_MIME } from "./Rail.js";
import { insertImage, imageFromClipboard, pastedImageUpload, type MediaSource } from "./media.js";
import { linkClickAction } from "./link-policy.js";

/** Map of component name → the author's React component, for live rendering. */
export type ComponentMap = Record<string, ComponentType<any>>;

export interface UseEditorViewOptions {
  /** The canvas element the ProseMirror view mounts into. */
  mountRef: RefObject<HTMLDivElement | null>;
  schema: Schema;
  registry: Registry;
  components?: ComponentMap;
  /** Initial document as MDMX source (parsed + converted on mount). */
  source?: string;
  /**
   * Class placed on the ProseMirror root beside `ProseMirror` — the host's
   * content class, so the site's own content styles apply in the canvas
   * (ADR-050). Empty string for none.
   */
  contentClassName: string;
  /** Media config, read at paste time; changing it must not rebuild the view. */
  media?: MediaSource;
  mediaDir: string;
  collection?: CollectionSpec;
  /** Fired after every transaction that changed the document. */
  onDocChanged?: () => void;
}

export interface EditorViewHandle {
  view: EditorView | null;
  state: EditorState | null;
}

function buildNodeViews(
  registry: Registry,
  components: ComponentMap | undefined,
): Record<string, NodeViewConstructor> {
  const nv: Record<string, NodeViewConstructor> = {};
  for (const spec of registry.components) {
    nv[componentNodeName(spec.name)] = createReactNodeView(
      makeComponentBlock(spec, components?.[spec.name]),
      { hasContent: spec.children.policy !== "none", interactive: spec.render?.interactive },
    );
  }
  return nv;
}

/**
 * Own the ProseMirror `EditorView`: plugins, per-component NodeViews, the
 * paste-image and drag-from-rail handlers. The view is (re)created when the
 * schema, registry, components, source, or content class change; everything
 * else is read through a ref at event time.
 */
export function useEditorView(options: UseEditorViewOptions): EditorViewHandle {
  const { mountRef, schema, registry, components, source, contentClassName } = options;
  const [view, setView] = useState<EditorView | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const doc =
      source != null ? fromMdast(parseMDX(source), { schema, registry, source }) : undefined;

    const initial = EditorState.create({
      schema,
      doc,
      plugins: [
        history(),
        keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
        // Mark shortcuts (Mod-B / Mod-I / Mod-E / Mod-Shift-X).
        keymap(markKeymap(schema)),
        // Block actions on the contextual component (ADR-058).
        keymap(blockActionKeymap(registry)),
        mdmxInputRules(schema),
        keymap(baseKeymap),
        dropCursor({ class: "mdmx-dropcursor", width: 2 }),
        gapCursor(),
        slashPlugin(),
      ],
    });

    const editorView = new EditorView(mount, {
      state: initial,
      attributes: contentClassName ? { class: contentClassName } : undefined,
      nodeViews: buildNodeViews(registry, components),
      handleDOMEvents: {
        // Links never navigate in the canvas; ⌘/Ctrl-click opens a new tab.
        // Runs before NodeView routing, so it covers links inside components
        // (with `preventDefault`, ProseMirror then leaves the event alone).
        click(view, event) {
          const link = linkClickAction(event, view.dom as HTMLElement);
          if (!link) return false;
          event.preventDefault();
          if (link.action === "open") {
            window.open(link.anchor.href, "_blank", "noopener,noreferrer");
          }
          return true;
        },
      },
      dispatchTransaction(tr) {
        const next = editorView.state.apply(tr);
        editorView.updateState(next);
        setState(next);
        if (tr.docChanged) latest.current.onDocChanged?.();
      },
      handlePaste(view, event) {
        const adapter = latest.current.media;
        const data = (event as ClipboardEvent).clipboardData;
        if (!adapter || !data) return false;
        const file = imageFromClipboard(data);
        if (!file) return false;
        // We own this paste: stop the browser from also inserting a data-URL.
        event.preventDefault();
        const collectionName = latest.current.collection?.name;
        void (async () => {
          try {
            const upload = await pastedImageUpload(file, latest.current.mediaDir, collectionName);
            const item = await adapter.upload(upload);
            insertImage(view, { src: item.url, alt: "" });
            view.focus();
          } catch (err) {
            console.error("mdmx: pasted image upload failed", err);
          }
        })();
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false; // internal block move: let ProseMirror handle it
        const name = (event as DragEvent).dataTransfer?.getData(MDMX_DRAG_MIME);
        if (!name) return false;
        if (!registry.has(name) || !view.state.schema.nodes[componentNodeName(name)]) return false;
        const coords = view.posAtCoords({
          left: (event as DragEvent).clientX,
          top: (event as DragEvent).clientY,
        });
        if (!coords) return false;
        // Same seeding as a palette insert: defaults + preview, children text,
        // container subtrees — a dropped block must never land emptier.
        const node = buildComponentNode(registry, view.state.schema, name);
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
    return () => {
      editorView.destroy();
      setView(null);
      setState(null);
    };
  }, [mountRef, schema, registry, components, source, contentClassName]);

  return { view, state };
}
