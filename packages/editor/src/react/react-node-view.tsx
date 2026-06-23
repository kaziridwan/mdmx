import { createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Node as PMNode } from "prosemirror-model";
import type {
  EditorView,
  NodeView,
  NodeViewConstructor,
} from "prosemirror-view";

/**
 * Props handed to a React component rendered as a ProseMirror NodeView.
 *
 * `contentRef` is the crux of nesting: a content-bearing node must place
 * ProseMirror's editable `contentDOM` somewhere in its rendered output. The
 * React component renders an element with this ref where the children belong;
 * the adapter moves the PM-managed `contentDOM` into it. This is the piece
 * TipTap's `ReactNodeViewRenderer` would otherwise provide.
 */
export interface NodeViewComponentProps {
  node: PMNode;
  view: EditorView;
  getPos: () => number | undefined;
  selected: boolean;
  /** Mount point for ProseMirror's editable content; null for leaf/atom nodes. */
  contentRef: (el: HTMLElement | null) => void;
}

export type NodeViewComponent = ComponentType<NodeViewComponentProps>;

export interface CreateNodeViewOptions {
  /** Whether the node has editable children (needs a contentDOM hole). */
  hasContent: boolean;
}

/**
 * Mount a React component as a ProseMirror NodeView. One React root per node.
 * Core blocks (paragraph, heading, …) keep ProseMirror's plain-DOM rendering;
 * only registered components pay the React cost — see ADR-023.
 */
class ReactNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  private root: Root;
  private node: PMNode;
  private selected = false;

  constructor(
    node: PMNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly Component: NodeViewComponent,
    hasContent: boolean,
  ) {
    this.node = node;
    this.dom = document.createElement("div");
    this.dom.className = "mdmx-nodeview";
    if (hasContent) {
      this.contentDOM = document.createElement("div");
      this.contentDOM.className = "mdmx-contentdom";
    }
    this.root = createRoot(this.dom);
    this.renderReact();
  }

  /** Re-attach the PM-managed contentDOM wherever React placed the hole. */
  private contentRef = (el: HTMLElement | null) => {
    if (el && this.contentDOM && this.contentDOM.parentElement !== el) {
      el.appendChild(this.contentDOM);
    }
  };

  private renderReact() {
    this.root.render(
      createElement(this.Component, {
        node: this.node,
        view: this.view,
        getPos: this.getPos,
        selected: this.selected,
        contentRef: this.contentRef,
      }),
    );
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderReact();
    return true;
  }

  selectNode() {
    this.selected = true;
    this.dom.classList.add("mdmx-selected");
    this.renderReact();
  }

  deselectNode() {
    this.selected = false;
    this.dom.classList.remove("mdmx-selected");
    this.renderReact();
  }

  /**
   * ProseMirror observes DOM mutations to detect external edits. React owns the
   * chrome and the contentDOM hole's placement, so ignore everything except
   * mutations inside the contentDOM (which PM itself manages).
   */
  ignoreMutation(mutation: MutationRecord | { type: "selection"; target: Node }): boolean {
    if (!this.contentDOM) return true;
    if (mutation.type === "selection") return false;
    return !this.contentDOM.contains(mutation.target);
  }

  destroy() {
    // React 18 forbids unmounting synchronously during a render/commit, which
    // is exactly when ProseMirror tears down NodeViews. Defer to a microtask.
    const root = this.root;
    queueMicrotask(() => root.unmount());
  }
}

export function createReactNodeView(
  Component: NodeViewComponent,
  options: CreateNodeViewOptions,
): NodeViewConstructor {
  return (node, view, getPos) =>
    new ReactNodeView(node, view, getPos, Component, options.hasContent);
}
