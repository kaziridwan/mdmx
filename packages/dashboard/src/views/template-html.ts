import { STUDIO_ALLOWED_ATTRS, STUDIO_ALLOWED_TAGS, type TemplateChild, type TemplateElement } from "@mdmx/studio";

/**
 * HTML ⇄ studio template tree. HTML is only the studio's *input format*: the
 * stored definition is the restricted tree (see core/studio.ts), so parsing
 * filters to the allowlists and reports what it dropped instead of trusting
 * markup. `{props.x}` placeholders ride along inside text and attribute
 * values untouched.
 */

export interface HtmlConversion {
  template: TemplateElement | null;
  /** Tags/attributes that were dropped, for surfacing in the UI. */
  problems: string[];
}

export function htmlToTemplate(html: string): HtmlConversion {
  const problems: string[] = [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const roots: TemplateElement[] = [];
  for (const node of Array.from(doc.body.childNodes)) {
    const converted = convertNode(node, problems);
    if (converted && typeof converted === "object" && "tag" in converted) {
      roots.push(converted);
    } else if (converted && "text" in converted && converted.text.trim() !== "") {
      problems.push(`top-level text "${converted.text.trim().slice(0, 24)}…" needs an element around it`);
    }
  }
  if (roots.length === 0) {
    return { template: null, problems: [...problems, "markup needs at least one element"] };
  }
  const template = roots.length === 1 ? roots[0]! : { tag: "div", children: roots };
  return { template, problems };
}

function convertNode(node: Node, problems: string[]): TemplateChild | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const collapsed = (node.textContent ?? "").replace(/\s+/g, " ");
    return collapsed.trim() === "" ? null : { text: collapsed.trim() };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null; // comments etc.
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (!STUDIO_ALLOWED_TAGS.has(tag)) {
    problems.push(`dropped <${tag}> (not in the allowed tag set)`);
    return null;
  }
  const out: TemplateElement = { tag };
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name === "class") {
      if (attr.value.trim()) out.classes = attr.value.trim();
      continue;
    }
    if (!STUDIO_ALLOWED_ATTRS.has(name)) {
      problems.push(`dropped attribute "${name}" on <${tag}>`);
      continue;
    }
    (out.attrs ??= {})[name] = attr.value;
  }
  const children: TemplateChild[] = [];
  for (const child of Array.from(el.childNodes)) {
    const converted = convertNode(child, problems);
    if (converted) children.push(converted);
  }
  if (children.length > 0) out.children = children;
  return out;
}

// ---------------------------------------------------------------------------
// Tree → HTML (for the editable source pane)
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(["br", "hr", "img"]);

export function templateToHtml(template: TemplateElement): string {
  return printElement(template, 0);
}

function printElement(el: TemplateElement, depth: number): string {
  const pad = "  ".repeat(depth);
  const attrs: string[] = [];
  if (el.classes) attrs.push(`class="${escapeAttr(el.classes)}"`);
  for (const [name, value] of Object.entries(el.attrs ?? {})) {
    attrs.push(`${name}="${escapeAttr(value)}"`);
  }
  const open = `<${el.tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  if (VOID_TAGS.has(el.tag)) return `${pad}${open}`;

  const children = el.children ?? [];
  if (children.length === 0) return `${pad}${open}</${el.tag}>`;
  // Single text/slot child stays inline; anything else goes block-formatted.
  if (children.length === 1 && children[0] && !("tag" in children[0])) {
    return `${pad}${open}${printChildInline(children[0])}</${el.tag}>`;
  }
  const inner = children
    .map((child) =>
      "tag" in child ? printElement(child, depth + 1) : "  ".repeat(depth + 1) + printChildInline(child),
    )
    .join("\n");
  return `${pad}${open}\n${inner}\n${pad}</${el.tag}>`;
}

function printChildInline(child: TemplateChild): string {
  if ("text" in child) return escapeText(child.text);
  if ("slot" in child) return `{props.${child.slot}}`;
  return "";
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}
