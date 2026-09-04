import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { glob } from "tinyglobby";
import {
  MDMX_REGISTRY_VERSION,
  collectionsFromConfig,
  type RegistrySpec,
} from "@mdmx/core";
import type { MDMXConfig } from "@mdmx/project";
import { detectTailwind } from "@mdmx/project";
import {
  extractComponents,
  type ExtractionIssue,
  type ExtractedComponent,
} from "./extract.js";
import {
  emitClientComponents,
  emitRegistryModule,
  emitServerModule,
} from "./emit.js";
import {
  STUDIO_MANIFEST,
  compileStudioCss,
  emitStudioManifest,
  extractStudioClasses,
} from "./studio-css.js";
import { loadStudioDefs } from "./studio-defs.js";

export interface GenerateResult {
  spec: RegistrySpec;
  issues: ExtractionIssue[];
  /** Absolute paths of the emitted artifacts. */
  written: { json: string; ts: string; client: string; server: string };
  /** Artifacts whose bytes actually changed (empty on a no-op regenerate). */
  changed: string[];
  hasErrors: boolean;
}

/**
 * The hash of what a generate *would* produce, without writing anything.
 * `mdmx check` uses it to detect a committed registry that has fallen behind
 * its components (ADR-040).
 */
export async function computeRegistryHash(
  cwd: string,
  config: MDMXConfig,
): Promise<{ specHash: string }> {
  const patterns = Array.isArray(config.components) ? config.components : [config.components];
  const files = await glob(patterns, { cwd, absolute: true });
  const { components } = extractComponents(files, cwd);
  const seen = new Set<string>();
  const specs = components
    .filter((c) => (seen.has(c.spec.name) ? false : (seen.add(c.spec.name), true)))
    .sort((a, b) => a.spec.name.localeCompare(b.spec.name))
    .map((c) => c.spec);
  const collections = collectionsFromConfig(config.collections);
  return { specHash: hashSpec(specs, collections) };
}

function hashSpec(
  components: RegistrySpec["components"],
  collections: NonNullable<RegistrySpec["collections"]>,
): string {
  const body = JSON.stringify({ components, collections });
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

export async function generate(cwd: string, config: MDMXConfig): Promise<GenerateResult> {
  const patterns = Array.isArray(config.components)
    ? config.components
    : [config.components];
  const files = await glob(patterns, { cwd, absolute: true });

  const { components, issues } = extractComponents(files, cwd);

  // Registry-level validation: duplicate names.
  const seen = new Map<string, ExtractedComponent>();
  const deduped: ExtractedComponent[] = [];
  for (const c of components) {
    const existing = seen.get(c.spec.name);
    if (existing) {
      issues.push({
        severity: "error",
        message: `Duplicate component name "${c.spec.name}" (also defined in ${existing.spec.source}).`,
        file: c.spec.source ?? c.file,
      });
      continue;
    }
    seen.set(c.spec.name, c);
    deduped.push(c);
  }
  deduped.sort((a, b) => a.spec.name.localeCompare(b.spec.name));

  const collections = collectionsFromConfig(config.collections);

  const componentSpecs = deduped.map((c) => c.spec);
  // No `generatedAt`: the artifacts are committed (ADR-040), so identical
  // input must produce identical bytes or every dev session dirties the tree.
  const spec: RegistrySpec = {
    mdmxRegistryVersion: MDMX_REGISTRY_VERSION,
    hash: hashSpec(componentSpecs, collections),
    components: componentSpecs,
    ...(collections.length > 0 ? { collections } : {}),
  };

  const outDir = join(cwd, config.outDir);
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, "registry.json");
  const tsPath = join(outDir, "registry.ts");
  const clientPath = join(outDir, "components.ts");
  const serverPath = join(outDir, "server.ts");
  const cssPath = join(outDir, "studio.css");

  // Studio components carry Tailwind-style classes the host's CSS build never
  // sees. A Tailwind host gets a class manifest to scan through `@source`
  // (ADR-054); any other host gets the utilities compiled here (ADR-042).
  const studioDefs = loadStudioDefs(cwd, config);
  const hostTailwind = detectTailwind(cwd);
  const manifestPath = join(outDir, STUDIO_MANIFEST);
  let hasStudioCss = false;
  let cssWrite: string | null = null;
  let manifestWrite: string | null = null;
  if (hostTailwind) {
    const classes = extractStudioClasses(studioDefs);
    manifestWrite = classes.length
      ? writeIfChanged(manifestPath, emitStudioManifest(classes))
      : removeIfPresent(manifestPath);
    // A stale compiled sheet from before the handoff would shadow the host's
    // theme if anything still imported it; nothing does, so drop it.
    removeIfPresent(cssPath);
  } else {
    const studio = await compileStudioCss(studioDefs);
    hasStudioCss = studio.css.length > 0;
    cssWrite = hasStudioCss ? writeIfChanged(cssPath, studio.css) : removeIfPresent(cssPath);
    removeIfPresent(manifestPath);
  }

  const changed = [
    writeIfChanged(jsonPath, JSON.stringify(spec, null, 2) + "\n"),
    writeIfChanged(tsPath, emitRegistryModule(spec, deduped, outDir)),
    writeIfChanged(clientPath, emitClientComponents(deduped, outDir)),
    writeIfChanged(serverPath, emitServerModule(config, hasStudioCss)),
    cssWrite,
    manifestWrite,
  ].filter((p): p is string => p !== null);

  return {
    spec,
    issues,
    written: { json: jsonPath, ts: tsPath, client: clientPath, server: serverPath },
    changed,
    hasErrors: issues.some((i) => i.severity === "error"),
  };
}

/**
 * Write only when the bytes differ. A no-op regenerate must not touch mtimes:
 * committed artifacts would show as dirty in git, and every downstream file
 * watcher would fire for nothing.
 */
/** Delete an artifact this generate no longer produces; the path if it was there. */
function removeIfPresent(path: string): string | null {
  if (!existsSync(path)) return null;
  rmSync(path);
  return path;
}

function writeIfChanged(path: string, content: string): string | null {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return null;
  writeFileSync(path, content);
  return path;
}
