/**
 * `@mdmx/next` — Next.js integration: content providers, entry readers,
 * sessions, the authentication seam, and web-standard API route handlers.
 *
 * Pruned for 0.5: the session crypto (`seal`/`unseal`), cookie helpers, and
 * the raw OAuth calls had no consumers outside this package, and publishing
 * them froze internals — `serializeCookie` in particular is a footgun in
 * userland. `AuthStrategy` is the supported way to reach the auth flow.
 */
export { LocalProvider } from "./local-provider.js";
export { getEntries, getEntryBySlug, getStudioComponentDefs } from "./content.js";
export type { MDMXEntry, GetEntriesOptions } from "./content.js";
export { createMDMXHandlers } from "./api.js";
export type { MDMXHandlerOptions, MDMXHandlers } from "./api.js";

// The auth seam (ADR-046) — implement this to support another git host.
export { GitHubOAuthStrategy, LocalAuthStrategy } from "./auth-strategy.js";
export type {
  AuthIdentity,
  AuthStrategy,
  BeginLoginContext,
  CompleteLoginContext,
} from "./auth-strategy.js";
export { AuthError } from "./auth.js";
export type { AuthConfig } from "./auth.js";

export type { SessionData } from "./session.js";
// Viewer-side guard for private entries on the public site.
export { getSession, privateHref } from "./guard.js";
export type { GetSessionOptions } from "./guard.js";
