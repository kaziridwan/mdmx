// @imdx/next — Next.js integration layer.
// Implemented: LocalProvider, content readers, sessions, GitHub OAuth,
// API route handlers (web-standard Request/Response).
// Pending: the editor mount page (catch-all UI route).
export { LocalProvider, gitBlobSha } from "./local-provider.js";
export { getDocuments, getDocumentBySlug } from "./content.js";
export type { IMDXDocument, GetDocumentsOptions } from "./content.js";
export { createIMDXHandlers } from "./api.js";
export type { IMDXHandlerOptions, IMDXHandlers } from "./api.js";
export { authorizeUrl, exchangeCode, verifyRepoAccess, AuthError } from "./auth.js";
export type { AuthConfig } from "./auth.js";
export { seal, unseal, parseCookies, serializeCookie, clearCookie } from "./session.js";
export type { SessionData } from "./session.js";
