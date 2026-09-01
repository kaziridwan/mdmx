export {
  MDMX_SPEC_VERSION,
  MDMX_REGISTRY_VERSION,
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
  RenderSpec,
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

export { validateTree, validateSource, validateDocument } from "./validate.js";
export type { ValidateDocumentOptions } from "./validate.js";
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
  isFileDelete,
  readBytes,
  readText,
} from "./provider.js";
export type {
  CommitOptions,
  CommitResult,
  ContentProvider,
  FileChange,
  FileDelete,
  FileMeta,
  FileWrite,
  ReadOptions,
} from "./provider.js";

// Component Studio moved to @mdmx/studio (ADR-045).
