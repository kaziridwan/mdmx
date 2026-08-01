import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Registry, type RegistrySpec } from "@mdmx/core";
import type { MDMXConfig } from "./config.js";

/**
 * Loading the generated registry from disk — the `readFileSync` boilerplate
 * guide 01 used to ask every consumer to write by hand (ADR-039/043).
 */

export const REGISTRY_JSON = "registry.json";

export function registryPath(root: string, config: MDMXConfig): string {
  return join(root, config.outDir, REGISTRY_JSON);
}

export class MissingRegistryError extends Error {
  readonly path: string;
  constructor(path: string) {
    super(`No registry at ${path}. Run \`mdmx generate\` before starting the app.`);
    this.name = "MissingRegistryError";
    this.path = path;
  }
}

export function loadRegistrySpec(root: string, config: MDMXConfig): RegistrySpec {
  const path = registryPath(root, config);
  if (!existsSync(path)) throw new MissingRegistryError(path);
  return JSON.parse(readFileSync(path, "utf8")) as RegistrySpec;
}

export function loadRegistry(root: string, config: MDMXConfig): Registry {
  return new Registry(loadRegistrySpec(root, config));
}

/** Spec if the registry exists, otherwise null (callers that can degrade). */
export function tryLoadRegistrySpec(
  root: string,
  config: MDMXConfig,
): RegistrySpec | null {
  const path = registryPath(root, config);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as RegistrySpec;
}
