import { assertSafePath, Registry, type ContentProvider } from "@mdmx/core";
import {
  insecureCookiesDefault,
  loadConfig,
  resolveMode,
  tryLoadRegistrySpec,
  type MDMXMode,
} from "@mdmx/project";
import { LocalProvider } from "./local-provider.js";
import type { SessionData } from "./session.js";
import type { AuthConfig } from "./auth.js";
import { GitHubOAuthStrategy, LocalAuthStrategy, type AuthStrategy } from "./auth-strategy.js";
import type { MDMXHandlerOptions } from "./api.js";

/**
 * Turn (possibly empty) handler options into everything the routes need
 * (ADR-039).
 *
 * `createMDMXHandlers()` with no arguments is the Layer-1 path: structural
 * values come from `mdmx.config.json`, secrets from the environment, and the
 * mode is detected — GitHub when OAuth vars are set, local otherwise, and a
 * loud failure in production when neither is true. Every value stays
 * overridable, which is Layer 2.
 *
 * Resolution is lazy (first request, then cached) rather than at module load,
 * so a mount file stays three synchronous lines and a misconfiguration
 * reports as a readable response instead of a build crash.
 */
export interface ResolvedSettings {
  repo: { owner: string; name: string; branch: string };
  contentDir: string;
  mediaDir: string;
  componentsDir: string;
  configPath: string;
  basePath: string;
  editorPath: string;
  validation: "strict" | "report";
  mode: MDMXMode;
  localMode: boolean;
  auth?: Omit<AuthConfig, "repo">;
  sessionSecret: string;
  authStrategy?: AuthStrategy;
  createProvider: (session: SessionData) => ContentProvider;
  registry?: Registry;
  insecureCookies: boolean;
  maxMediaBytes: number;
  now: () => number;
}

/** Local mode needs a seal secret too; sessions are still sealed cookies. */
const LOCAL_SESSION_SECRET = "mdmx-local-mode-session-secret";

export async function resolveSettings(
  options: MDMXHandlerOptions,
): Promise<ResolvedSettings> {
  const root = options.root ?? process.cwd();
  const env = options.env ?? process.env;
  const { config } = await loadConfig(root);

  // Passing OAuth config explicitly *is* choosing GitHub mode; detection only
  // has to answer the question when the caller said nothing.
  const requestedMode =
    options.mode ?? (options.localMode ? "local" : options.auth ? "github" : undefined);
  const resolved = resolveMode({
    env,
    mode: requestedMode,
    allowLocalModeInProduction: options.allowLocalModeInProduction,
    credentials: {
      ...(options.auth?.clientId ? { clientId: options.auth.clientId } : {}),
      ...(options.auth?.clientSecret ? { clientSecret: options.auth.clientSecret } : {}),
      ...(options.sessionSecret ? { sessionSecret: options.sessionSecret } : {}),
    },
  });
  const localMode = resolved.mode === "local";

  const auth =
    options.auth ??
    (resolved.mode === "github"
      ? {
          clientId: resolved.credentials.clientId,
          clientSecret: resolved.credentials.clientSecret,
        }
      : undefined);
  const sessionSecret =
    options.sessionSecret ??
    (resolved.mode === "github" ? resolved.credentials.sessionSecret : LOCAL_SESSION_SECRET);

  const repo = options.repo ??
    config.repo ?? {
      // Local authoring commits nothing to a remote, so a placeholder is
      // honest here; GitHub mode needs the real thing and says so.
      owner: "local",
      name: "local",
      branch: "main",
    };
  if (!localMode && !options.repo && !config.repo) {
    throw new Error(
      'GitHub mode needs a "repo" ({ owner, name, branch }) in mdmx.config.json.',
    );
  }

  const configPath = options.configPath ?? "mdmx.config.json";
  assertSafePath(configPath);

  const registry =
    options.registry ??
    (() => {
      const spec = tryLoadRegistrySpec(root, config);
      return spec ? new Registry(spec) : undefined;
    })();

  return {
    repo,
    contentDir: options.contentDir ?? config.contentDir,
    mediaDir: options.mediaDir ?? config.mediaDir,
    componentsDir: options.componentsDir ?? config.componentsDir,
    configPath,
    basePath: options.basePath ?? config.basePath,
    editorPath: options.editorPath ?? config.mountPath,
    validation: options.validation ?? config.validation,
    mode: resolved.mode,
    localMode,
    auth,
    sessionSecret,
    authStrategy: options.authStrategy,
    createProvider:
      options.createProvider ?? (await defaultProvider(resolved.mode, root, repo)),
    registry,
    insecureCookies: options.insecureCookies ?? insecureCookiesDefault(env),
    maxMediaBytes: options.maxMediaBytes ?? 10 * 1024 * 1024,
    now: options.now ?? (() => Date.now()),
  };
}

/** The provider each mode implies, so the common recipe passes none. */
async function defaultProvider(
  mode: MDMXMode,
  root: string,
  repo: { owner: string; name: string; branch: string },
): Promise<(session: SessionData) => ContentProvider> {
  if (mode === "local") {
    const provider = new LocalProvider(root);
    return () => provider;
  }
  // GitHub mode: the provider package is an optional peer so that local-only
  // deployments don't carry it.
  let GitHubProvider: new (o: Record<string, unknown>) => ContentProvider;
  try {
    ({ GitHubProvider } = (await import("@mdmx/provider-github")) as unknown as {
      GitHubProvider: new (o: Record<string, unknown>) => ContentProvider;
    });
  } catch {
    throw new Error(
      "GitHub mode needs @mdmx/provider-github installed, or an explicit " +
        "`createProvider`. Run: pnpm add @mdmx/provider-github",
    );
  }
  return (session: SessionData) =>
    new GitHubProvider({
      owner: repo.owner,
      repo: repo.name,
      branch: repo.branch,
      token: session.token,
    });
}

export function defaultAuthStrategy(settings: ResolvedSettings): AuthStrategy {
  if (settings.authStrategy) return settings.authStrategy;
  if (settings.localMode) return new LocalAuthStrategy();
  return new GitHubOAuthStrategy({
    ...(settings.auth as Omit<AuthConfig, "repo">),
    repo: { owner: settings.repo.owner, name: settings.repo.name },
  });
}
