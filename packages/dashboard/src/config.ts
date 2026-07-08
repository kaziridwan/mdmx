/**
 * Dashboard configuration. Everything is optional — the defaults match the
 * canonical mount (`/mdmx` page + `/api/mdmx` API) and the standard project
 * layout, so `createDashboardPage()` with no arguments is a working CMS.
 *
 * The resolved form crosses the server→client boundary, so it must stay
 * JSON-serializable.
 */
export interface DashboardConfig {
  /** Route prefix the MDMX API handlers are mounted under. */
  basePath?: string;
  /** Route the dashboard page itself is mounted at (used to build links). */
  mountPath?: string;
  /** Directory holding MDMX content, repo-relative. */
  contentDir?: string;
  /** Directory media uploads live under, repo-relative. */
  mediaDir?: string;
  /** Path to the generated registry JSON, relative to the project root. */
  registryPath?: string;
  /** Product name shown in the top navbar. */
  title?: string;
}

export type ResolvedDashboardConfig = Required<DashboardConfig>;

export function resolveConfig(config: DashboardConfig = {}): ResolvedDashboardConfig {
  return {
    basePath: "/api/mdmx",
    mountPath: "/mdmx",
    contentDir: "content",
    mediaDir: "public/media",
    registryPath: ".mdmx/registry.json",
    title: "MDMX",
    ...config,
  };
}
