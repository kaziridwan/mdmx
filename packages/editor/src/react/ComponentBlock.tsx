import { Component, createElement, type ComponentType, type ReactNode } from "react";
import type { ComponentSpec, JsonValue } from "@mdmx/core";
import type { NodeViewComponent, NodeViewComponentProps } from "./react-node-view.js";

/**
 * Error boundary that degrades a thrown live render to a placeholder card —
 * and tries the live render again when `resetKey` changes (the props object
 * identity: a fixed prop revives the block instead of leaving it a
 * placeholder until reload, ADR-058). A render that throws again just lands
 * back on the fallback; no loop, because the key hasn't changed.
 */
export class RenderBoundary extends Component<
  { fallback: ReactNode; resetKey: unknown; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: unknown }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The PM-managed editable hole, placed where children belong. */
function ContentHole({ contentRef }: { contentRef: NodeViewComponentProps["contentRef"] }) {
  return <div className="mdmx-content" ref={contentRef} />;
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
    <div className="mdmx-placeholder" data-mdmx-placeholder={spec.name}>
      <div className="mdmx-placeholder-head">
        <span className="mdmx-placeholder-name">{spec.name}</span>
        {summary ? <span className="mdmx-placeholder-props">{summary}</span> : null}
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
      <RenderBoundary fallback={placeholder} resetKey={props}>
        {createElement(UserComponent as ComponentType<any>, props, hole)}
      </RenderBoundary>
    ) : (
      placeholder
    );

    return (
      <div
        className={"mdmx-component" + (selected ? " is-selected" : "")}
        data-mdmx-component={spec.name}
      >
        {body}
      </div>
    );
  };
}
