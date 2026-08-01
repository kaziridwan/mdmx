import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import {
  assertSafePath,
  collectionForPath,
  collectionFromConfig,
  collectionsFromConfig,
  collectionToConfig,
  ConflictError,
  parseDocument,
  PathSafetyError,
  readText,
  Registry,
  validateCollectionConfig,
  validateDocument,
  type CollectionConfig,
  type CollectionFieldConfig,
  type CollectionSpec,
  type CollectionsConfig,
  type ContentProvider,
  type Diagnostic,
} from "@mdmx/core";
import {
  mergeStudioSpecs,
  parseStudioComponent,
  STUDIO_COMPONENTS_DIR,
  studioComponentPath,
  studioComponentToSpec,
  studioComponentToTSX,
  validateStudioComponent,
  type StudioComponentDef,
} from "@mdmx/studio";
import { parseProjectConfig, type MDMXMode, type ProjectConfigFile } from "@mdmx/project";
import { defaultAuthStrategy, resolveSettings, type ResolvedSettings } from "./settings.js";
import { listStudioDefs } from "./routes/context.js";
import { handleStudioRoute } from "./routes/studio.js";
import { gitBlobSha } from "./local-provider.js";
import { AuthError, type AuthConfig } from "./auth.js";
import type { AuthStrategy } from "./auth-strategy.js";
import {
  clearCookie,
  parseCookies,
  seal,
  serializeCookie,
  unseal,
  SESSION_COOKIE,
  type SessionData,
} from "./session.js";

export interface MDMXHandlerOptions {
  /** Repository content is committed to. Defaults to `repo` in the config file. */
  repo?: { owner: string; name: string; branch: string };
  /** Defaults to `contentDir` in the config file ("content"). */
  contentDir?: string;
  /** Defaults to `mediaDir` in the config file ("public/media"). */
  mediaDir?: string;
  /** OAuth config. Convention: read from the environment (ADR-039). */
  auth?: Omit<AuthConfig, "repo">;
  /** Session-seal secret. Convention: `MDMX_SESSION_SECRET`. */
  sessionSecret?: string;
  /**
   * Force a mode instead of detecting it from the environment. `"local"`
   * skips authentication entirely — in production it additionally requires
   * `allowLocalModeInProduction`, because it means unauthenticated writes.
   */
  mode?: MDMXMode;
  /** Opt in to unauthenticated local mode in production. Almost never right. */
  allowLocalModeInProduction?: boolean;
  /**
   * Deprecated alias for `mode: "local"`, kept so existing mounts keep
   * working.
   */
  localMode?: boolean;
  /**
   * Build a provider for a session. Defaults to `LocalProvider` in local mode
   * and `GitHubProvider` (from `@mdmx/provider-github`) in GitHub mode.
   */
  createProvider?: (session: SessionData) => ContentProvider;
  /** How users authenticate (ADR-046); defaults from the resolved mode. */
  authStrategy?: AuthStrategy;
  /** Defaults to the generated registry under the config's `outDir`. */
  registry?: Registry;
  /** Project root config and content are resolved against. Defaults to cwd. */
  root?: string;
  /**
   * Project config file (JSON) collections are resolved from at request time
   * and written back to by the collection routes (ADR-035).
   */
  configPath?: string;
  /** "strict": reject saves with error diagnostics (422). "report": save and return them. */
  validation?: "strict" | "report";
  /** Directory ejected studio components are written to (TSX files). */
  componentsDir?: string;
  /** Route prefix the handlers are mounted under. */
  basePath?: string;
  /** Where to send the user after login. */
  editorPath?: string;
  /** Allow non-HTTPS cookies. Defaults to `NODE_ENV !== "production"`. */
  insecureCookies?: boolean;
  maxMediaBytes?: number;
  now?: () => number;
  /** Environment to resolve secrets from (tests inject one). */
  env?: Record<string, string | undefined>;
}

const STATE_COOKIE = "mdmx_oauth_state";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const REVERIFY_MS = 5 * 60 * 1000;
const MEDIA_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif"]);

type Handler = (req: Request) => Promise<Response>;

