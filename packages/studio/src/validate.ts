import type {
  StudioComponentDef,
  StudioPropDef,
  TemplateChild,
  TemplateElement,
} from "./model.js";
import { HAS_INTERPOLATION_RE, INTERPOLATION_RE, interpolatedProps } from "./interpolate.js";

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
/** URL attribute values must not smuggle scripts. */
const URL_ATTRS = new Set(["href", "src"]);
const SAFE_URL_RE = /^(?!\s*(javascript|data|vbscript):)/i;


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
