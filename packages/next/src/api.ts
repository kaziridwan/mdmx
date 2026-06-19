import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import {
  assertSafePath,
  ConflictError,
  parseDocument,
  PathSafetyError,
  validateFrontmatter,
  validateSource,
  type ContentProvider,
  type Diagnostic,
  type Registry,
} from "@imdx/core";
import {
  AuthError,
  authorizeUrl,
  exchangeCode,
  verifyRepoAccess,
  type AuthConfig,
} from "./auth.js";
import {
  clearCookie,
  parseCookies,
  seal,
  serializeCookie,
  unseal,
  type SessionData,
} from "./session.js";

export interface IMDXHandlerOptions {
  repo: { owner: string; name: string; branch: string };
  contentDir: string;
  mediaDir: string;
  /** OAuth config — required unless `localMode` is set. */
  auth?: Omit<AuthConfig, "repo">;
  /** Session-seal secret — required unless `localMode` is set. */
  sessionSecret?: string;
  /**
   * Local development mode: skip GitHub OAuth entirely and run every request as
   * a synthetic "local" session. Pair with a `LocalProvider` so saves write to
   * the working tree. Validation, path-safety, CSRF, and conflict checks still
   * apply. Never enable in production.
   */
  localMode?: boolean;
  /** Build a provider for a session (tests inject LocalProvider). */
  createProvider: (session: SessionData) => ContentProvider;
  /** Validate .mdx saves against this registry when present. */
  registry?: Registry;
  /** "strict": reject saves with error diagnostics (422). "report": save and return them. */
  validation?: "strict" | "report";
  /** Route prefix the handlers are mounted under. */
  basePath?: string;
  /** Where to send the user after login. */
  editorPath?: string;
  /** Allow non-HTTPS cookies (development). */
  insecureCookies?: boolean;
  maxMediaBytes?: number;
  now?: () => number;
}

const SESSION_COOKIE = "imdx_session";
const STATE_COOKIE = "imdx_oauth_state";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const REVERIFY_MS = 5 * 60 * 1000;
const MEDIA_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif"]);

type Handler = (req: Request) => Promise<Response>;

export interface IMDXHandlers {
  GET: Handler;
  POST: Handler;
  PUT: Handler;
  DELETE: Handler;
}

/**
 * Create web-standard route handlers. In Next.js App Router:
 *
 *   // app/api/imdx/[...route]/route.ts
 *   export const { GET, POST, PUT, DELETE } = createIMDXHandlers({ ... })
 */
