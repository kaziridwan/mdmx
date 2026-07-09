import type { ComponentSpec, ControlSpec, JsonValue, PropSpec } from "./types.js";

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

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

export const STUDIO_ALLOWED_TAGS: ReadonlySet<string> = new Set([
  "a",
  "article",
  "aside",
  "blockquote",
  "br",
  "button",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "img",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "ul",
]);

export const STUDIO_ALLOWED_ATTRS: ReadonlySet<string> = new Set([
  "alt",
  "aria-hidden",
  "aria-label",
  "height",
  "href",
  "loading",
  "rel",
  "role",
  "src",
  "target",
  "title",
  "type",
  "width",
]);

const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const PROP_NAME_RE = /^[a-z][A-Za-z0-9]*$/;
const INTERPOLATION_RE = /\{props\.([A-Za-z0-9]+)\}/g;
/** Non-global twin of INTERPOLATION_RE — `.test()` on a /g regex is stateful. */
const HAS_INTERPOLATION_RE = /\{props\.[A-Za-z0-9]+\}/;
/** URL attribute values must not smuggle scripts. */
const URL_ATTRS = new Set(["href", "src"]);
const SAFE_URL_RE = /^(?!\s*(javascript|data|vbscript):)/i;

/** Prop names referenced by `{props.x}` interpolations in a string. */
export function interpolatedProps(value: string): string[] {
  const out: string[] = [];
  for (const match of value.matchAll(INTERPOLATION_RE)) out.push(match[1]!);
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_NODES = 500;
const MAX_PROPS = 24;

/**
 * Validate a candidate studio definition (parsed JSON of unknown shape).
 * Returns human-readable problems; empty = valid. `takenNames` lets callers
 * reject collisions with the code registry / other studio defs.
 */
export function validateStudioComponent(
  candidate: unknown,
  takenNames: ReadonlySet<string> = new Set(),
): string[] {
  const problems: string[] = [];
  if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return ["definition must be a JSON object"];
  }
  const def = candidate as Partial<StudioComponentDef>;

  if (def.mdmxStudioVersion !== 1) problems.push("mdmxStudioVersion must be 1");
  if (typeof def.name !== "string" || !NAME_RE.test(def.name)) {
    problems.push('name must be PascalCase (e.g. "PromoCard")');
  } else if (takenNames.has(def.name)) {
    problems.push(`name "${def.name}" is already taken`);
  }
  if (def.description !== undefined && typeof def.description !== "string") {
    problems.push("description must be a string");
  }

  const propNames = new Set<string>();
  if (!Array.isArray(def.props)) {
    problems.push("props must be an array");
  } else {
    if (def.props.length > MAX_PROPS) problems.push(`at most ${MAX_PROPS} props`);
    for (const prop of def.props as unknown[]) {
      const p = prop as Partial<StudioPropDef>;
      if (p == null || typeof p !== "object" || typeof p.name !== "string") {
        problems.push("each prop needs a name");
        continue;
      }
      if (!PROP_NAME_RE.test(p.name)) {
        problems.push(`prop "${p.name}" must be camelCase`);
      }
      if (propNames.has(p.name)) problems.push(`duplicate prop "${p.name}"`);
      propNames.add(p.name);
      if (p.type !== "string" && p.type !== "number" && p.type !== "boolean") {
        problems.push(`prop "${p.name}" type must be string | number | boolean`);
      }
      if (p.default !== undefined && typeof p.default !== p.type) {
        problems.push(`prop "${p.name}" default must be a ${p.type}`);
      }
    }
  }

  if (def.template == null) {
    problems.push("template is required");
  } else {
    const count = { nodes: 0 };
    validateElement(def.template as TemplateElement, propNames, problems, "template", count);
    if (count.nodes > MAX_NODES) problems.push(`template exceeds ${MAX_NODES} nodes`);
  }
  return problems;
}

