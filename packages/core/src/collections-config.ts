import type {
  CollectionSpec,
  ControlSpec,
  FrontmatterField,
  JsonValue,
} from "./types.js";

/**
 * The `collections` block of `mdmx.config.json`, as authored: collections and
 * fields are records keyed by name. This is the persistent, git-committed
 * source of truth; `CollectionSpec[]` (array form, used by the registry and
 * validators) is derived from it. `mdmx generate` bakes the derived form into
 * `.mdmx/registry.json`, and `@mdmx/next` derives it again at request time so
 * dashboard-created collections are live without a rebuild (ADR-035).
 */
export interface CollectionFieldConfig {
  control: ControlSpec;
  required?: boolean;
  default?: JsonValue;
  description?: string;
}

export interface CollectionConfig {
  /** Content directory for this collection, relative to the project root. */
  dir: string;
  fields: Record<string, CollectionFieldConfig>;
}

export type CollectionsConfig = Record<string, CollectionConfig>;

/** Derive the registry's array form from the config's record form (name-sorted). */
export function collectionsFromConfig(
  collections: CollectionsConfig | undefined,
): CollectionSpec[] {
  const out: CollectionSpec[] = [];
  for (const [name, c] of Object.entries(collections ?? {})) {
    out.push(collectionFromConfig(name, c));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectionFromConfig(name: string, c: CollectionConfig): CollectionSpec {
  const fields: FrontmatterField[] = Object.entries(c.fields ?? {}).map(
    ([fname, f]) => ({
      name: fname,
      required: f.required ?? false,
      control: f.control,
      ...(f.default !== undefined ? { default: f.default } : {}),
      ...(f.description ? { description: f.description } : {}),
    }),
  );
  return { name, dir: c.dir, fields };
}

/** Convert a spec back to the config's record form (for writing the file). */
export function collectionToConfig(spec: CollectionSpec): CollectionConfig {
  const fields: Record<string, CollectionFieldConfig> = {};
  for (const f of spec.fields) {
    fields[f.name] = {
      control: f.control,
      ...(f.required ? { required: true } : {}),
      ...(f.default !== undefined ? { default: f.default } : {}),
      ...(f.description ? { description: f.description } : {}),
    };
  }
  return { dir: spec.dir, fields };
}

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
const CONTROL_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "boolean",
  "select",
  "multiselect",
  "color",
  "date",
  "image",
  "link",
  "json",
  "list",
  "object",
]);

/**
 * Validate an authored collection (record form) before it is written to
 * config. Returns human-readable problems; empty means valid. Path-safety of
 * `dir` beyond shape (traversal, containment under the content dir) is the
 * caller's job — it depends on deployment configuration.
 */
export function validateCollectionConfig(
  name: string,
  config: CollectionConfig,
): string[] {
  const errors: string[] = [];
  if (!NAME_RE.test(name)) {
    errors.push(
      `collection name "${name}" must be lowercase alphanumeric with - or _ (got ${JSON.stringify(name)})`,
    );
  }
  if (typeof config.dir !== "string" || config.dir.length === 0) {
    errors.push(`collection "${name}": dir must be a non-empty string`);
  }
  if (config.fields === null || typeof config.fields !== "object") {
    errors.push(`collection "${name}": fields must be an object`);
    return errors;
  }
  for (const [fname, field] of Object.entries(config.fields)) {
    if (!NAME_RE.test(fname)) {
      errors.push(
        `field "${fname}" must be lowercase alphanumeric with - or _ (frontmatter keys stay predictable)`,
      );
    }
    errors.push(...validateControl(`field "${fname}"`, field?.control));
  }
  return errors;
}

function validateControl(where: string, control: unknown): string[] {
  if (control === null || typeof control !== "object") {
    return [`${where}: control must be an object`];
  }
  const c = control as { type?: unknown; options?: unknown; item?: unknown; fields?: unknown };
  if (typeof c.type !== "string" || !CONTROL_TYPES.has(c.type)) {
    return [`${where}: unknown control type ${JSON.stringify(c.type)}`];
  }
  const errors: string[] = [];
  if (c.type === "select" || c.type === "multiselect") {
    if (
      !Array.isArray(c.options) ||
      c.options.length === 0 ||
      c.options.some((o) => typeof o !== "string")
    ) {
      errors.push(`${where}: ${c.type} control needs a non-empty string options array`);
    }
  }
  if (c.type === "list") {
    errors.push(...validateControl(`${where} (list item)`, c.item));
  }
  if (c.type === "object") {
    if (c.fields === null || typeof c.fields !== "object" || Array.isArray(c.fields)) {
      errors.push(`${where}: object control needs a fields record`);
    } else {
      for (const [k, v] of Object.entries(c.fields as Record<string, unknown>)) {
        errors.push(...validateControl(`${where}.${k}`, v));
      }
    }
  }
  return errors;
}
