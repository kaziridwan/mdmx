// @mdmx/dashboard — the drop-in CMS surface.
//
// Deliberately small (ADR-048): the mount factory lives in
// `@mdmx/dashboard/next`, and the shell/views/api-client are internal until a
// real consumer needs them. Un-exporting after publish is breaking; adding an
// export later is free.
export { DashboardApp } from "./DashboardApp.js";
export { resolveConfig } from "./config.js";
export type { DashboardConfig, ResolvedDashboardConfig } from "./config.js";
export type { DashboardRoute } from "./routes.js";
