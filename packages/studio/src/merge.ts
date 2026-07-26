import type { RegistrySpec } from "@mdmx/core";
import type { StudioComponentDef } from "./model.js";
import { studioComponentToSpec } from "./spec.js";

/**
 * Merge studio definitions into a baked registry spec.
 *
 * **Code beats studio**: a name defined by a real `defineMDMX` component wins,
 * so ejecting a studio component to TSX shadows its JSON definition without a
 * separate cleanup step. The CLI (`mdmx check`) and the request-time registry
 * in `@mdmx/next` both used to implement this rule privately; one drifting
 * copy would mean content that lints clean and fails to save, or vice versa.
 */
export function mergeStudioSpecs(
  spec: RegistrySpec,
  defs: readonly StudioComponentDef[],
): RegistrySpec {
  if (defs.length === 0) return spec;
  const taken = new Set(spec.components.map((c) => c.name));
  const merged = [...spec.components];
  for (const def of defs) {
    if (taken.has(def.name)) continue;
    taken.add(def.name);
    merged.push(studioComponentToSpec(def));
  }
  return { ...spec, components: merged };
}
