/**
 * Mode and secret resolution (ADR-039).
 *
 * The rule is convention-first and fail-closed: OAuth env vars present means
 * GitHub mode; absent means local mode — but only outside production. A
 * production deployment with no auth configured raises instead of quietly
 * serving unauthenticated writes.
 */

export type MDMXMode = "local" | "github";

export const ENV_CLIENT_ID = "MDMX_GITHUB_CLIENT_ID";
export const ENV_CLIENT_SECRET = "MDMX_GITHUB_CLIENT_SECRET";
export const ENV_SESSION_SECRET = "MDMX_SESSION_SECRET";

export interface GitHubCredentials {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
}

export type ResolvedMode =
  | { mode: "local" }
  | { mode: "github"; credentials: GitHubCredentials };

export interface ResolveModeOptions {
  /** Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Explicit override; skips detection but keeps the safety checks. */
  mode?: MDMXMode;
  /** Required to run local mode (unauthenticated writes) in production. */
  allowLocalModeInProduction?: boolean;
  /**
   * Credentials the caller already has (passed as options rather than set in
   * the environment). Present values are not required from `env`.
   */
  credentials?: Partial<GitHubCredentials>;
}

export class ModeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModeResolutionError";
  }
}

function credentialsFrom(
  env: Record<string, string | undefined>,
  supplied: Partial<GitHubCredentials> = {},
): { credentials?: GitHubCredentials; missing: string[] } {
  const clientId = supplied.clientId ?? env[ENV_CLIENT_ID];
  const clientSecret = supplied.clientSecret ?? env[ENV_CLIENT_SECRET];
  const sessionSecret = supplied.sessionSecret ?? env[ENV_SESSION_SECRET];
  const missing = [
    !clientId && ENV_CLIENT_ID,
    !clientSecret && ENV_CLIENT_SECRET,
    !sessionSecret && ENV_SESSION_SECRET,
  ].filter((x): x is string => typeof x === "string");
  if (missing.length > 0) return { missing };
  return {
    credentials: {
      clientId: clientId!,
      clientSecret: clientSecret!,
      sessionSecret: sessionSecret!,
    },
    missing: [],
  };
}

export function resolveMode(options: ResolveModeOptions = {}): ResolvedMode {
  const env = options.env ?? process.env;
  const isProduction = env.NODE_ENV === "production";
  const { credentials, missing } = credentialsFrom(env, options.credentials);

  if (options.mode === "local") {
    if (isProduction && !options.allowLocalModeInProduction) {
      throw new ModeResolutionError(
        'mode: "local" runs unauthenticated writes and NODE_ENV is "production". ' +
          "Set allowLocalModeInProduction: true if that is genuinely what you want.",
      );
    }
    return { mode: "local" };
  }

  if (options.mode === "github") {
    if (!credentials) {
      throw new ModeResolutionError(
        `mode: "github" requires ${missing.join(", ")} in the environment.`,
      );
    }
    return { mode: "github", credentials };
  }

  if (credentials) return { mode: "github", credentials };

  if (isProduction) {
    throw new ModeResolutionError(
      `MDMX is not configured for production: ${missing.join(", ")} ${
        missing.length === 1 ? "is" : "are"
      } missing. ` +
        "Set them to enable GitHub mode, or pass mode: \"local\" with " +
        "allowLocalModeInProduction: true to serve unauthenticated writes on purpose.",
    );
  }

  return { mode: "local" };
}

/** Whether cookies may omit `Secure` (development over plain http). */
export function insecureCookiesDefault(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV !== "production";
}
