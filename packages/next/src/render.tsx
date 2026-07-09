import { createElement, Fragment, type ComponentType, type ReactNode } from "react";
import {
  evaluateAttributes,
  parseDocument,
  type JsonValue,
  type StudioComponentDef,
  type TemplateChild,
  type TemplateElement,
} from "@mdmx/core";
import type { RootContent } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";

/**
 * Build-time MDMX → React renderer for public pages (`@mdmx/next/render`).
 * Pure function of the source text: parse with core's canonical parser, walk
 * the mdast tree, resolve component tags through the supplied map. No hooks,
 * no client dependencies — usable directly in App Router server components:
 *
 *   const doc = await getDocumentBySlug("content/posts", slug, { status: "published" });
 *   return <article className="mdmx-page"><MDMXContent source={doc.source} components={map} /></article>;
 *
 * Lives in its own subpath so the core package entry (API handlers, readers)
 * keeps zero react dependency.
 */

/** Component name → implementation, same shape as the editor's ComponentMap. */
export type RenderComponents = Record<string, ComponentType<any>>;

export interface MDMXContentProps {
  /** Raw MDMX source including frontmatter (e.g. `MDMXDocument.source`). */
  source: string;
  /** Author components keyed by registry name. */
  components?: RenderComponents;
}

/** Render an MDMX document body to React (frontmatter is skipped). */
export function MDMXContent({ source, components = {} }: MDMXContentProps): ReactNode {
  const { tree } = parseDocument(source);
  return <Fragment>{renderNodes(tree.children, components)}</Fragment>;
}

function renderNodes(nodes: readonly RootContent[], map: RenderComponents): ReactNode[] {
  return nodes.map((node, i) => renderNode(node, map, i));
}

