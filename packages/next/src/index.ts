// @mdmx/next — Next.js integration layer: content providers and readers,
// sessions, the authentication seam, and web-standard API route handlers.
export { LocalProvider, gitBlobSha } from "./local-provider.js";
export { getEntries, getEntryBySlug, getStudioComponentDefs } from "./content.js";
export type { MDMXEntry, GetEntriesOptions } from "./content.js";
export { createMDMXHandlers } from "./api.js";
export type { MDMXHandlerOptions, MDMXHandlers } from "./api.js";

// The auth seam (ADR-046). `auth.ts`'s OAuth functions stay exported for
// consumers driving the flow themselves; most only need a strategy.
export { GitHubOAuthStrategy, LocalAuthStrategy } from "./auth-strategy.js";
export type {
  AuthIdentity,
  AuthStrategy,
  BeginLoginContext,
  CompleteLoginContext,
} from "./auth-strategy.js";
export { authorizeUrl, exchangeCode, verifyRepoAccess, AuthError } from "./auth.js";
export type { AuthConfig } from "./auth.js";

export {
  seal,
  unseal,
  parseCookies,
  serializeCookie,
  clearCookie,
  SESSION_COOKIE,
} from "./session.js";
export type { SessionData } from "./session.js";
export { getSession, privateHref } from "./guard.js";
export type { GetSessionOptions } from "./guard.js";
