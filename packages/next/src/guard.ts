import { parseCookies, unseal, SESSION_COOKIE, type SessionData } from "./session.js";

/**
 * Viewer-side session guard for private pages (draft | private | published,
 * ADR: road-to-0.4.1). "Authenticated" means the same MDMX session the
 * dashboard uses: the GitHub-OAuth sealed cookie in GitHub mode, or the
 * synthetic "local" session in localMode. Web-standard inputs only (a Cookie
 * header string), so it works in App Router server components, route
 * handlers, and middleware alike:
 *
 *   const session = getSession((await cookies()).toString(), {
 *     localMode: true,                       // or { sessionSecret }
 *   });
 *   if (!session) redirect("/mdmx");
 */
export interface GetSessionOptions {
  /** Secret the session cookie was sealed with — required unless localMode. */
  sessionSecret?: string;
  /** Local development: every viewer is the synthetic "local" session. */
  localMode?: boolean;
  now?: () => number;
}

export function getSession(
  cookieHeader: string | null | undefined,
  options: GetSessionOptions,
): SessionData | null {
  const now = options.now ?? (() => Date.now());
  if (options.localMode) {
    return { login: "local", token: "", expiresAt: now() + 60_000, verifiedAt: now() };
  }
  if (!options.sessionSecret) return null;
  const sealed = parseCookies(cookieHeader ?? null)[SESSION_COOKIE];
  return sealed ? unseal(sealed, options.sessionSecret, now) : null;
}

/**
 * The public URL a `private` entry is served under: `/private/<collection
 * path>/<slug>`, e.g. posts/welcome → /private/posts/welcome. `collectionPath`
 * is the collection's directory relative to the content dir (`posts`, not
 * `content/posts` — pass nested paths as-is: `guides/api`).
 */
export function privateHref(collectionPath: string, slug: string): string {
  const segments = [...collectionPath.split("/"), slug]
    .filter((s) => s.length > 0)
    .map(encodeURIComponent);
  return "/private/" + segments.join("/");
}