function validateElement(
  el: unknown,
  propNames: ReadonlySet<string>,
  problems: string[],
  path: string,
  count: { nodes: number },
): void {
  count.nodes++;
  if (count.nodes > MAX_NODES) return;
  if (el == null || typeof el !== "object") {
    problems.push(`${path}: element must be an object`);
    return;
  }
  const node = el as TemplateElement;
  if (typeof node.tag !== "string" || !STUDIO_ALLOWED_TAGS.has(node.tag)) {
    problems.push(`${path}: tag "${String(node.tag)}" is not allowed`);
    return;
  }
  if (node.classes !== undefined && typeof node.classes !== "string") {
    problems.push(`${path}: classes must be a string`);
  }
  if (node.attrs !== undefined) {
    if (node.attrs == null || typeof node.attrs !== "object" || Array.isArray(node.attrs)) {
      problems.push(`${path}: attrs must be an object`);
    } else {
      for (const [key, value] of Object.entries(node.attrs)) {
        if (!STUDIO_ALLOWED_ATTRS.has(key)) {
          problems.push(`${path}: attribute "${key}" is not allowed`);
          continue;
        }
        if (typeof value !== "string") {
          problems.push(`${path}: attribute "${key}" must be a string`);
          continue;
        }
        if (URL_ATTRS.has(key) && !SAFE_URL_RE.test(value)) {
          problems.push(`${path}: attribute "${key}" has an unsafe URL scheme`);
        }
        checkInterpolations(value, propNames, problems, `${path}[${key}]`);
      }
    }
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      problems.push(`${path}: children must be an array`);
      return;
    }
    node.children.forEach((child, i) => {
      const childPath = `${path}.${node.tag}[${i}]`;
      if (child == null || typeof child !== "object") {
        problems.push(`${childPath}: child must be an object`);
        return;
      }
      if ("text" in child) {
        if (typeof child.text !== "string") problems.push(`${childPath}: text must be a string`);
        else checkInterpolations(child.text, propNames, problems, childPath);
        count.nodes++;
        return;
      }
      if ("slot" in child) {
        if (typeof child.slot !== "string" || !propNames.has(child.slot)) {
          problems.push(`${childPath}: slot "${String(child.slot)}" is not a declared prop`);
        }
        count.nodes++;
        return;
      }
      validateElement(child, propNames, problems, childPath, count);
    });
  }
}

function checkInterpolations(
  value: string,
  propNames: ReadonlySet<string>,
  problems: string[],
  path: string,
): void {
  for (const name of interpolatedProps(value)) {
    if (!propNames.has(name)) {
      problems.push(`${path}: {props.${name}} is not a declared prop`);
    }
  }
}

// ---------------------------------------------------------------------------
// Registry integration
// ---------------------------------------------------------------------------

/** Rail/palette category studio components appear under. */
export const STUDIO_CATEGORY = "Studio";

function controlFor(prop: StudioPropDef): ControlSpec {
  switch (prop.type) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    default:
      return { type: "text" };
  }
}

/** Registry entry for a studio definition (leaf component, live render). */
export function studioComponentToSpec(def: StudioComponentDef): ComponentSpec {
  const props: PropSpec[] = def.props.map((p) => ({
    name: p.name,
    required: p.required === true,
    control: controlFor(p),
    ...(p.default !== undefined ? { default: p.default } : {}),
    ...(p.description ? { description: p.description } : {}),
  }));
  return {
    name: def.name,
    category: STUDIO_CATEGORY,
    icon: def.icon ?? "sparkles",
    ...(def.description ? { description: def.description } : {}),
    version: 1,
    children: { policy: "none" },
    props,
    render: { mode: "live" },
  };
}

// ---------------------------------------------------------------------------
// Eject: studio definition → defineMDMX TSX source
// ---------------------------------------------------------------------------

const TS_TYPE: Record<StudioPropType, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
};

const EJECT_VOID_TAGS = new Set(["br", "hr", "img"]);

/**
 * Generate a `defineMDMX` component file from a studio definition, matching
 * the conventions of hand-written components (typed props interface, Impl
 * function, tagged export). The generated file is real code: run
 * `mdmx generate` and rebuild, and it shadows the stored JSON definition
 * everywhere (code components take precedence in the registry merge and the
 * editor's component map).
 */
