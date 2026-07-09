/**
 * The dashboard is one optional catch-all route; the slug segments select a
 * view. Kept as a pure function so the mapping is testable without React.
 *
 *   /mdmx                          → home
 *   /mdmx/collections/new         → create a collection
 *   /mdmx/collections/:name       → entry list for a collection
 *   /mdmx/collections/:name/edit  → edit the collection's schema
 *   /mdmx/collections/:name/new   → scaffold a new entry
 *   /mdmx/edit/<content path>     → entry editor for content/<path>
 *   /mdmx/media                   → media library
 *   /mdmx/studio                  → component studio (list)
 *   /mdmx/studio/new              → create a studio component
 *   /mdmx/studio/:name            → edit a studio component
 *   /mdmx/settings                → settings
 */
export type DashboardRoute =
  | { view: "home" }
  | { view: "collection-new" }
  | { view: "collection"; name: string }
  | { view: "collection-edit"; name: string }
  | { view: "entry-new"; collection: string }
  | { view: "editor"; path: string[] }
  | { view: "media" }
  | { view: "studio" }
  | { view: "studio-new" }
  | { view: "studio-edit"; name: string }
  | { view: "settings" }
  | { view: "not-found"; slug: string[] };

export function resolveRoute(slug: readonly string[]): DashboardRoute {
  const [head, ...rest] = slug;
  if (head === undefined) return { view: "home" };

  if (head === "collections") {
    const [name, action, ...extra] = rest;
    if (name === undefined) return { view: "home" };
    if (name === "new" && action === undefined) return { view: "collection-new" };
    if (action === undefined) return { view: "collection", name };
    if (action === "edit" && extra.length === 0) return { view: "collection-edit", name };
    if (action === "new" && extra.length === 0) return { view: "entry-new", collection: name };
    return { view: "not-found", slug: [...slug] };
  }

  if (head === "edit" && rest.length > 0) return { view: "editor", path: rest };
  if (head === "media" && rest.length === 0) return { view: "media" };
  if (head === "studio") {
    const [name, ...extra] = rest;
    if (name === undefined) return { view: "studio" };
    if (extra.length > 0) return { view: "not-found", slug: [...slug] };
    if (name === "new") return { view: "studio-new" };
    return { view: "studio-edit", name };
  }
  if (head === "settings" && rest.length === 0) return { view: "settings" };

  return { view: "not-found", slug: [...slug] };
}

/** Build hrefs for dashboard navigation from the configured mount path. */
export function routeHref(mountPath: string, ...segments: string[]): string {
  const clean = segments.filter((s) => s.length > 0).map(encodeURIComponent);
  return [mountPath, ...clean].join("/") || "/";
}

/** Href for editing a content file (path segments are kept readable). */
export function editorHref(mountPath: string, path: string): string {
  return `${mountPath}/edit/${path.split("/").map(encodeURIComponent).join("/")}`;
}
