export {
  MDMX_SPEC_VERSION,
  MDMX_META,
  Registry,
  collectionForPath,
  defineMDMX,
} from "./types.js";
export type {
  ChildrenPolicy,
  CollectionSpec,
  ComponentConstraints,
  ComponentSpec,
  ControlSpec,
  DefineMDMXConfig,
  Diagnostic,
  DiagnosticCode,
  FrontmatterField,
  JsonValue,
  PropSpec,
  PropsObject,
  RegistrySpec,
  RenderMode,
  SourcePosition,
  SourceSpan,
} from "./types.js";

export {
  collectionsFromConfig,
  collectionFromConfig,
  collectionToConfig,
  validateCollectionConfig,
} from "./collections-config.js";
export type {
  CollectionConfig,
  CollectionFieldConfig,
  CollectionsConfig,
} from "./collections-config.js";

export { createParser, parseMDX, parseDocument } from "./parse.js";
export type { ParsedDocument } from "./parse.js";

export {
  parseFrontmatter,
  stringifyFrontmatter,
  validateFrontmatter,
  CANONICAL_YAML_OPTIONS,
} from "./frontmatter.js";

export { evaluateAttributes, evaluateExpression } from "./props.js";
export type { EvaluatedProps } from "./props.js";

export { validateTree, validateSource } from "./validate.js";
export type { ValidateOptions } from "./validate.js";

export {
  toMDX,
  CANONICAL_STRINGIFY_OPTIONS,
  CANONICAL_MDX_OPTIONS,
} from "./serialize.js";

export {
  ConflictError,
  PathSafetyError,
  assertSafePath,
} from "./provider.js";
export type {
  CommitOptions,
  CommitResult,
  ContentProvider,
  FileChange,
  FileMeta,
} from "./provider.js";

export {
  STUDIO_COMPONENTS_DIR,
  STUDIO_CATEGORY,
  STUDIO_ALLOWED_TAGS,
  STUDIO_ALLOWED_ATTRS,
  studioComponentPath,
  studioComponentToSpec,
  validateStudioComponent,
  parseStudioComponent,
  interpolatedProps,
} from "./studio.js";
export type {
  StudioComponentDef,
  StudioPropDef,
  StudioPropType,
  TemplateChild,
  TemplateElement,
  TemplateSlot,
  TemplateText,
} from "./studio.js";
export { studioComponentToTSX } from "./studio.js";
