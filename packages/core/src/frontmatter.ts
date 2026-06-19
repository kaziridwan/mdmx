import YAML from "yaml";
import type {
  CollectionSpec,
  ControlSpec,
  Diagnostic,
  JsonValue,
} from "./types.js";

/** Parse a frontmatter YAML block (the text between the `---` fences). */
export function parseFrontmatter(text: string): Record<string, JsonValue> {
  if (text.trim() === "") return {};
  const parsed = YAML.parse(text) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, JsonValue>)
    : {};
}

/**
 * Pinned YAML emission options. These define the byte-format of edited
 * frontmatter and are part of the canonical contract — changing them dirties
 * diffs on the next save, so treat as **semver-major** (see Invariants).
 */
export const CANONICAL_YAML_OPTIONS = { lineWidth: 0 };

/**
 * Canonical YAML for a frontmatter object — what the editor emits when
 * frontmatter is edited through the panel. Known fields are emitted first in
 * `fieldOrder`, then remaining keys in insertion order, so a single field edit
 * is a minimal diff. Returns the inner block (no `---` fences, no trailing
 * newline) to match how mdast stores the yaml node value.
 */
export function stringifyFrontmatter(
  data: Record<string, JsonValue>,
  fieldOrder: readonly string[] = [],
): string {
  const ordered: Record<string, JsonValue> = {};
  for (const key of fieldOrder) {
    if (key in data && data[key] !== undefined) ordered[key] = data[key]!;
  }
  for (const key of Object.keys(data)) {
    if (!(key in ordered) && data[key] !== undefined) ordered[key] = data[key]!;
  }
  if (Object.keys(ordered).length === 0) return "";
  return YAML.stringify(ordered, CANONICAL_YAML_OPTIONS).replace(/\n$/, "");
}

/**
 * Validate a document's frontmatter against its collection schema. Declared
 * fields are checked for presence (if required) and value/type; undeclared keys
 * are allowed (reserved keys, per-doc extras). Codes: IMDX008 (required field
 * missing), IMDX009 (value doesn't match the field's control).
 */
export function validateFrontmatter(
  frontmatter: Record<string, unknown>,
  collection: CollectionSpec,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const field of collection.fields) {
    const value = frontmatter[field.name];
    const empty = value === undefined || value === null || value === "";
    if (empty) {
      if (field.required) {
        out.push({
          code: "IMDX008",
          severity: "error",
          message: `Missing required frontmatter field "${field.name}".`,
        });
      }
      continue;
    }
    if (!valueMatchesControl(value, field.control)) {
      out.push({
        code: "IMDX009",
        severity: "error",
        message: describeMismatch(field.name, field.control, value),
      });
    }
  }
  return out;
}

function valueMatchesControl(value: unknown, control: ControlSpec): boolean {
  switch (control.type) {
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "select":
      return typeof value === "string" && control.options.includes(value);
    case "multiselect":
      return (
        Array.isArray(value) &&
        value.every((v) => typeof v === "string" && control.options.includes(v))
      );
    case "list":
      return Array.isArray(value);
    case "object":
    case "json":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      // text | textarea | color | date | image | link
      return typeof value === "string";
  }
}

function describeMismatch(name: string, control: ControlSpec, value: unknown): string {
  if (control.type === "select") {
    const opts = control.options.map((o) => `"${o}"`).join(", ");
    return `Frontmatter field "${name}" must be one of ${opts} (got ${JSON.stringify(value)}).`;
  }
  return `Frontmatter field "${name}" must be of type ${control.type} (got ${typeof value}).`;
}
