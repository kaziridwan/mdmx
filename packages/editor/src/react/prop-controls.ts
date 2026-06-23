import type { ControlSpec, JsonValue, PropSpec } from "@mdmx/core";

/**
 * Coerce a raw form-input value into the JSON value a prop should hold, given
 * its control type. Pure (no DOM) so it is unit-testable; the prop panel uses
 * it before writing the single `props` attr. Returning `undefined` means "no
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

/** String form of a stored prop value for display in an input. */
export function displayControlValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * Update one entry in a props object, dropping keys whose value coerces to
 * undefined (so optional props don't serialize as empty). Never mutates input.
 */
export function setPropValue(
  props: Record<string, JsonValue>,
  spec: PropSpec,
  raw: string,
): Record<string, JsonValue> {
  const next = { ...props };
  const value = coerceControlValue(spec.control, raw);
  if (value === undefined) {
    delete next[spec.name];
  } else {
    next[spec.name] = value;
  }
  return next;
}
