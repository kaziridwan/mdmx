import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Registry, type RegistrySpec } from "@mdmx/core";

// Shared server-side MDMX configuration for the demo app.

export const CONTENT_DIR = "content";
export const MEDIA_DIR = "public/media";
export const REPO = { owner: "local", name: "demo-next", branch: "main" } as const;

/** The app runs from the demo-next directory; content lives under it. */
export function projectRoot(): string {
  return process.cwd();
}

export function registrySpec(): RegistrySpec {
  const path = join(projectRoot(), ".mdmx", "registry.json");
  return JSON.parse(readFileSync(path, "utf8")) as RegistrySpec;
}

export function registry(): Registry {
  return new Registry(registrySpec());
}
