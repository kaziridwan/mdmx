import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { glob } from "tinyglobby";
import { parseDocument, Registry, validateFrontmatter, validateSource, type Diagnostic, type RegistrySpec } from "@mdmx/core";
import { mergeStudioSpecs, parseStudioComponent, STUDIO_COMPONENTS_DIR } from "@mdmx/studio";
import type { MDMXConfig } from "@mdmx/project";
import { computeRegistryHash } from "./generate.js";

export interface FileDiagnostics {
  file: string;
  diagnostics: Diagnostic[];
}

export interface CheckResult {
  files: FileDiagnostics[];
  errorCount: number;
  warningCount: number;
  /** Non-null when the committed registry no longer matches the components. */
  staleRegistry: string | null;
}

export async function check(cwd: string, config: MDMXConfig): Promise<CheckResult> {
  const registryPath = join(cwd, config.outDir, "registry.json");
  if (!existsSync(registryPath)) {
    throw new Error(
      `No registry found at ${relative(cwd, registryPath)}. Run \`mdmx generate\` first.`,
    );
  }
  const spec = JSON.parse(readFileSync(registryPath, "utf8")) as RegistrySpec;
  const registry = new Registry(mergeStudioComponents(cwd, config, spec));

  // The registry is committed (ADR-040), so CI has to catch the case where
  // someone edits a component and forgets to regenerate — otherwise the
  // editor palette and the validation rules quietly disagree with the code.
  const staleRegistry = await detectStaleRegistry(cwd, config, spec);

  const contentFiles = await glob([`${config.contentDir}/**/*.{md,mdx}`], {
    cwd,
    absolute: true,
  });

  const files: FileDiagnostics[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const file of contentFiles.sort()) {
    const source = readFileSync(file, "utf8");
    // Forward slashes even on win32 — collectionForPath matches on "/".
    const rel = relative(cwd, file).replaceAll("\\", "/");
    const diagnostics = validateSource(source, { registry });

    // Frontmatter validation against the file's collection, if any.
    const collection = registry.collectionForPath(rel);
    if (collection) {
      const { frontmatter } = parseDocument(source);
      diagnostics.push(...validateFrontmatter(frontmatter, collection));
    }

    if (diagnostics.length === 0) continue;
    for (const d of diagnostics) {
      if (d.severity === "error") errorCount += 1;
      else warningCount += 1;
    }
    files.push({ file: rel, diagnostics });
  }

  return { files, errorCount, warningCount, staleRegistry };
}

/**
 * Content may use studio components (runtime template components stored under
 * `<contentDir>/_components/`); merge their specs so documents using them
 * don't flag MDMX001. The code-beats-studio rule itself lives in
 * `@mdmx/studio` — the CLI and the Next.js runtime share one implementation.
 */
function mergeStudioComponents(cwd: string, config: MDMXConfig, spec: RegistrySpec): RegistrySpec {
  const dir = join(cwd, config.contentDir, STUDIO_COMPONENTS_DIR);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  const defs = [];
  for (const file of files.sort()) {
    const { def } = parseStudioComponent(readFileSync(join(dir, file), "utf8"));
    if (def) defs.push(def);
  }
  return mergeStudioSpecs(spec, defs);
}

/**
 * Regenerate in memory and compare hashes. Returns a message when the
 * committed artifact is out of date, or null when it is current.
 */
async function detectStaleRegistry(
  cwd: string,
  config: MDMXConfig,
  committed: RegistrySpec,
): Promise<string | null> {
  if (!committed.hash) return null; // pre-0.5 artifact: nothing to compare
  const { specHash } = await computeRegistryHash(cwd, config);
  if (specHash === committed.hash) return null;
  return (
    `${join(config.outDir, "registry.json")} is stale (committed ${committed.hash}, ` +
    `components hash ${specHash}). Run \`mdmx generate\` and commit the result.`
  );
}

export function formatDiagnostics(result: CheckResult): string {
  const lines: string[] = [];
  for (const { file, diagnostics } of result.files) {
    for (const d of diagnostics) {
      const pos = d.span ? `${d.span.start.line}:${d.span.start.column}` : "-";
      lines.push(`${file}:${pos} ${d.severity} ${d.code} ${d.message}`);
    }
  }
  return lines.join("\n");
}
