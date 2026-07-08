// @mdmx/dashboard — client surface.
// The Next.js server glue (page factory, handler re-exports) lives under
// `@mdmx/dashboard/next`.
export { DashboardApp } from "./DashboardApp.js";
export { AuthGate } from "./shell/AuthGate.js";
export { DashboardShell } from "./shell/DashboardShell.js";
export { HomeView } from "./views/HomeView.js";
export { resolveRoute, routeHref, editorHref } from "./routes.js";
export type { DashboardRoute } from "./routes.js";
export { DashboardContext, useDashboard } from "./context.js";
export type { DashboardContextValue } from "./context.js";
export { resolveConfig } from "./config.js";
export type { DashboardConfig, ResolvedDashboardConfig } from "./config.js";
export {
  createApiClient,
  ApiError,
  UnauthorizedError,
} from "./api-client.js";
export type { ApiClient, Me, FileEntry, FileContent, SaveResult } from "./api-client.js";