export function createIMDXHandlers(options: IMDXHandlerOptions): IMDXHandlers {
  const o = {
    basePath: "/api/imdx",
    editorPath: "/imdx",
    validation: "report" as const,
    maxMediaBytes: 10 * 1024 * 1024,
    now: () => Date.now(),
    ...options,
  };
  const authConfig: AuthConfig = o.auth
    ? { ...o.auth, repo: { owner: o.repo.owner, name: o.repo.name } }
    : (undefined as unknown as AuthConfig);
  const secure = !o.insecureCookies;

  const handle: Handler = async (req) => {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(o.basePath)) return json(404, { error: "not found" });
    const route = url.pathname.slice(o.basePath.length).replace(/\/$/, "") || "/";
    const method = req.method.toUpperCase();

    try {
      // ---- auth routes (no session required) ------------------------------
      if (route === "/auth/login" && method === "GET") return await login(url);
      if (!o.localMode && route === "/auth/callback" && method === "GET") {
        return await callback(req, url);
      }
      if (route === "/auth/logout" && method === "POST") {
        return json(200, { ok: true }, o.localMode ? {} : { "set-cookie": clearCookie(SESSION_COOKIE) });
      }

      // ---- everything else requires a session -----------------------------
      const guard = await requireSession(req);
      if (guard.response) return guard.response;
      const { session, refreshedCookie } = guard;
      const withSession = (res: Response): Response => {
        if (refreshedCookie) res.headers.append("set-cookie", refreshedCookie);
        return res;
      };

      // CSRF: mutations must come from our own origin when Origin is present.
      if (method !== "GET") {
        const origin = req.headers.get("origin");
        if (origin && origin !== url.origin) {
          return json(403, { error: "cross-origin request rejected" });
        }
      }

      const provider = o.createProvider(session);

      if (route === "/me" && method === "GET") {
        return withSession(json(200, { login: session.login, repo: o.repo }));
      }

      if (route === "/files" && method === "GET") {
        const dir = checkPrefix(url.searchParams.get("dir") ?? o.contentDir);
        return withSession(json(200, { files: await provider.list(dir) }));
      }

      if (route === "/file" && method === "GET") {
        const path = checkPrefix(url.searchParams.get("path") ?? "");
        const file = await provider.read(path);
        return withSession(json(200, { path, ...file }));
      }

      if (route === "/file" && method === "PUT") {
        const body = (await req.json()) as {
          path: string;
          content: string;
          message?: string;
          expectedSha?: string | null;
        };
        const path = checkPrefix(body.path);
        if (typeof body.content !== "string") {
          return json(400, { error: "content must be a string" });
        }

        let diagnostics: Diagnostic[] = [];
        if (/\.mdx?$/.test(path) && o.registry) {
          // Never trust the editor client: re-validate on the server. A parse
          // failure (malformed MDX) is a client error, not a 500.
          try {
            diagnostics = validateSource(body.content, { registry: o.registry });
            const collection = o.registry.collectionForPath(path);
            if (collection) {
              const { frontmatter } = parseDocument(body.content);
              diagnostics = diagnostics.concat(validateFrontmatter(frontmatter, collection));
            }
          } catch (parseErr) {
            return withSession(
              json(400, { error: "could not parse iMDX", detail: (parseErr as Error).message }),
            );
          }
          const hasErrors = diagnostics.some((d) => d.severity === "error");
          if (o.validation === "strict" && hasErrors) {
            return withSession(json(422, { error: "validation failed", diagnostics }));
          }
        }

        const result = await provider.commit(
          [{ path, content: body.content }],
          body.message ?? `imdx: update ${path}`,
          body.expectedSha !== undefined
            ? { expectedShas: { [path]: body.expectedSha } }
            : undefined,
        );
        return withSession(json(200, { commit: result, diagnostics }));
      }

      if (route === "/file" && method === "DELETE") {
        const body = (await req.json()) as {
          path: string;
          message?: string;
          expectedSha?: string | null;
        };
        const path = checkPrefix(body.path);
        const result = await provider.delete(
          path,
          body.message ?? `imdx: delete ${path}`,
          body.expectedSha !== undefined
            ? { expectedShas: { [path]: body.expectedSha } }
            : undefined,
        );
        return withSession(json(200, { commit: result }));
      }

      if (route === "/media" && method === "POST") {
        const body = (await req.json()) as {
          path: string;
          dataBase64: string;
          message?: string;
        };
        const path = assertSafePath(body.path);
        if (!within(path, o.mediaDir)) {
          return json(400, { error: `media must live under ${o.mediaDir}/` });
        }
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        if (!MEDIA_EXTENSIONS.has(ext)) {
          return json(400, { error: `unsupported media type ".${ext}"` });
        }
        const bytes = Buffer.from(body.dataBase64, "base64");
        if (bytes.length === 0) return json(400, { error: "empty media payload" });
        if (bytes.length > o.maxMediaBytes) {
          return json(413, { error: `media exceeds ${o.maxMediaBytes} bytes` });
        }
        const result = await provider.commit(
          [{ path, content: new Uint8Array(bytes) }],
          body.message ?? `imdx: add media ${path}`,
          { expectedShas: { [path]: null } }, // never overwrite media silently
        );
        return withSession(json(201, { commit: result, path }));
      }

      return json(404, { error: `no route ${method} ${route}` });
    } catch (err) {
      if (err instanceof ConflictError) {
        return json(409, { error: err.message, path: err.path });
      }
      if (err instanceof PathSafetyError) return json(400, { error: err.message });
      if (err instanceof AuthError) return json(err.status, { error: err.message });
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        return json(404, { error: "file not found" });
      }
      // Provider errors that carry an HTTP status (e.g. GitHubApiError).
      const status = (err as { status?: unknown })?.status;
      if (typeof status === "number" && status >= 400 && status < 600) {
        return json(status, { error: (err as Error).message });
      }
      throw err;
    }
  };

  // -- auth flow ---------------------------------------------------------------

  async function login(url: URL): Promise<Response> {
    if (o.localMode) {
      return new Response(null, { status: 302, headers: { location: o.editorPath } });
    }
    const state = randomBytes(16).toString("base64url");
    const redirectUri = `${url.origin}${o.basePath}/auth/callback`;
    return new Response(null, {
      status: 302,
      headers: {
        location: authorizeUrl(authConfig, redirectUri, state),
        "set-cookie": serializeCookie(STATE_COOKIE, state, { maxAge: 600, secure }),
      },
    });
  }

  async function callback(req: Request, url: URL): Promise<Response> {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookies = parseCookies(req.headers.get("cookie"));
    if (!code || !state || cookies[STATE_COOKIE] !== state) {
      return json(400, { error: "invalid OAuth state" });
    }
    const redirectUri = `${url.origin}${o.basePath}/auth/callback`;
    const token = await exchangeCode(authConfig, code, redirectUri);
    const { login } = await verifyRepoAccess(authConfig, token); // throws 403 without push
    const now = o.now();
    const sealed = seal(
      { login, token, expiresAt: now + SESSION_TTL_MS, verifiedAt: now },
      o.sessionSecret!,
    );
    const headers = new Headers({ location: o.editorPath });
    headers.append(
      "set-cookie",
      serializeCookie(SESSION_COOKIE, sealed, { maxAge: SESSION_TTL_MS / 1000, secure }),
    );
    headers.append("set-cookie", clearCookie(STATE_COOKIE));
    return new Response(null, { status: 302, headers });
  }

  async function requireSession(req: Request): Promise<{
    session: SessionData;
    refreshedCookie?: string;
    response?: Response;
  }> {
    if (o.localMode) {
      const now = o.now();
      return {
        session: { login: "local", token: "", expiresAt: now + SESSION_TTL_MS, verifiedAt: now },
      };
    }
    const cookies = parseCookies(req.headers.get("cookie"));
    const session = cookies[SESSION_COOKIE]
      ? unseal(cookies[SESSION_COOKIE]!, o.sessionSecret!, o.now)
      : null;
    if (!session) {
      return {
        session: null as never,
        response: json(401, { error: "authentication required" }, {
          "set-cookie": clearCookie(SESSION_COOKIE),
        }),
      };
    }
    // Collaborators get removed: re-verify permission on a 5-minute cadence.
    if (o.now() - session.verifiedAt > REVERIFY_MS) {
      try {
        await verifyRepoAccess(authConfig, session.token);
      } catch {
        return {
          session: null as never,
          response: json(401, { error: "repository access revoked" }, {
            "set-cookie": clearCookie(SESSION_COOKIE),
          }),
        };
      }
      const refreshed: SessionData = { ...session, verifiedAt: o.now() };
      return {
        session: refreshed,
        refreshedCookie: serializeCookie(SESSION_COOKIE, seal(refreshed, o.sessionSecret!), {
          maxAge: Math.max(1, Math.floor((refreshed.expiresAt - o.now()) / 1000)),
          secure,
        }),
      };
    }
    return { session };
  }

  // -- helpers -------------------------------------------------------------------

  function checkPrefix(path: string): string {
    const safe = assertSafePath(path);
    if (!within(safe, o.contentDir) && !within(safe, o.mediaDir)) {
      throw new PathSafetyError(
        path,
        `must be under ${o.contentDir}/ or ${o.mediaDir}/`,
      );
    }
    return safe;
  }

  return { GET: handle, POST: handle, PUT: handle, DELETE: handle };
}

function within(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir + "/");
}

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