export function studioComponentToTSX(def: StudioComponentDef): string {
  const iface = `${def.name}Props`;
  const lines: string[] = [];
  lines.push(`import { defineMDMX } from "@mdmx/core";`);
  lines.push("");
  if (def.props.length > 0) {
    lines.push(`interface ${iface} {`);
    for (const p of def.props) {
      if (p.description) lines.push(`  /** ${p.description} */`);
      lines.push(`  ${p.name}${p.required ? "" : "?"}: ${TS_TYPE[p.type]};`);
    }
    lines.push(`}`);
    lines.push("");
  }

  const params =
    def.props.length > 0
      ? `{ ${def.props
          .map((p) =>
            p.default !== undefined ? `${p.name} = ${JSON.stringify(p.default)}` : p.name,
          )
          .join(", ")} }: ${iface}`
      : "";
  lines.push(`function ${def.name}Impl(${params}) {`);
  lines.push(`  return (`);
  lines.push(printJsxElement(def.template, 2));
  lines.push(`  );`);
  lines.push(`}`);
  lines.push("");

  lines.push(`export const ${def.name} = defineMDMX(${def.name}Impl, {`);
  lines.push(`  name: ${JSON.stringify(def.name)},`);
  lines.push(`  category: ${JSON.stringify(STUDIO_CATEGORY)},`);
  lines.push(`  icon: ${JSON.stringify(def.icon ?? "sparkles")},`);
  if (def.description) lines.push(`  description: ${JSON.stringify(def.description)},`);
  const configProps = def.props.filter((p) => p.default !== undefined || p.description);
  if (configProps.length > 0) {
    lines.push(`  props: {`);
    for (const p of configProps) {
      const parts: string[] = [];
      if (p.default !== undefined) parts.push(`default: ${JSON.stringify(p.default)}`);
      if (p.description) parts.push(`description: ${JSON.stringify(p.description)}`);
      lines.push(`    ${p.name}: { ${parts.join(", ")} },`);
    }
    lines.push(`  },`);
  }
  lines.push(`});`);
  lines.push("");
  return lines.join("\n");
}

function printJsxElement(el: TemplateElement, depth: number): string {
  const pad = "  ".repeat(depth);
  const attrs: string[] = [];
  if (el.classes) attrs.push(`className=${JSON.stringify(el.classes)}`);
  for (const [name, value] of Object.entries(el.attrs ?? {})) {
    attrs.push(`${name}=${printJsxAttrValue(value)}`);
  }
  const attrText = attrs.length ? " " + attrs.join(" ") : "";
  if (EJECT_VOID_TAGS.has(el.tag) || !el.children || el.children.length === 0) {
    return `${pad}<${el.tag}${attrText} />`;
  }
  const inner = el.children
    .map((child) =>
      "tag" in child
        ? printJsxElement(child, depth + 1)
        : `${"  ".repeat(depth + 1)}${printJsxChild(child)}`,
    )
    .join("\n");
  return `${pad}<${el.tag}${attrText}>\n${inner}\n${pad}</${el.tag}>`;
}

function printJsxAttrValue(value: string): string {
  const single = value.match(/^\{props\.([A-Za-z0-9]+)\}$/);
  if (single) return `{${single[1]}}`;
  if (HAS_INTERPOLATION_RE.test(value)) return `{${toTemplateLiteral(value)}}`;
  return JSON.stringify(value);
}

function printJsxChild(child: TemplateText | TemplateSlot): string {
  if ("slot" in child) return `{${child.slot}}`;
  const text = child.text;
  const whole = text.match(/^\{props\.([A-Za-z0-9]+)\}$/);
  if (whole) return `{${whole[1]}}`;
  if (HAS_INTERPOLATION_RE.test(text)) return `{${toTemplateLiteral(text)}}`;
  // Braces/angles would be parsed as JSX syntax — wrap as a string literal.
  if (/[{}<>]/.test(text)) return `{${JSON.stringify(text)}}`;
  return text;
}

function toTemplateLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  return "`" + escaped.replace(INTERPOLATION_RE, (_, name: string) => "${" + name + "}") + "`";
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
