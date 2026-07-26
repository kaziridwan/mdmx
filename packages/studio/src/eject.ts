import type {
  StudioComponentDef,
  StudioPropDef,
  StudioPropType,
  TemplateChild,
  TemplateElement,
  TemplateSlot,
  TemplateText,
} from "./model.js";
import { STUDIO_CATEGORY } from "./spec.js";
import { HAS_INTERPOLATION_RE, INTERPOLATION_RE } from "./interpolate.js";

const EJECT_VOID_TAGS = new Set(["br", "hr", "img"]);

const TS_TYPE: Record<StudioPropType, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
};

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
