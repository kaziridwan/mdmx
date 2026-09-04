import type { ComponentSpec, ControlSpec, JsonValue, PropSpec } from "@mdmx/core";

/**
 * Coerce a raw form-input value into the JSON value a prop should hold, given
 * its control type. Pure (no DOM) so it is unit-testable; the scalar controls
 * use it before emitting a typed value. Returning `undefined` means "no
 * value" → the prop is dropped from the props object.
 */
export function coerceControlValue(
  control: ControlSpec,
  raw: string,
): JsonValue | undefined {
  switch (control.type) {
    case "number": {
      if (raw.trim() === "") return undefined;
      const n = Number(raw);
      return Number.isNaN(n) ? undefined : n;
    }
    case "boolean":
      return raw === "true";
    case "json": {
      if (raw.trim() === "") return undefined;
      try {
        return JSON.parse(raw) as JsonValue;
      } catch {
        return undefined;
      }
    }
    case "multiselect":
      // Comma-separated; empty → undefined.
      return raw.trim() === ""
        ? undefined
        : raw.split(",").map((s) => s.trim()).filter(Boolean);
    case "select":
    case "text":
    case "textarea":
    case "color":
    case "date":
    case "image":
    case "link":
      return raw === "" ? undefined : raw;
    default:
      return raw === "" ? undefined : raw;
  }
}

/**
 * String form of a stored prop value for display in an input. Must stay the
 * inverse of `coerceControlValue` for the same control: a multiselect array
 * displays comma-joined (JSON here would re-coerce into corrupted entries).
 */
export function displayControlValue(
  value: JsonValue | undefined,
  control?: ControlSpec,
): string {
  if (value === undefined || value === null) return "";
  if (control?.type === "multiselect" && Array.isArray(value)) {
    return value.map((v) => String(v)).join(", ");
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * Update one entry in a props object, dropping keys whose value is undefined
 * (so optional props don't serialize as empty). Never mutates input.
 */
export function setPropValue(
  props: Record<string, JsonValue>,
  spec: PropSpec,
  value: JsonValue | undefined,
): Record<string, JsonValue> {
  const next = { ...props };
  if (value === undefined) {
    delete next[spec.name];
  } else {
    next[spec.name] = value;
  }
  return next;
}

/**
 * The props as the component sees them: every `default`, overlaid by what
 * the content actually sets. What the panel displays and what `showIf`
 * rules are evaluated against (ADR-058).
 */
export function effectiveProps(
  spec: ComponentSpec,
  props: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const p of spec.props) {
    if (p.default !== undefined) out[p.name] = p.default;
  }
  return { ...out, ...props };
}

/** The value a new list item / cleared composite member starts with, per control kind. */
export function emptyValueFor(control: ControlSpec): JsonValue {
  switch (control.type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "json":
      return null;
    case "list":
    case "multiselect":
      return [];
    case "object":
      return {};
    case "select":
      return control.options[0] ?? "";
    default:
      return "";
  }
}
