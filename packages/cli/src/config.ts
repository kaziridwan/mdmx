import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ControlSpec, JsonValue } from "@mdmx/core";

/** Frontmatter field as authored in `mdmx.config.json` (keyed by field name). */
export interface FieldConfig {
  control: ControlSpec;
  required?: boolean;
  default?: JsonValue;
  description?: string;
}

/** A collection as authored in config (keyed by collection name). */
export interface CollectionConfig {
  /** Content directory for this collection, relative to the project root. */
  dir: string;
  fields: Record<string, FieldConfig>;
}

export interface MDMXConfig {
  /** Glob(s) for component definition files, relative to the project root. */
  components: string | string[];
  /** Directory holding MDMX content files. */
  contentDir: string;
  /** Directory the generated registry artifacts are written to. */
  outDir: string;
  /** Content collections with typed frontmatter, keyed by collection name. */
  collections?: Record<string, CollectionConfig>;
}

export const DEFAULT_CONFIG: MDMXConfig = {
  components: "components/mdmx/**/*.{ts,tsx}",
  contentDir: "content",
  outDir: ".mdmx",
};

/**
 * Load mdmx.config.json or mdmx.config.mjs from the project root.
 * (TS config files are a planned addition — they need a transpile step.)
 */
export async function loadConfig(cwd: string): Promise<MDMXConfig> {
  const jsonPath = join(cwd, "mdmx.config.json");
  if (existsSync(jsonPath)) {
    const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as Partial<MDMXConfig>;
    return { ...DEFAULT_CONFIG, ...raw };
  }
  const mjsPath = join(cwd, "mdmx.config.mjs");
  if (existsSync(mjsPath)) {
    const mod = (await import(pathToFileURL(resolve(mjsPath)).href)) as {
      default?: Partial<MDMXConfig>;
    };
    return { ...DEFAULT_CONFIG, ...(mod.default ?? {}) };
  }
  return DEFAULT_CONFIG;
}
