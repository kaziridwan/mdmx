import { AuthError, authorizeUrl, exchangeCode, verifyRepoAccess, type AuthConfig } from "./auth.js";

/**
 * The authentication seam (ADR-046).
 *
 * Storage was pluggable from day one (`ContentProvider`); auth was not — the
 * GitHub OAuth dance was called directly inside the route handler, so a
 * GitLab deployment could swap the provider and then hit a wall. These three
 * operations are what a git host has to answer for MDMX to run:
 *
 *   begin  → where do I send the browser?
 *   complete → what identity does this callback prove?
 *   verify → may that identity still write to the repo?
 *
 * The local (no-OAuth) mode is the second implementation, which is what keeps
 * the interface honest before a third host exists.
 */
export interface AuthIdentity {
  /** Display name recorded in the session (and in commit messages). */
  login: string;
  /** Host API token; empty when the strategy has no remote to call. */
  token: string;
}

export interface BeginLoginContext {
  /** Absolute callback URL the host should return the browser to. */
  redirectUri: string;
  /** CSRF state the caller has already sealed into a cookie. */
  state: string;
}

export interface CompleteLoginContext {
  code: string;
  redirectUri: string;
}

export interface AuthStrategy {
  /** Identifier for diagnostics (`"github-oauth"`, `"local"`). */
  readonly name: string;
  /**
   * The URL to redirect to in order to start login, or `null` when the
   * strategy needs no round trip (local mode goes straight to the editor).
   */
  beginLogin(ctx: BeginLoginContext): string | null;
  /** Resolve the callback into an identity. Throws AuthError when it can't. */
  completeLogin(ctx: CompleteLoginContext): Promise<AuthIdentity>;
  /**
   * Re-check write permission for a live session. Throws `AuthError` when
   * access is genuinely revoked; any other error means "couldn't tell", and
   * callers keep the session rather than logging everyone out on an outage.
   */
  verifyAccess(token: string): Promise<{ login: string }>;
}

/** GitHub OAuth with a push-permission gate — the shipped default. */
export class GitHubOAuthStrategy implements AuthStrategy {
  readonly name = "github-oauth";
  private readonly config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  beginLogin({ redirectUri, state }: BeginLoginContext): string {
    return authorizeUrl(this.config, redirectUri, state);
  }

  async completeLogin({ code, redirectUri }: CompleteLoginContext): Promise<AuthIdentity> {
    const token = await exchangeCode(this.config, code, redirectUri);
    const { login } = await verifyRepoAccess(this.config, token);
    return { login, token };
  }

  async verifyAccess(token: string): Promise<{ login: string }> {
    return verifyRepoAccess(this.config, token);
  }
}

/**
 * Local authoring: no OAuth, one synthetic identity, saves go to the working
 * tree through `LocalProvider`. Every other guard (CSRF, path safety,
 * validation, conflict detection) still applies.
 */
export class LocalAuthStrategy implements AuthStrategy {
  readonly name = "local";
  private readonly login: string;

  constructor(login = "local") {
    this.login = login;
  }

  beginLogin(): null {
    return null;
  }

  async completeLogin(): Promise<AuthIdentity> {
    return { login: this.login, token: "" };
  }

  async verifyAccess(): Promise<{ login: string }> {
    return { login: this.login };
  }
}

export { AuthError };
