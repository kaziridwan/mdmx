import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { glob } from "tinyglobby";
import { parseDocument, Registry, validateFrontmatter, validateSource, type Diagnostic, type RegistrySpec } from "@mdmx/core";
import { mergeStudioSpecs, parseStudioComponent, STUDIO_COMPONENTS_DIR } from "@mdmx/studio";
import type { MDMXConfig } from "@mdmx/project";

export interface FileDiagnostics {
  file: string;
  diagnostics: Diagnostic[];
}

export interface CheckResult {
  files: FileDiagnostics[];
  errorCount: number;
  warningCount: number;
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

  return { files, errorCount, warningCount };
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
