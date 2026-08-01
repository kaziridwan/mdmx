import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStudioComponent, STUDIO_COMPONENTS_DIR, type StudioComponentDef } from "@mdmx/studio";
import type { MDMXConfig } from "@mdmx/project";

/** Valid studio definitions stored under `<contentDir>/_components/`. */
export function loadStudioDefs(cwd: string, config: MDMXConfig): StudioComponentDef[] {
  const dir = join(cwd, config.contentDir, STUDIO_COMPONENTS_DIR);
  if (!existsSync(dir)) return [];
  const defs: StudioComponentDef[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const { def } = parseStudioComponent(readFileSync(join(dir, file), "utf8"));
    if (def) defs.push(def);
  }
  return defs;
}
