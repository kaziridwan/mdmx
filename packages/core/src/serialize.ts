import type { Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/**
 * Canonical serialization options. These are part of the iMDX spec:
 * changing any of them dirties every file in every user's repo on next
 * save, so treat changes here as semver-major.
 */
export const CANONICAL_STRINGIFY_OPTIONS = {
  bullet: "-",
  bulletOther: "*",
  emphasis: "*",
  strong: "*",
  fence: "`",
  fences: true,
  listItemIndent: "one",
  rule: "-",
  ruleSpaces: false,
  setext: false,
  tightDefinitions: true,
  resourceLink: true,
} as const;

/** Pinned options for mdast-util-mdx-jsx (forwarded through remark-mdx). */
export const CANONICAL_MDX_OPTIONS = {
  quote: '"',
  quoteSmart: false,
  tightSelfClosing: false,
  printWidth: 80,
} as const;

function createSerializer() {
  return unified()
    .use(remarkStringify, CANONICAL_STRINGIFY_OPTIONS)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMdx, CANONICAL_MDX_OPTIONS);
}

/** Serialize an mdast tree to canonical iMDX text. */
export function toMDX(tree: Root): string {
  const out = createSerializer().stringify(tree) as unknown as string;
  // Canonical form: exactly one trailing newline.
  return out.replace(/\n*$/, "\n");
}
