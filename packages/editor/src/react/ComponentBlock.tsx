import { Component, createElement, type ComponentType, type ReactNode } from "react";
import type { ComponentSpec, JsonValue } from "@imdx/core";
import type { NodeViewComponent, NodeViewComponentProps } from "./react-node-view.js";

/** Error boundary that degrades a thrown live render to a placeholder card. */
class RenderBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The PM-managed editable hole, placed where children belong. */
function ContentHole({ contentRef }: { contentRef: NodeViewComponentProps["contentRef"] }) {
  return <div className="imdx-content" ref={contentRef} />;
}

function PlaceholderCard({
  spec,
  props,
  children,
}: {
  spec: ComponentSpec;
  props: Record<string, JsonValue>;
  children: ReactNode;
}) {
  const summary = Object.entries(props)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ");
  return (
    <div className="imdx-placeholder" data-imdx-placeholder={spec.name}>
      <div className="imdx-placeholder-head">
        <span className="imdx-placeholder-name">{spec.name}</span>
        {summary ? <span className="imdx-placeholder-props">{summary}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Bind a component spec and (optionally) the author's React component into a
 * NodeView renderer. Live render when the component is supplied and the spec
 * opts into it; otherwise a placeholder card. Content-bearing components always
 * render the editable hole so children are never orphaned.
 */
export function makeComponentBlock(
  spec: ComponentSpec,
  UserComponent: ComponentType<any> | undefined,
): NodeViewComponent {
  const hasContent = spec.children.policy !== "none";

  return function ComponentBlock({ node, selected, contentRef }: NodeViewComponentProps) {
    const props = node.attrs.props as Record<string, JsonValue>;
    const hole = hasContent ? <ContentHole contentRef={contentRef} /> : null;
    const live = UserComponent !== undefined && spec.render?.mode !== "placeholder";

    const placeholder = (
      <PlaceholderCard spec={spec} props={props}>
        {hole}
      </PlaceholderCard>
    );

    const body = live ? (
      <RenderBoundary fallback={placeholder}>
        {createElement(UserComponent as ComponentType<any>, props, hole)}
      </RenderBoundary>
    ) : (
      placeholder
    );

    return (
      <div
        className={"imdx-component" + (selected ? " is-selected" : "")}
        data-imdx-component={spec.name}
      >
        {body}
      </div>
    );
  };
}