function renderNode(node: RootContent, map: RenderComponents, key: number): ReactNode {
  switch (node.type) {
    case "yaml":
      return null; // frontmatter
    case "text":
      return node.value;
    case "paragraph":
      return <p key={key}>{renderNodes(node.children, map)}</p>;
    case "heading":
      return createElement(`h${node.depth}`, { key }, renderNodes(node.children, map));
    case "emphasis":
      return <em key={key}>{renderNodes(node.children, map)}</em>;
    case "strong":
      return <strong key={key}>{renderNodes(node.children, map)}</strong>;
    case "delete":
      return <del key={key}>{renderNodes(node.children, map)}</del>;
    case "inlineCode":
      return <code key={key}>{node.value}</code>;
    case "code":
      return (
        <pre key={key}>
          <code className={node.lang ? `language-${node.lang}` : undefined}>{node.value}</code>
        </pre>
      );
    case "blockquote":
      return <blockquote key={key}>{renderNodes(node.children, map)}</blockquote>;
    case "list":
      return node.ordered ? (
        <ol key={key} start={node.start ?? undefined}>
          {renderNodes(node.children, map)}
        </ol>
      ) : (
        <ul key={key}>{renderNodes(node.children, map)}</ul>
      );
    case "listItem":
      return (
        <li key={key}>
          {node.checked != null ? (
            <input type="checkbox" checked={node.checked} readOnly disabled />
          ) : null}
          {renderNodes(node.children, map)}
        </li>
      );
    case "table": {
      const [head, ...rows] = node.children;
      const align = node.align ?? [];
      return (
        <table key={key}>
          {head ? (
            <thead>
              <tr>
                {head.children.map((cell, c) => (
                  <th key={c} style={alignStyle(align[c])}>
                    {renderNodes(cell.children, map)}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.children.map((cell, c) => (
                  <td key={c} style={alignStyle(align[c])}>
                    {renderNodes(cell.children, map)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "link":
      return (
        <a key={key} href={node.url} title={node.title ?? undefined}>
          {renderNodes(node.children, map)}
        </a>
      );
    case "image":
      return <img key={key} src={node.url} alt={node.alt ?? ""} title={node.title ?? undefined} />;
    case "thematicBreak":
      return <hr key={key} />;
    case "break":
      return <br key={key} />;
    case "mdxJsxFlowElement":
    case "mdxJsxTextElement":
      return renderJsxElement(node, map, key);
    default:
      // Everything else (raw html, mdx expressions/esm, reference-style
      // constructs) is outside the MDMX content grammar — render nothing
      // rather than throw.
      return null;
  }
}

function renderJsxElement(
  node: MdxJsxFlowElement | MdxJsxTextElement,
  map: RenderComponents,
  key: number,
): ReactNode {
  const children = node.children.length
    ? renderNodes(node.children as RootContent[], map)
    : undefined;
  if (!node.name) return <Fragment key={key}>{children}</Fragment>;

  const { props } = evaluateAttributes(node);

  // Lowercase tag: a plain HTML element written inline in the content.
  if (node.name[0] === node.name[0]?.toLowerCase()) {
    return createElement(node.name, { ...props, key }, children);
  }

  const Component = map[node.name];
  if (!Component) {
    // Unknown component: keep the children visible instead of dropping content.
    return (
      <div key={key} data-mdmx-missing={node.name}>
        {children}
      </div>
    );
  }
  return createElement(Component, { ...props, key }, children);
}

function alignStyle(align: "left" | "right" | "center" | null | undefined) {
  return align ? { textAlign: align } : undefined;
}

// ---------------------------------------------------------------------------
// Studio components (runtime template components, ADR road-to-0.4.1)
// ---------------------------------------------------------------------------

const INTERPOLATION_RE = /\{props\.([A-Za-z0-9]+)\}/g;

function interpolate(value: string, props: Record<string, JsonValue>): string {
  return value.replace(INTERPOLATION_RE, (_, name: string) => {
    const v = props[name];
    return v == null ? "" : String(v);
  });
}

function renderTemplateElement(
  node: TemplateElement,
  props: Record<string, JsonValue>,
  key: number,
): ReactNode {
  const attrs: Record<string, unknown> = { key };
  if (node.classes) attrs.className = node.classes;
  for (const [name, value] of Object.entries(node.attrs ?? {})) {
    attrs[name] = interpolate(value, props);
  }
  const children = (node.children ?? []).map((child, i) =>
    renderTemplateChild(child, props, i),
  );
  return createElement(node.tag, attrs, ...(children.length ? [children] : []));
}

function renderTemplateChild(
  child: TemplateChild,
  props: Record<string, JsonValue>,
  key: number,
): ReactNode {
  if ("text" in child) return interpolate(child.text, props);
  if ("slot" in child) {
    const v = props[child.slot];
    return v == null ? null : String(v);
  }
  return renderTemplateElement(child, props, key);
}

/**
 * Turn a studio definition into a React component: the template tree renders
 * directly to elements (never dangerouslySetInnerHTML), prop defaults
 * applied, `{props.x}` interpolations and slot nodes resolved. Works in the
 * editor canvas, the studio preview, and public pages alike.
 */
export function studioComponent(def: StudioComponentDef): ComponentType<Record<string, JsonValue>> {
  const defaults: Record<string, JsonValue> = {};
  for (const p of def.props) {
    if (p.default !== undefined) defaults[p.name] = p.default;
  }
  function StudioComponent(props: Record<string, JsonValue>) {
    const merged = { ...defaults, ...props };
    return <Fragment>{renderTemplateElement(def.template, merged, 0)}</Fragment>;
  }
  StudioComponent.displayName = `Studio(${def.name})`;
  return StudioComponent;
}

/** Component map for a set of studio definitions (spread into your map). */
export function studioRenderComponents(
  defs: readonly StudioComponentDef[],
): RenderComponents {
  const out: RenderComponents = {};
  for (const def of defs) out[def.name] = studioComponent(def);
  return out;
}
