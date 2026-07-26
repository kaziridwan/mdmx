import type { ComponentSpec, ControlSpec, PropSpec } from "@mdmx/core";
import type { StudioComponentDef, StudioPropDef } from "./model.js";

// ---------------------------------------------------------------------------
// Registry integration
// ---------------------------------------------------------------------------

/** Rail/palette category studio components appear under. */
export const STUDIO_CATEGORY = "Studio";

function controlFor(prop: StudioPropDef): ControlSpec {
  switch (prop.type) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    default:
      return { type: "text" };
  }
}

/** Registry entry for a studio definition (leaf component, live render). */
export function studioComponentToSpec(def: StudioComponentDef): ComponentSpec {
  const props: PropSpec[] = def.props.map((p) => ({
    name: p.name,
    required: p.required === true,
    control: controlFor(p),
    ...(p.default !== undefined ? { default: p.default } : {}),
    ...(p.description ? { description: p.description } : {}),
  }));
  return {
    name: def.name,
    category: STUDIO_CATEGORY,
    icon: def.icon ?? "sparkles",
    ...(def.description ? { description: def.description } : {}),
    version: 1,
    children: { policy: "none" },
    props,
    render: { mode: "live" },
  };
}

// ---------------------------------------------------------------------------
// Eject: studio definition → defineMDMX TSX source
// ---------------------------------------------------------------------------
