import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CollectionsConfig } from "@mdmx/core";

/**
 * The project config schema — one definition for every consumer (ADR-043).
 *
 * Before this package the CLI and the Next.js runtime each parsed
 * `mdmx.config.*` their own way, and they had already drifted: the CLI
 * accepted `.json` and `.mjs`, the runtime read `.json` only, so an
 * `.mjs`-configured project got a working CLI and a runtime that silently
 * ignored its collections.
 *
 * Structural, committed values live here. Secrets live in the environment
 * (see `env.ts`), and explicit options remain the override layer (ADR-039).
 */
export interface MDMXConfig {
  /** Glob(s) for component definition files, relative to the project root. */
  components: string | string[];
  /** Directory holding MDMX content files. */
  contentDir: string;
  /** Directory uploaded media is written to (served by the host app). */
  mediaDir: string;
  /** Directory ejected studio components are written to. */
  componentsDir: string;
  /** Directory the generated registry artifacts are written to. */
  outDir: string;
  /** The repository content is committed to. */
  repo?: { owner: string; name: string; branch: string };
  /** Route prefix the API handlers are mounted under. */
  basePath: string;
  /** Route prefix the dashboard is mounted under. */
  mountPath: string;
  /** "strict" rejects saves carrying error diagnostics; "report" saves anyway. */
  validation: "strict" | "report";
  /** Content collections with typed frontmatter, keyed by collection name. */
  collections?: CollectionsConfig;
}

export const DEFAULT_CONFIG: MDMXConfig = {
  components: "components/mdmx/**/*.{ts,tsx}",
  contentDir: "content",
  mediaDir: "public/media",
  componentsDir: "components/mdmx",
  outDir: ".mdmx",
  basePath: "/api/mdmx",
  mountPath: "/mdmx",
  validation: "report",
};

export const CONFIG_FILENAMES = ["mdmx.config.json", "mdmx.config.mjs"] as const;

export interface LoadedConfig {
  config: MDMXConfig;
  /** Absolute path of the file the config came from, or null when defaulted. */
  path: string | null;
  /** Project root the config was resolved against. */
  root: string;
}

/**
 * Locate the config file for a project root (JSON preferred over .mjs).
 *
 * The `turbopackIgnore` comments: Next 16's Turbopack traces filesystem
 * access reachable from `process.cwd()` at build time and, unable to scope
 * this lookup, warns that it "causes tracing of the whole project". The
 * config is read from the project root at request time by design (a
 * git-native CMS reads the working tree), so the calls are opted out of
 * tracing here rather than in every consumer's next.config.
 */
export function findConfigFile(root: string): string | null {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(/* turbopackIgnore: true */ root, name);
    if (existsSync(/* turbopackIgnore: true */ candidate)) return candidate;
  }
  return null;
}

/**
 * Load `mdmx.config.json` or `mdmx.config.mjs`, merged over the defaults.
 * A missing file is not an error — the defaults describe the conventional
 * layout, which is the whole point of the convention-first path.
 */
export async function loadConfig(root: string): Promise<LoadedConfig> {
  const path = findConfigFile(root);
  if (!path) return { config: { ...DEFAULT_CONFIG }, path: null, root };

  // The `.mjs` form is loaded at runtime from the user's project, never
  // bundled: both bundlers are told to leave the dynamic import alone.
  const raw = path.endsWith(".json")
    ? (JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8")) as Partial<MDMXConfig>)
    : (((await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ pathToFileURL(
          resolve(/* turbopackIgnore: true */ path),
        ).href,
      )) as {
        default?: Partial<MDMXConfig>;
      }).default ?? {});

  return { config: mergeConfig(raw), path, root };
}

/** Merge authored values over the defaults, ignoring explicit undefined. */
export function mergeConfig(raw: Partial<MDMXConfig>): MDMXConfig {
  const out = { ...DEFAULT_CONFIG } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) out[key] = value;
  }
  return out as unknown as MDMXConfig;
}

/**
 * The config file as it sits on disk (or in the repo): authored keys only,
 * plus anything the project put there that MDMX doesn't own. The runtime
 * reads this shape *through a ContentProvider* rather than from the
 * filesystem, so that a dashboard-managed collection edit round-trips
 * through the same commit pipeline as content (ADR-035) — but the shape and
 * the merge rules are shared with `loadConfig`, not redefined.
 */
export type ProjectConfigFile = Partial<MDMXConfig> & { [key: string]: unknown };

export class ConfigParseError extends Error {
  readonly status = 500;
  constructor(source: string) {
    super(`${source} is not valid JSON; fix it before managing collections`);
    this.name = "ConfigParseError";
  }
}

/** Parse config file text (JSON form). Throws ConfigParseError on syntax errors. */
export function parseProjectConfig(text: string, source = "mdmx.config.json"): ProjectConfigFile {
  try {
    return JSON.parse(text) as ProjectConfigFile;
  } catch {
    throw new ConfigParseError(source);
  }
}

/** Problems that make a config unusable; empty means the config is sound. */
export function validateConfig(config: MDMXConfig): string[] {
  const problems: string[] = [];
  if (!config.contentDir) problems.push("contentDir must not be empty");
  if (!config.outDir) problems.push("outDir must not be empty");
  if (config.validation !== "strict" && config.validation !== "report") {
    problems.push(`validation must be "strict" or "report"`);
  }
  for (const [key, value] of [
    ["basePath", config.basePath],
    ["mountPath", config.mountPath],
  ] as const) {
    if (!value.startsWith("/")) problems.push(`${key} must start with "/"`);
    if (value.length > 1 && value.endsWith("/")) {
      problems.push(`${key} must not end with "/"`);
    }
  }
  if (config.repo) {
    for (const field of ["owner", "name", "branch"] as const) {
      if (!config.repo[field]) problems.push(`repo.${field} must not be empty`);
    }
  }
  return problems;
}
