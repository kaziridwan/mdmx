import type { Root } from "mdast";
import type { Diagnostic } from "./types.js";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified, type Processor } from "unified";
import YAML from "yaml";

/**
 * The single parser configuration for MDMX. The serializer mirrors these
 * plugins (see serialize.ts) so parse/serialize stay symmetric.
 */
export function createParser(): Processor<Root> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMdx) as unknown as Processor<Root>;
}

/** Parse MDMX/MDX source text into an mdast tree. */
export function parseMDX(source: string): Root {
  const processor = createParser();
  return processor.runSync(processor.parse(source)) as Root;
}

export interface ParsedDocument {
  tree: Root;
  /** Parsed YAML frontmatter, or {} when none is present or it is broken. */
  frontmatter: Record<string, unknown>;
  /**
   * MDMX010 when the frontmatter isn't valid YAML (or isn't a mapping).
   *
   * Broken frontmatter is a diagnostic, not an exception: one malformed file
   * used to abort an entire `mdmx check` run, which is the moment you most
   * need the report.
   */
  frontmatterDiagnostic?: Diagnostic;
}

/** Parse source and extract frontmatter in one step. */
export function parseDocument(source: string): ParsedDocument {
  const tree = parseMDX(source);
  const fmNode = tree.children.find((n) => n.type === "yaml");
  let frontmatter: Record<string, unknown> = {};
  let frontmatterDiagnostic: Diagnostic | undefined;

  if (fmNode && "value" in fmNode && typeof fmNode.value === "string") {
    try {
      const parsed = YAML.parse(fmNode.value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      } else if (parsed !== null && parsed !== undefined) {
        frontmatterDiagnostic = {
          code: "MDMX010",
          severity: "error",
          message: "Frontmatter must be a YAML mapping of fields.",
          ...(fmNode.position ? { span: spanOfNode(fmNode.position) } : {}),
        };
      }
    } catch (err) {
      frontmatterDiagnostic = {
        code: "MDMX010",
        severity: "error",
        message: `Frontmatter is not valid YAML: ${(err as Error).message}`,
        ...(fmNode.position ? { span: spanOfNode(fmNode.position) } : {}),
      };
    }
  }

  return {
    tree,
    frontmatter,
    ...(frontmatterDiagnostic ? { frontmatterDiagnostic } : {}),
  };
}

function spanOfNode(position: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}) {
  return {
    start: { line: position.start.line, column: position.start.column },
    end: { line: position.end.line, column: position.end.column },
  };
}
