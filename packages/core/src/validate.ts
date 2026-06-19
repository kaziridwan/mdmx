import type { Node, Parent, Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { evaluateAttributes } from "./props.js";
import { parseMDX } from "./parse.js";
import type {
  ComponentSpec,
  Diagnostic,
  Registry,
  SourceSpan,
} from "./types.js";

// ---------------------------------------------------------------------------
// The subset whitelist
// ---------------------------------------------------------------------------

/** Flow + structural nodes allowed anywhere ordinary markdown flows. */
const ALLOWED_TYPES = new Set([
  "root",
  "paragraph",
  "heading",
  "text",
  "emphasis",
  "strong",
  "delete",
  "inlineCode",
  "link",
  "image",
  "list",
  "listItem",
  "blockquote",
  "code",
  "thematicBreak",
  "break",
  "table",
  "tableRow",
  "tableCell",
  "yaml",
  "mdxJsxFlowElement",
]);

/** Phrasing nodes permitted inside a `rich-text` component body. */
const RICH_TEXT_PHRASING = new Set([
  "text",
  "emphasis",
  "strong",
  "delete",
  "inlineCode",
  "link",
  "break",
]);

/** Friendlier names for the things we reject most often. */
const DISALLOWED_HINTS: Record<string, string> = {
  html: "Raw HTML is not part of iMDX. Use a registered component instead.",
  mdxjsEsm: "import/export statements are not allowed in iMDX content. Components are injected from the registry.",
  mdxFlowExpression: "JavaScript expressions are not allowed in iMDX content.",
  mdxTextExpression: "Inline JavaScript expressions are not allowed in iMDX content.",
  mdxJsxTextElement: "Inline (text-level) components are not allowed in iMDX v1. Use the component as a block.",
  definition: "Reference-style links are not part of iMDX. Use inline links: [text](url).",
  linkReference: "Reference-style links are not part of iMDX. Use inline links: [text](url).",
  imageReference: "Reference-style images are not part of iMDX. Use inline images: ![alt](url).",
  footnoteDefinition: "Footnotes are not part of iMDX v1.",
  footnoteReference: "Footnotes are not part of iMDX v1.",
};

function spanOf(node: Node): SourceSpan | undefined {
  const p = node.position;
  if (!p) return undefined;
  return {
    start: { line: p.start.line, column: p.start.column },
    end: { line: p.end.line, column: p.end.column },
  };
}

function isParent(node: Node): node is Parent {
  return "children" in node && Array.isArray((node as Parent).children);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidateOptions {
  registry: Registry;
}

/** Validate an already-parsed tree against the iMDX subset + a registry. */
export function validateTree(tree: Root, options: ValidateOptions): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  walk(tree, null, options.registry, diagnostics, "blocks");
  return diagnostics;
}

/** Convenience: parse + validate source text. */
export function validateSource(source: string, options: ValidateOptions): Diagnostic[] {
  return validateTree(parseMDX(source), options);
}

/**
 * @param parentComponent nearest enclosing registered component spec, if any
 * @param mode what kind of content is legal here: "blocks" | "rich-text"
 */
function walk(
  node: Node,
  parentComponent: ComponentSpec | null,
  registry: Registry,
  diagnostics: Diagnostic[],
  mode: "blocks" | "rich-text",
): void {
  // 1. Subset membership
  if (!ALLOWED_TYPES.has(node.type)) {
    diagnostics.push({
      code: "IMDX003",
      severity: "error",
      message:
        DISALLOWED_HINTS[node.type] ??
        `Node type "${node.type}" is outside the iMDX subset.`,
      span: spanOf(node),
    });
    return; // opaque: don't descend into disallowed regions
  }

  // 2. Rich-text mode restricts what may appear
  if (mode === "rich-text" && node.type !== "paragraph" && node.type !== "root") {
    if (!RICH_TEXT_PHRASING.has(node.type)) {
      diagnostics.push({
        code: "IMDX004",
        severity: "error",
        message: `"${node.type}" is not allowed inside <${parentComponent?.name}> (children policy: rich-text).`,
        span: spanOf(node),
      });
      return;
    }
  }

  // 3. Components
  if (node.type === "mdxJsxFlowElement") {
    validateComponent(node as MdxJsxFlowElement, parentComponent, registry, diagnostics);
    return; // validateComponent handles descent
  }

  // 4. Recurse
  if (isParent(node)) {
    for (const child of node.children) {
      walk(child, parentComponent, registry, diagnostics, mode);
    }
  }
}

function validateComponent(
  el: MdxJsxFlowElement,
  parentComponent: ComponentSpec | null,
  registry: Registry,
  diagnostics: Diagnostic[],
): void {
  const name = el.name;
  if (!name) {
    diagnostics.push({
      code: "IMDX003",
      severity: "error",
      message: "JSX fragments (<>…</>) are not allowed in iMDX.",
      span: spanOf(el),
    });
    return;
  }

  const spec = registry.get(name);
  if (!spec) {
    diagnostics.push({
      code: "IMDX001",
      severity: "error",
      message: `Unknown component <${name}>. It is not in the iMDX registry — run \`imdx generate\` or register it with defineIMDX().`,
      span: spanOf(el),
    });
    return;
  }

  // Parent constraint (declared on the child)
  const allowedParents = spec.constraints?.allowedParents ?? null;
  if (allowedParents) {
    const parentName = parentComponent?.name;
    if (!parentName || !allowedParents.includes(parentName)) {
      diagnostics.push({
        code: "IMDX005",
        severity: "error",
        message: `<${name}> may only appear inside ${allowedParents
          .map((p) => `<${p}>`)
          .join(", ")}.`,
        span: spanOf(el),
      });
    }
  }

  // Props
  const { props, diagnostics: propDiags } = evaluateAttributes(el);
  diagnostics.push(...propDiags);

  const declared = new Map(spec.props.map((p) => [p.name, p]));
  for (const propName of Object.keys(props)) {
    if (!declared.has(propName)) {
      diagnostics.push({
        code: "IMDX007",
        severity: "warning",
        message: `<${name}> does not declare a prop "${propName}".`,
        span: spanOf(el),
      });
    }
  }
  for (const p of spec.props) {
    if (p.required && !(p.name in props) && p.default === undefined) {
      diagnostics.push({
        code: "IMDX006",
        severity: "error",
        message: `<${name}> is missing required prop "${p.name}".`,
        span: spanOf(el),
      });
    }
  }

  // Children policy
  const policy = spec.children.policy;
  if (policy === "none") {
    if (el.children.length > 0) {
      diagnostics.push({
        code: "IMDX004",
        severity: "error",
        message: `<${name}> does not accept children (children policy: none). Write it self-closing: <${name} />.`,
        span: spanOf(el),
      });
    }
    return;
  }

  // allowedChildren slot constraint (declared on the parent)
  const allowedChildren = spec.constraints?.allowedChildren ?? null;
  if (allowedChildren) {
    for (const child of el.children) {
      const ok =
        child.type === "mdxJsxFlowElement" &&
        (child as MdxJsxFlowElement).name != null &&
        allowedChildren.includes((child as MdxJsxFlowElement).name as string);
      if (!ok) {
        diagnostics.push({
          code: "IMDX004",
          severity: "error",
          message: `<${name}> only accepts ${allowedChildren
            .map((c) => `<${c}>`)
            .join(", ")} as direct children.`,
          span: spanOf(child),
        });
        continue;
      }
      walk(child, spec, registry, diagnostics, "blocks");
    }
    return;
  }

  const childMode = policy === "rich-text" ? "rich-text" : "blocks";
  for (const child of el.children) {
    walk(child, spec, registry, diagnostics, childMode);
  }
}
