import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseDocument,
  validateTree,
  type Diagnostic,
  type Registry,
} from "@imdx/core";

/**
 * Read-side helpers. Because content lives in the same repo as the site,
 * the published site never calls GitHub at runtime: these read the local
 * filesystem at build time (SSG/ISR-friendly).
 */

export interface IMDXDocument {
  /** Collection-relative slug (filename without extension, unless frontmatter overrides). */
  slug: string;
  /** Path relative to the collection directory. */
  path: string;
  frontmatter: Record<string, unknown>;
  /** Raw iMDX body including frontmatter (hand to the renderer / editor). */
  source: string;
  /** Present only when a registry was supplied to validate against. */
  diagnostics?: Diagnostic[];
}

export interface GetDocumentsOptions {
  /** Filter by frontmatter `status`; default returns everything. */
  status?: string | string[];
  /** Validate each document against a registry and attach diagnostics. */
  registry?: Registry;
}

const CONTENT_EXTENSIONS = /\.(mdx|md)$/;

export async function getDocuments(
  collectionDir: string,
  options: GetDocumentsOptions = {},
): Promise<IMDXDocument[]> {
  const files = await listContentFiles(collectionDir);
  const docs: IMDXDocument[] = [];
  for (const rel of files) {
    docs.push(await loadDocument(collectionDir, rel, options));
  }
  const statuses =
    options.status === undefined
      ? null
      : new Set(Array.isArray(options.status) ? options.status : [options.status]);
  const filtered = statuses
    ? docs.filter((d) => statuses.has(String(d.frontmatter.status ?? "")))
    : docs;
  return filtered.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getDocumentBySlug(
  collectionDir: string,
  slug: string,
  options: GetDocumentsOptions = {},
): Promise<IMDXDocument | null> {
  const docs = await getDocuments(collectionDir, options);
  return docs.find((d) => d.slug === slug) ?? null;
}

async function loadDocument(
  collectionDir: string,
  rel: string,
  options: GetDocumentsOptions,
): Promise<IMDXDocument> {
  const source = await readFile(join(collectionDir, rel), "utf8");
  const { tree, frontmatter } = parseDocument(source);
  const slug =
    typeof frontmatter.slug === "string" && frontmatter.slug.length > 0
      ? frontmatter.slug
      : rel.replace(CONTENT_EXTENSIONS, "");
  return {
    slug,
    path: rel,
    frontmatter,
    source,
    ...(options.registry
      ? { diagnostics: validateTree(tree, { registry: options.registry }) }
      : {}),
  };
}

async function listContentFiles(dir: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...(await listContentFiles(join(dir, entry.name), rel)));
    } else if (CONTENT_EXTENSIONS.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}
