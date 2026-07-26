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
  parseStudioComponent,
  PathSafetyError,
  Registry,
  STUDIO_COMPONENTS_DIR,
  studioComponentPath,
  studioComponentToSpec,
  studioComponentToTSX,
  validateCollectionConfig,
  validateFrontmatter,
  validateSource,
  validateStudioComponent,
  type CollectionConfig,
  type CollectionFieldConfig,
  type CollectionSpec,
  type CollectionsConfig,
  type ContentProvider,
  type Diagnostic,
  type StudioComponentDef,
} from "@mdmx/core";
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
  SESSION_COOKIE,
  type SessionData,
} from "./session.js";

export interface MDMXHandlerOptions {
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
  /**
   * Project config file (JSON) collections are resolved from at request time
   * and written back to by the collection routes (ADR-035). Collections in
   * this file take precedence over the ones baked into `registry`.
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
  /** Allow non-HTTPS cookies (development). */
  insecureCookies?: boolean;
  maxMediaBytes?: number;
  now?: () => number;
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
export function createMDMXHandlers(options: MDMXHandlerOptions): MDMXHandlers {
  const o = {
    basePath: "/api/mdmx",
    editorPath: "/mdmx",
    configPath: "mdmx.config.json",
    componentsDir: "components/mdmx",
    validation: "report" as const,
    maxMediaBytes: 10 * 1024 * 1024,
    now: () => Date.now(),
    ...options,
  };
  assertSafePath(o.configPath);
  if (!o.localMode) {
    const missing = [
      !o.auth && "`auth` (GitHub OAuth client config)",
      !o.sessionSecret && "`sessionSecret`",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(
        `createMDMXHandlers: GitHub mode requires ${missing.join(" and ")}. ` +
          "Pass `localMode: true` for local development without OAuth.",
      );
    }
  }
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

      if (route === "/documents" && method === "GET") {
        // Listing + parsed frontmatter in one round trip, for entry tables
        // and search. Body content stays out of the payload.
        const dir = checkPrefix(url.searchParams.get("dir") ?? o.contentDir);
        const files = await provider.list(dir);
        const documents = [];
        for (const f of files) {
          if (!/\.mdx?$/.test(f.path)) continue;
          const { content, sha } = await provider.read(f.path);
          let frontmatter: Record<string, unknown> = {};
          try {
            ({ frontmatter } = parseDocument(content));
          } catch {
            // One malformed file must not take down the whole listing.
          }
          documents.push({ path: f.path, sha, frontmatter });
        }
        return withSession(json(200, { documents }));
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
          // Frontmatter schemas come from the request-time collection set, so
          // entries in dashboard-created collections validate immediately.
          // (Resolved outside the try: a config failure is not a parse error.)
          const collection = collectionForPath(await resolveCollections(provider), path);
          // Studio components merge in at request time so documents using
          // them don't trip MDMX001 on save.
          const registry = await effectiveRegistry(provider, o.registry);
          // Never trust the editor client: re-validate on the server. A parse
          // failure (malformed MDX) is a client error, not a 500.
          try {
            diagnostics = validateSource(body.content, { registry });
            if (collection) {
              const { frontmatter } = parseDocument(body.content);
              diagnostics = diagnostics.concat(validateFrontmatter(frontmatter, collection));
            }
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

      if (route === "/studio/components" && method === "GET") {
        const entries = await listStudioDefs(provider);
        return withSession(
          json(200, {
            components: entries
              .filter((e) => e.def != null)
              .map((e) => ({ path: e.path, sha: e.sha, def: e.def })),
            invalid: entries
              .filter((e) => e.def == null)
              .map((e) => ({ path: e.path, problems: e.problems })),
          }),
        );
      }

      const studioRoute = route.match(/^\/studio\/components\/([^/]+)$/);
      if (studioRoute && method === "PUT") {
        const name = decodeURIComponent(studioRoute[1]!);
        const body = (await req.json()) as {
          def?: unknown;
          message?: string;
          expectedSha?: string | null;
        };
        const defName = (body.def as Partial<StudioComponentDef> | undefined)?.name;
        if (defName !== name) {
          return withSession(json(400, { error: "definition name must match the route" }));
        }
        // Collisions: the baked code registry plus every OTHER stored def.
        const taken = new Set<string>(o.registry?.components.map((c) => c.name) ?? []);
        for (const entry of await listStudioDefs(provider)) {
          if (entry.def && entry.def.name !== name) taken.add(entry.def.name);
        }
        const problems = validateStudioComponent(body.def, taken);
        if (problems.length > 0) {
          return withSession(json(400, { error: "invalid studio component", problems }));
        }
        const path = studioComponentPath(o.contentDir, name);
        const result = await provider.commit(
          [{ path, content: JSON.stringify(body.def, null, 2) + "\n" }],
          body.message ?? `mdmx: studio component ${name}`,
          body.expectedSha !== undefined
            ? { expectedShas: { [path]: body.expectedSha } }
            : undefined,
        );
        return withSession(
          json(200, {
            commit: result,
            path,
            spec: studioComponentToSpec(body.def as StudioComponentDef),
          }),
        );
      }

      if (studioRoute && method === "DELETE") {
        const name = decodeURIComponent(studioRoute[1]!);
        const path = studioComponentPath(o.contentDir, name);
        const result = await provider.delete(path, `mdmx: delete studio component ${name}`);
        return withSession(json(200, { commit: result }));
      }

      // Eject: write the definition as a real defineMDMX TSX file. The JSON
      // definition stays put — it keeps the component working at runtime
      // until `mdmx generate` + a rebuild promote the code version (which
      // then shadows it everywhere).
      const ejectRoute = route.match(/^\/studio\/components\/([^/]+)\/eject$/);
      if (ejectRoute && method === "POST") {
        const name = decodeURIComponent(ejectRoute[1]!);
        const stored = (await listStudioDefs(provider)).find((e) => e.def?.name === name);
        if (!stored?.def) {
          return withSession(json(404, { error: `no studio component "${name}"` }));
        }
        const path = assertSafePath(`${o.componentsDir}/${name}.tsx`);
        const result = await provider.commit(
          [{ path, content: studioComponentToTSX(stored.def) }],
          `mdmx: eject studio component ${name} to code`,
          { expectedShas: { [path]: null } }, // never overwrite an existing file
        );
        return withSession(
          json(201, {
            commit: result,
            path,
            note:
              `Run \`mdmx generate\` and rebuild to promote the code component; ` +
              `the studio definition keeps working until then and can be deleted after.`,
          }),
        );
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

  // -- collections: config-as-code, resolved per request (ADR-035) -----------

  interface ProjectConfigFile {
    collections?: CollectionsConfig;
    [key: string]: unknown;
  }

  /** Read the project config through the provider; missing file → empty. */
  async function readProjectConfig(
    provider: ContentProvider,
  ): Promise<{ config: ProjectConfigFile; sha: string | null }> {
    let content: string;
    let sha: string;
    try {
      ({ content, sha } = await provider.read(o.configPath));
    } catch (err) {
      if (isNotFound(err)) return { config: {}, sha: null };
      throw err;
    }
    try {
      return { config: JSON.parse(content) as ProjectConfigFile, sha };
    } catch {
      const parseError = new Error(
        `${o.configPath} is not valid JSON; fix it before managing collections`,
      ) as Error & { status: number };
      parseError.status = 500;
      throw parseError;
    }
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

  interface StudioEntry {
    path: string;
    sha: string;
    def: StudioComponentDef | null;
    problems: string[];
  }

  /** Read every stored studio definition; malformed files carry problems. */
  async function listStudioDefs(provider: ContentProvider): Promise<StudioEntry[]> {
    const dir = `${o.contentDir}/${STUDIO_COMPONENTS_DIR}`;
    let files;
    try {
      files = await provider.list(dir);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
    const out: StudioEntry[] = [];
    for (const f of files) {
      if (!f.path.endsWith(".json")) continue;
      const { content, sha } = await provider.read(f.path);
      const { def, problems } = parseStudioComponent(content);
      out.push({ path: f.path, sha, def, problems });
    }
    return out;
  }

  /** Baked registry + valid stored studio defs, for save-time validation. */
  async function effectiveRegistry(provider: ContentProvider, base: Registry): Promise<Registry> {
    const entries = await listStudioDefs(provider);
    const defs = entries.filter((e) => e.def != null);
    if (defs.length === 0) return base;
    const existing = new Set(base.components.map((c) => c.name));
    const merged = [
      ...base.spec.components,
      ...defs.filter((e) => !existing.has(e.def!.name)).map((e) => studioComponentToSpec(e.def!)),
    ];
    return new Registry({ ...base.spec, components: merged });
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
        await verifyRepoAccess(authConfig, session.token);
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
