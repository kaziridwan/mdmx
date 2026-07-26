/**
 * @mdmx/studio — the Component Studio feature: model, validation, registry
 * integration, eject codegen, and (via `@mdmx/studio/react`) the single
 * template→React renderer.
 *
 * Depends only on `@mdmx/core`; core never imports studio. The registry merge
 * is performed by callers (CLI, Next.js runtime), which is what keeps the
 * dependency graph acyclic — see ADR-045.
 */

export {
  parseStudioComponent,
  STUDIO_COMPONENTS_DIR,
  studioComponentPath,
} from "./model.js";
export type {
  StudioComponentDef,
  StudioPropDef,
  StudioPropType,
  TemplateChild,
  TemplateElement,
  TemplateSlot,
  TemplateText,
} from "./model.js";

export {
  HAS_INTERPOLATION_RE,
  INTERPOLATION_RE,
  interpolate,
  interpolatedProps,
} from "./interpolate.js";

export {
  STUDIO_ALLOWED_ATTRS,
  STUDIO_ALLOWED_TAGS,
  validateStudioComponent,
} from "./validate.js";

export { STUDIO_CATEGORY, studioComponentToSpec } from "./spec.js";
export { mergeStudioSpecs } from "./merge.js";
export { studioComponentToTSX } from "./eject.js";
