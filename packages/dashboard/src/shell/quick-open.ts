import type { CollectionSpec } from "@mdmx/core";
import type { EntryMeta } from "../api-client.js";
import { editorHref, routeHref } from "../routes.js";

/** One row in the quick-open palette. */
export interface QuickOpenItem {
  kind: "entry" | "collection" | "page" | "action";
  label: string;
  /** Secondary line (path, dir). Also searched. */
  detail?: string;
  href: string;
}

/** Static navigation targets + one row per collection. */
export function navigationItems(
  mountPath: string,
  collections: readonly CollectionSpec[],
): QuickOpenItem[] {
  return [
    ...collections.map(
      (c): QuickOpenItem => ({
        kind: "collection",
        label: c.name,
        detail: c.dir,
        href: routeHref(mountPath, "collections", c.name),
      }),
    ),
    { kind: "page", label: "Media", href: routeHref(mountPath, "media") },
    { kind: "page", label: "Settings", href: routeHref(mountPath, "settings") },
    {
      kind: "action",
      label: "New collection",
      href: routeHref(mountPath, "collections", "new"),
    },
    ...collections.map(
      (c): QuickOpenItem => ({
        kind: "action",
        label: `New ${c.name} entry`,
        href: routeHref(mountPath, "collections", c.name, "new"),
      }),
    ),
  ];
}

export function entryItems(
  mountPath: string,
  entries: readonly EntryMeta[],
): QuickOpenItem[] {
  return entries.map((entry) => {
    const title = entry.frontmatter.title;
    return {
      kind: "entry",
      label:
        typeof title === "string" && title.length > 0
          ? title
          : (entry.path.split("/").pop() ?? entry.path),
      detail: entry.path,
      href: editorHref(mountPath, entry.path),
    };
  });
}

/**
 * Score `query` against `text`: exact prefix beats word-prefix beats
 * substring; 0 means no match. Case-insensitive.
 */
export function scoreMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return 1;
  if (t.startsWith(q)) return 100 - Math.min(50, t.length - q.length);
  const word = t.search(new RegExp(`[\\s\\-_/.]${escapeRe(q[0]!)}`));
  if (word >= 0 && t.slice(word + 1).startsWith(q)) return 40;
  if (t.includes(q)) return 20;
  return 0;
}

function escapeRe(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rank items for a query: label matches outrank detail matches. */
export function filterItems(
  items: readonly QuickOpenItem[],
  query: string,
  limit = 12,
): QuickOpenItem[] {
  const trimmed = query.trim();
  if (trimmed === "") return items.slice(0, limit);
  return items
    .map((item) => {
      const label = scoreMatch(trimmed, item.label);
      const detail = item.detail ? scoreMatch(trimmed, item.detail) : 0;
      return { item, score: Math.max(label * 2, detail) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