export interface MDMXHandlers {
  GET: Handler;
  POST: Handler;
  PUT: Handler;
  DELETE: Handler;
}

/**
 * Create web-standard route handlers. In Next.js App Router:
 *
 *   // app/api/mdmx/[...route]/route.ts
 *   export const { GET, POST, PUT, DELETE } = createMDMXHandlers({ ... })
 */
export function createMDMXHandlers(options: MDMXHandlerOptions = {}): MDMXHandlers {
  // Settings resolve on the first request, not at module load: the mount file
  // stays three synchronous lines, and a misconfiguration answers with a
  // readable error instead of crashing the build (ADR-039).
  let handlers: Promise<MDMXHandlers> | null = null;
  const build = (): Promise<MDMXHandlers> =>
    (handlers ??= resolveSettings(options).then(buildHandlers));

  const lazy: Handler = async (req) => {
    let built: MDMXHandlers;
    try {
      built = await build();
    } catch (err) {
      // Retry on the next request — a fixed .env should not need a restart.
      handlers = null;
      return json(500, { error: (err as Error).message });
    }
    return built.GET(req); // all four methods share one handler
  };

  return { GET: lazy, POST: lazy, PUT: lazy, DELETE: lazy };
}

function buildHandlers(o: ResolvedSettings): MDMXHandlers {
  const auth = defaultAuthStrategy(o);
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
        return json(200, { ok: true }, o.localMode ? {} : { "set-cookie": clearCookie(SESSION_COOKIE, "/", secure) });
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
        return withSession(
          json(200, {
            login: session.login,
            repo: o.repo,
            contentDir: o.contentDir,
            mediaDir: o.mediaDir,
            validation: o.validation,
            localMode: Boolean(o.localMode),
          }),
        );
      }

      // ---- collections (config-as-code, resolved at request time) ---------

      if (route === "/collections" && method === "GET") {
        return withSession(json(200, { collections: await resolveCollections(provider) }));
      }

      if (route === "/collections" && method === "POST") {
        const body = (await req.json()) as {
          name?: string;
          dir?: string;
          fields?: Record<string, CollectionFieldConfig>;
        };
        if (typeof body.name !== "string" || body.name.length === 0) {
          return withSession(json(400, { error: "collection name is required" }));
        }
        const candidate: CollectionConfig = {
          dir: body.dir ?? `${o.contentDir}/${body.name}`,
          fields: body.fields ?? {},
        };
        const problems = validateCollectionConfig(body.name, candidate);
        const dirError = checkCollectionDir(candidate.dir);
        if (dirError) problems.push(dirError);
        if (problems.length > 0) {
          return withSession(json(400, { error: "invalid collection", problems }));
        }

        const { config, sha } = await readProjectConfig(provider);
        const current = effectiveCollectionsConfig(config);
        if (Object.hasOwn(current, body.name)) {
          return withSession(json(409, { error: `collection "${body.name}" already exists` }));
        }
        const result = await writeProjectConfig(
          provider,
          config,
          { ...current, [body.name]: candidate },
          sha,
          `mdmx: create collection ${body.name}`,
        );
        return withSession(
          json(201, { collection: collectionFromConfig(body.name, candidate), commit: result }),
        );
      }

      const collectionRoute = route.match(/^\/collections\/([^/]+)$/);
      if (collectionRoute && method === "PUT") {
        const name = decodeURIComponent(collectionRoute[1]!);
        const body = (await req.json()) as {
          fields?: Record<string, CollectionFieldConfig>;
        };
        if (body.fields === null || typeof body.fields !== "object") {
          return withSession(json(400, { error: "fields must be an object" }));
        }

        const { config, sha } = await readProjectConfig(provider);
        const current = effectiveCollectionsConfig(config);
        const existing = Object.hasOwn(current, name) ? current[name] : undefined;
        if (!existing) {
          return withSession(json(404, { error: `no collection "${name}"` }));
        }
        const candidate: CollectionConfig = { ...existing, fields: body.fields };
        const problems = validateCollectionConfig(name, candidate);
        if (problems.length > 0) {
          return withSession(json(400, { error: "invalid collection", problems }));
        }
        const result = await writeProjectConfig(
          provider,
          config,
          { ...current, [name]: candidate },
          sha,
          `mdmx: update collection ${name}`,
        );
        return withSession(
          json(200, { collection: collectionFromConfig(name, candidate), commit: result }),
        );
      }

      if (route === "/files" && method === "GET") {
        const dir = checkPrefix(url.searchParams.get("dir") ?? o.contentDir);
        return withSession(json(200, { files: await provider.list(dir) }));
      }

      if (route === "/entries" && method === "GET") {
        // Listing + parsed frontmatter in one round trip, for entry tables
        // and search. Body content stays out of the payload.
        const dir = checkPrefix(url.searchParams.get("dir") ?? o.contentDir);
        const files = await provider.list(dir);
        const entries = [];
        for (const f of files) {
          if (!/\.mdx?$/.test(f.path)) continue;
          const { content, sha } = await readText(provider, f.path);
          let frontmatter: Record<string, unknown> = {};
          try {
            ({ frontmatter } = parseDocument(content));
          } catch {
            // One malformed file must not take down the whole listing.
          }
          entries.push({ path: f.path, sha, frontmatter });
        }
        return withSession(json(200, { entries }));
      }

      if (route === "/file" && method === "GET") {
        const path = checkPrefix(url.searchParams.get("path") ?? "");
        // Text route: media is served by the site, not through this JSON API.
        const file = await readText(provider, path);
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
          // Frontmatter schemas come from the request-time collection set, so
          // entries in dashboard-created collections validate immediately.
          // (Resolved outside the try: a config failure is not a parse error.)
          const collections = await resolveCollections(provider);
          // Studio components merge in at request time so documents using
          // them don't trip MDMX001 on save.
          const registry = await effectiveRegistry(provider, o.registry);
          // Never trust the editor client: re-validate on the server. Same
          // seam `mdmx check` uses, so lint and save can't disagree. A parse
          // failure (malformed MDX) is a client error, not a 500.
          try {
            diagnostics = validateDocument(body.content, { registry, path, collections });
          } catch (parseErr) {
            return withSession(
              json(400, { error: "could not parse MDMX", detail: (parseErr as Error).message }),
            );
          }
          const hasErrors = diagnostics.some((d) => d.severity === "error");
          if (o.validation === "strict" && hasErrors) {
            return withSession(json(422, { error: "validation failed", diagnostics }));
          }
        }

        const result = await provider.commit(
          [{ path, content: body.content }],
          body.message ?? `mdmx: update ${path}`,
          body.expectedSha !== undefined
            ? { expectedShas: { [path]: body.expectedSha } }
            : undefined,
        );
        // The blob sha of what we just wrote, so the client can stay
        // conflict-safe without a follow-up read (review §3.2-2).
        const sha = gitBlobSha(Buffer.from(body.content, "utf8"));
        return withSession(json(200, { commit: result, sha, diagnostics }));
      }

      if (route === "/file" && method === "DELETE") {
        const body = (await req.json()) as {
          path: string;
          message?: string;
          expectedSha?: string | null;
        };
        const path = checkPrefix(body.path);
        const result = await provider.commit(
          [{ path, delete: true }],
          body.message ?? `mdmx: delete ${path}`,
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
          body.message ?? `mdmx: add media ${path}`,
          { expectedShas: { [path]: null } }, // never overwrite media silently
        );
        return withSession(json(201, { commit: result, path }));
      }

      // ---- studio components (runtime template components) -----------------

      // ---- studio (extracted; see routes/studio.ts) -----------------------
      const studioResponse = await handleStudioRoute(
        { settings: o, provider, json, withSession },
        req,
        route,
        method,
      );
      if (studioResponse) return studioResponse;

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

  // -- collections: config-as-code, resolved per request (ADR-035) -----------

  /** Read the project config through the provider; missing file → empty. */
  async function readProjectConfig(
    provider: ContentProvider,
  ): Promise<{ config: ProjectConfigFile; sha: string | null }> {
    let content: string;
    let sha: string;
    try {
      ({ content, sha } = await readText(provider, o.configPath));
    } catch (err) {
      if (isNotFound(err)) return { config: {}, sha: null };
      throw err;
    }
    // Shape, defaults, and the parse error all come from @mdmx/project, so the
    // runtime and the CLI can no longer disagree about what a config file is.
    return { config: parseProjectConfig(content, o.configPath), sha };
  }

  /**
   * The authored collections, with a migration path: when the config file has
   * no collections block but the baked registry does (older project, or an
   * .mjs config), seed from the registry so edits write a complete block.
   */
  function effectiveCollectionsConfig(config: ProjectConfigFile): CollectionsConfig {
    if (config.collections) return config.collections;
    const seeded: CollectionsConfig = {};
    for (const spec of o.registry?.collections ?? []) {
      seeded[spec.name] = collectionToConfig(spec);
    }
    return seeded;
  }

  async function writeProjectConfig(
    provider: ContentProvider,
    config: ProjectConfigFile,
    collections: CollectionsConfig,
    sha: string | null,
    message: string,
  ) {
    const next: ProjectConfigFile = { ...config, collections };
    return provider.commit(
      [{ path: o.configPath, content: JSON.stringify(next, null, 2) + "\n" }],
      message,
      { expectedShas: { [o.configPath]: sha } },
    );
  }

  /** The request-time collection set: config file first, baked registry as fallback. */
  async function resolveCollections(provider: ContentProvider): Promise<CollectionSpec[]> {
    const { config } = await readProjectConfig(provider);
    return collectionsFromConfig(effectiveCollectionsConfig(config));
  }

  // -- studio components: stored under <contentDir>/_components ---------------

  /** Baked registry + valid stored studio defs, for save-time validation. */
  async function effectiveRegistry(provider: ContentProvider, base: Registry): Promise<Registry> {
    const entries = await listStudioDefs({ settings: o, provider });
    const defs = entries.map((e) => e.def).filter((d): d is StudioComponentDef => d != null);
    if (defs.length === 0) return base;
    // Same code-beats-studio rule the CLI applies (@mdmx/studio).
    return new Registry(mergeStudioSpecs(base.spec, defs));
  }

  /** Collection dirs must sit under the content dir or the file API can't reach them. */
  function checkCollectionDir(dir: string): string | null {
    try {
      const safe = assertSafePath(dir);
      if (!within(safe, o.contentDir)) {
        return `collection dir must be under ${o.contentDir}/ (got "${dir}")`;
      }
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }

  // -- auth flow ---------------------------------------------------------------

  async function login(url: URL): Promise<Response> {
    const state = randomBytes(16).toString("base64url");
    const redirectUri = `${url.origin}${o.basePath}/auth/callback`;
    const location = auth.beginLogin({ redirectUri, state });
    // A strategy with no redirect (local mode) drops straight into the editor.
    if (location === null) {
      return new Response(null, { status: 302, headers: { location: o.editorPath } });
    }
    return new Response(null, {
      status: 302,
      headers: {
        location,
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
    // Throws AuthError(403) when the identity may not push.
    const { login, token } = await auth.completeLogin({ code, redirectUri });
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
    headers.append("set-cookie", clearCookie(STATE_COOKIE, "/", secure));
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
          "set-cookie": clearCookie(SESSION_COOKIE, "/", secure),
        }),
      };
    }
    // Collaborators get removed: re-verify permission on a 5-minute cadence.
    if (o.now() - session.verifiedAt > REVERIFY_MS) {
      try {
        await auth.verifyAccess(session.token);
      } catch (err) {
        // Only a definitive AuthError revokes the session — a GitHub outage
        // or network failure must not log every editor out.
        if (!(err instanceof AuthError)) {
          return {
            session: null as never,
            response: json(503, {
              error: "could not re-verify repository access; try again shortly",
            }),
          };
        }
        return {
          session: null as never,
          response: json(401, { error: "repository access revoked" }, {
            "set-cookie": clearCookie(SESSION_COOKIE, "/", secure),
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

/** ENOENT (local FS) or a 404-carrying provider error (GitHub API). */
function isNotFound(err: unknown): boolean {
  if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return true;
  return (err as { status?: unknown })?.status === 404;
}

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    // no-store: responses carry authenticated file contents and session state.
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  });
}
