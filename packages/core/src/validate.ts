import type { Node, Parent, Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { evaluateAttributes } from "./props.js";
import { parseDocument, parseMDX } from "./parse.js";
import { validateFrontmatter } from "./frontmatter.js";
import { collectionForPath } from "./types.js";
import type {
  CollectionSpec,
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
  html: "Raw HTML is not part of MDMX. Use a registered component instead.",
  mdxjsEsm: "import/export statements are not allowed in MDMX content. Components are injected from the registry.",
  mdxFlowExpression: "JavaScript expressions are not allowed in MDMX content.",
  mdxTextExpression: "Inline JavaScript expressions are not allowed in MDMX content.",
  mdxJsxTextElement: "Inline (text-level) components are not allowed in MDMX v1. Use the component as a block.",
  definition: "Reference-style links are not part of MDMX. Use inline links: [text](url).",
  linkReference: "Reference-style links are not part of MDMX. Use inline links: [text](url).",
  imageReference: "Reference-style images are not part of MDMX. Use inline images: ![alt](url).",
  footnoteDefinition: "Footnotes are not part of MDMX v1.",
  footnoteReference: "Footnotes are not part of MDMX v1.",
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

/** Validate an already-parsed tree against the MDMX subset + a registry. */
export function validateTree(tree: Root, options: ValidateOptions): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  walk(tree, null, options.registry, diagnostics, "blocks");
  return diagnostics;
}

/** Convenience: parse + validate source text. */
export function validateSource(source: string, options: ValidateOptions): Diagnostic[] {
  return validateTree(parseMDX(source), options);
}

export interface ValidateDocumentOptions extends ValidateOptions {
  /**
   * Repo-relative path, used to find the document's collection so its
   * frontmatter is checked against the right schema. Without it, frontmatter
   * validation is skipped (the document isn't an entry).
   */
  path?: string;
  /** Collections to match `path` against; defaults to the registry's. */
  collections?: readonly CollectionSpec[];
}

/**
 * Validate a document end to end: subset rules, plus frontmatter against its
 * collection when it has one.
 *
 * `mdmx check` and the save route used to hand-stitch this same sequence
 * (validateSource → parseDocument → collectionForPath → validateFrontmatter),
 * parsing every file twice and diverging in their error handling. One seam,
 * one parse, one behaviour.
 */
export function validateDocument(
  source: string,
  options: ValidateDocumentOptions,
): Diagnostic[] {
  const { tree, frontmatter, frontmatterDiagnostic } = parseDocument(source);
  const diagnostics = validateTree(tree, options);
  if (frontmatterDiagnostic) diagnostics.push(frontmatterDiagnostic);

  if (options.path) {
    const collections = options.collections ?? options.registry.collections;
    const collection = collectionForPath(collections, options.path);
    // Frontmatter that failed to parse can't be checked against a schema —
    // reporting MDMX008 for every field on top of MDMX010 is just noise.
    if (collection && !frontmatterDiagnostic) {
      diagnostics.push(...validateFrontmatter(frontmatter, collection));
    }
  }
  return diagnostics;
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
      code: "MDMX003",
      severity: "error",
      message:
        DISALLOWED_HINTS[node.type] ??
        `Node type "${node.type}" is outside the MDMX subset.`,
      span: spanOf(node),
    });
    return; // opaque: don't descend into disallowed regions
  }

  // 2. Rich-text mode restricts what may appear
  if (mode === "rich-text" && node.type !== "paragraph" && node.type !== "root") {
    if (!RICH_TEXT_PHRASING.has(node.type)) {
      diagnostics.push({
        code: "MDMX004",
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
      code: "MDMX003",
      severity: "error",
      message: "JSX fragments (<>…</>) are not allowed in MDMX.",
      span: spanOf(el),
    });
    return;
  }

  const spec = registry.get(name);
  if (!spec) {
    diagnostics.push({
      code: "MDMX001",
      severity: "error",
      message: `Unknown component <${name}>. It is not in the MDMX registry — run \`mdmx generate\` or register it with defineMDMX().`,
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
        code: "MDMX005",
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
        code: "MDMX007",
        severity: "warning",
        message: `<${name}> does not declare a prop "${propName}".`,
        span: spanOf(el),
      });
    }
  }
  for (const p of spec.props) {
    if (p.required && !Object.hasOwn(props, p.name) && p.default === undefined) {
      diagnostics.push({
        code: "MDMX006",
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
        code: "MDMX004",
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
          code: "MDMX004",
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
