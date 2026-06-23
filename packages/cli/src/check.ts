import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { glob } from "tinyglobby";
import {
  parseDocument,
  Registry,
  validateFrontmatter,
  validateSource,
  type Diagnostic,
  type RegistrySpec,
} from "@mdmx/core";
import type { MDMXConfig } from "./config.js";

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
  const registry = new Registry(spec);

  const contentFiles = await glob([`${config.contentDir}/**/*.{md,mdx}`], {
    cwd,
    absolute: true,
  });

  const files: FileDiagnostics[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const file of contentFiles.sort()) {
    const source = readFileSync(file, "utf8");
    const rel = relative(cwd, file);
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
