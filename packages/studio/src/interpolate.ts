import type { JsonValue } from "@mdmx/core";

/**
 * `{props.<name>}` interpolation — the one implementation.
 *
 * This existed three times before the studio package (core's validator, the
 * Next.js renderer, and the dashboard preview), because core has to stay
 * React-free and so could never host the renderer that the other two needed.
 * A package can hold both, so the semantics have a single home (ADR-045).
 */
export const INTERPOLATION_RE = /\{props\.([A-Za-z0-9]+)\}/g;

/** Non-global twin — `.test()` on a /g regex is stateful. */
export const HAS_INTERPOLATION_RE = /\{props\.[A-Za-z0-9]+\}/;

/** Prop names referenced by `{props.x}` interpolations in a string. */
export function interpolatedProps(value: string): string[] {
  const out: string[] = [];
  for (const match of value.matchAll(INTERPOLATION_RE)) out.push(match[1]!);
  return out;
}

/** Substitute `{props.x}` references; nullish values render as empty. */
export function interpolate(value: string, props: Record<string, JsonValue>): string {
  return value.replace(INTERPOLATION_RE, (_, name: string) => {
    const v = props[name];
    return v == null ? "" : String(v);
  });
}
