import { createElement, Fragment, type ComponentType, type ReactNode } from "react";
import type { JsonValue } from "@mdmx/core";
import { interpolate } from "./interpolate.js";
import type { StudioComponentDef, TemplateChild, TemplateElement } from "./model.js";

/**
 * The template→React renderer — one implementation for every surface: the
 * editor canvas, the dashboard preview, and public pages. The template tree
 * renders to real elements (never `dangerouslySetInnerHTML`), which is what
 * makes a browser-authored component safe to store as data.
 */

export type StudioComponents = Record<string, ComponentType<Record<string, JsonValue>>>;

function renderElement(
  node: TemplateElement,
  props: Record<string, JsonValue>,
  key: number,
): ReactNode {
  const attrs: Record<string, unknown> = { key };
  if (node.classes) attrs.className = node.classes;
  for (const [name, value] of Object.entries(node.attrs ?? {})) {
    attrs[name] = interpolate(value, props);
  }
  const children = (node.children ?? []).map((child, i) => renderChild(child, props, i));
  return createElement(node.tag, attrs, ...(children.length ? [children] : []));
}

function renderChild(child: TemplateChild, props: Record<string, JsonValue>, key: number): ReactNode {
  if ("text" in child) return interpolate(child.text, props);
  if ("slot" in child) {
    const v = props[child.slot];
    return v == null ? null : String(v);
  }
  return renderElement(child, props, key);
}

/**
 * Turn a studio definition into a React component: prop defaults applied,
 * `{props.x}` interpolations and slot nodes resolved.
 */
export function studioComponent(
  def: StudioComponentDef,
): ComponentType<Record<string, JsonValue>> {
  const defaults: Record<string, JsonValue> = {};
  for (const p of def.props) {
    if (p.default !== undefined) defaults[p.name] = p.default;
  }
  function StudioComponent(props: Record<string, JsonValue>) {
    const merged = { ...defaults, ...props };
    return <Fragment>{renderElement(def.template, merged, 0)}</Fragment>;
  }
  StudioComponent.displayName = `Studio(${def.name})`;
  return StudioComponent;
}

/** Component map for a set of studio definitions (spread into your map). */
export function studioRenderComponents(
  defs: readonly StudioComponentDef[],
): StudioComponents {
  const out: StudioComponents = {};
  for (const def of defs) out[def.name] = studioComponent(def);
  return out;
}

/** Render one template subtree directly — used by the studio preview. */
export function renderTemplateElement(
  node: TemplateElement,
  props: Record<string, JsonValue>,
  key = 0,
): ReactNode {
  return renderElement(node, props, key);
}
