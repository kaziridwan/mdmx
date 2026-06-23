import type { ComponentSpec } from "@mdmx/core";

/** Default group label for components without a `category`. */
export const DEFAULT_CATEGORY = "Components";

/**
 * Filter components by a query, matched case-insensitively against the name,
 * category, and description. Empty/whitespace query returns all. Pure.
 */
export function filterComponents(
  components: readonly ComponentSpec[],
  query: string,
): ComponentSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...components];
  return components.filter((c) => {
    const hay = `${c.name} ${c.category ?? ""} ${c.description ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Group components by `category`, preserving first-appearance order of both the
 * categories and the components within them. Pure.
 */
export function groupByCategory(
  components: readonly ComponentSpec[],
): [string, ComponentSpec[]][] {
  const order: string[] = [];
  const groups = new Map<string, ComponentSpec[]>();
  for (const spec of components) {
    const key = spec.category ?? DEFAULT_CATEGORY;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(spec);
  }
  return order.map((key) => [key, groups.get(key)!]);
}
