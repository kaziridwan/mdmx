import { validateStudioComponent } from "./validate.js";
import type { ComponentSpec, ControlSpec, JsonValue, PropSpec } from "@mdmx/core";

/**
 * Component Studio model (ADR: road-to-0.4.1). A studio component is a
 * runtime template component: a restricted element tree with Tailwind-style
 * classes and prop slots, authored in the browser and stored as JSON in the
 * content repo (`<contentDir>/_components/<Name>.json`). It is data, not
 * code — no scripts, no event handlers, no arbitrary HTML strings — so it can
 * be validated server-side without an HTML parser and rendered without
 * `dangerouslySetInnerHTML`. HTML is only an input format: UIs parse markup
 * into this tree and back.
 *
 * Prop interpolation: `{props.<name>}` inside text nodes and attribute
 * values, or an explicit `{ "slot": "<name>" }` child node.
 */

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type StudioPropType = "string" | "number" | "boolean";

export interface StudioPropDef {
  name: string;
  type: StudioPropType;
  required?: boolean;
  default?: JsonValue;
  description?: string;
}

export interface TemplateText {
  text: string;
}

export interface TemplateSlot {
  /** Renders the named prop's value as text. */
  slot: string;
}

export interface TemplateElement {
  tag: string;
  /** Space-separated class list (Tailwind utilities, typically). */
  classes?: string;
  /** Allowlisted attributes; values may interpolate `{props.<name>}`. */
  attrs?: Record<string, string>;
  children?: TemplateChild[];
}

export type TemplateChild = TemplateElement | TemplateText | TemplateSlot;

export interface StudioComponentDef {
  mdmxStudioVersion: 1;
  /** PascalCase, unique against the code registry and other studio defs. */
  name: string;
  description?: string;
  icon?: string;
  props: StudioPropDef[];
  template: TemplateElement;
}

/** Directory (under the content dir) where studio definitions live. */
export const STUDIO_COMPONENTS_DIR = "_components";

/** Repo path of a studio component definition. */
export function studioComponentPath(contentDir: string, name: string): string {
  return `${contentDir}/${STUDIO_COMPONENTS_DIR}/${name}.json`;
}

/** Parse + validate a stored definition file. */
export function parseStudioComponent(
  jsonText: string,
  takenNames: ReadonlySet<string> = new Set(),
): { def: StudioComponentDef | null; problems: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { def: null, problems: [`invalid JSON: ${(err as Error).message}`] };
  }
  const problems = validateStudioComponent(parsed, takenNames);
  return problems.length > 0
    ? { def: null, problems }
    : { def: parsed as StudioComponentDef, problems: [] };
}
