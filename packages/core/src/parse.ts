import type { Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified, type Processor } from "unified";
import YAML from "yaml";

/**
 * The single parser configuration for iMDX. The serializer mirrors these
 * plugins (see serialize.ts) so parse/serialize stay symmetric.
 */
export function createParser(): Processor<Root> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMdx) as unknown as Processor<Root>;
}

/** Parse iMDX/MDX source text into an mdast tree. */
export function parseMDX(source: string): Root {
  const processor = createParser();
  return processor.runSync(processor.parse(source)) as Root;
}

export interface ParsedDocument {
  tree: Root;
  /** Parsed YAML frontmatter, or {} when none is present. */
  frontmatter: Record<string, unknown>;
}

/** Parse source and extract frontmatter in one step. */
export function parseDocument(source: string): ParsedDocument {
  const tree = parseMDX(source);
  const fmNode = tree.children.find((n) => n.type === "yaml");
  let frontmatter: Record<string, unknown> = {};
  if (fmNode && "value" in fmNode && typeof fmNode.value === "string") {
    const parsed = YAML.parse(fmNode.value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      frontmatter = parsed as Record<string, unknown>;
    }
  }
  return { tree, frontmatter };
}
