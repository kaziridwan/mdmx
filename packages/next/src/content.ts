import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument, validateTree, type Diagnostic, type Registry } from "@mdmx/core";
import { parseStudioComponent, STUDIO_COMPONENTS_DIR, type StudioComponentDef } from "@mdmx/studio";

/**
 * Read-side helpers. Because content lives in the same repo as the site,
 * the published site never calls GitHub at runtime: these read the local
 * filesystem at build time (SSG/ISR-friendly).
 *
 * Vocabulary (ADR-047): a **document** is any MDMX file — that is core's
 * concern, where the grammar and diagnostics live. An **entry** is a document
 * that belongs to a collection, so it has a slug, a status, and a frontmatter
 * schema. Everything at this layer is collection-scoped, so everything here
 * says entry.
 */

export interface MDMXEntry {
  /** Collection-relative slug (filename without extension, unless frontmatter overrides). */
  slug: string;
  /** Path relative to the collection directory. */
  path: string;
  frontmatter: Record<string, unknown>;
  /** Raw MDMX body including frontmatter (hand to the renderer / editor). */
  source: string;
  /** Present only when a registry was supplied to validate against. */
  diagnostics?: Diagnostic[];
}

export interface GetEntriesOptions {
  /** Filter by frontmatter `status`; default returns everything. */
  status?: string | string[];
  /** Validate each document against a registry and attach diagnostics. */
  registry?: Registry;
}

const CONTENT_EXTENSIONS = /\.(mdx|md)$/;

export async function getEntries(
  collectionDir: string,
  options: GetEntriesOptions = {},
): Promise<MDMXEntry[]> {
  const files = await listContentFiles(collectionDir);
  const entries: MDMXEntry[] = [];
  for (const rel of files) {
    entries.push(await loadEntry(collectionDir, rel, options));
  }
  const statuses =
    options.status === undefined
      ? null
      : new Set(Array.isArray(options.status) ? options.status : [options.status]);
  const filtered = statuses
    ? entries.filter((d) => statuses.has(String(d.frontmatter.status ?? "")))
    : entries;
  return filtered.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getEntryBySlug(
  collectionDir: string,
  slug: string,
  options: GetEntriesOptions = {},
): Promise<MDMXEntry | null> {
  const entries = await getEntries(collectionDir, options);
  return entries.find((e) => e.slug === slug) ?? null;
}

async function loadEntry(
  collectionDir: string,
  rel: string,
  options: GetEntriesOptions,
): Promise<MDMXEntry> {
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

/**
 * Read the valid studio component definitions stored under
 * `<contentDir>/_components` (build-time filesystem read, like the document
 * readers — invalid files are skipped). Pair with `studioRenderComponents`
 * from `@mdmx/next/render` to render them on public pages.
 */
export async function getStudioComponentDefs(
  contentDir = "content",
): Promise<StudioComponentDef[]> {
  const dir = join(contentDir, STUDIO_COMPONENTS_DIR);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const defs: StudioComponentDef[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const { def } = parseStudioComponent(await readFile(join(dir, entry.name), "utf8"));
    if (def) defs.push(def);
  }
  return defs.sort((a, b) => a.name.localeCompare(b.name));
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
