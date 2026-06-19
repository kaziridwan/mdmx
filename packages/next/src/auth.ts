/**
 * GitHub OAuth + authorization.
 *
 * The authorization model is deliberately git-native: if GitHub says you can
 * push to the configured repo, you can use the CMS. No user table, no roles.
 */

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  repo: { owner: string; name: string };
  /** Injectable for tests / GitHub Enterprise. */
  fetch?: typeof globalThis.fetch;
  apiBase?: string; // default https://api.github.com
  oauthBase?: string; // default https://github.com
}

export class AuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const WRITE_PERMISSIONS = new Set(["admin", "maintain", "write"]);

export function authorizeUrl(
  auth: AuthConfig,
  redirectUri: string,
  state: string,
): string {
  const base = auth.oauthBase ?? "https://github.com";
  const params = new URLSearchParams({
    client_id: auth.clientId,
    redirect_uri: redirectUri,
    scope: "repo",
    state,
  });
  return `${base}/login/oauth/authorize?${params}`;
}

export async function exchangeCode(
  auth: AuthConfig,
  code: string,
  redirectUri: string,
): Promise<string> {
  const fetchImpl = auth.fetch ?? globalThis.fetch;
  const base = auth.oauthBase ?? "https://github.com";
  const res = await fetchImpl(`${base}/login/oauth/access_token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new AuthError(res.status, "OAuth code exchange failed");
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new AuthError(401, `OAuth code exchange failed: ${data.error ?? "no token"}`);
  }
  return data.access_token;
}

/**
 * Resolve the token's user and verify push permission on the configured repo.
 * Throws AuthError(403) when the user cannot write.
 */
export async function verifyRepoAccess(
  auth: AuthConfig,
  token: string,
): Promise<{ login: string }> {
  const fetchImpl = auth.fetch ?? globalThis.fetch;
  const api = auth.apiBase ?? "https://api.github.com";
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };

  const userRes = await fetchImpl(`${api}/user`, { headers });
  if (!userRes.ok) throw new AuthError(401, "Could not resolve the GitHub user");
  const user = (await userRes.json()) as { login: string };

  const permRes = await fetchImpl(
    `${api}/repos/${auth.repo.owner}/${auth.repo.name}/collaborators/${user.login}/permission`,
    { headers },
  );
  if (!permRes.ok) {
    throw new AuthError(403, `No access to ${auth.repo.owner}/${auth.repo.name}`);
  }
  const perm = (await permRes.json()) as { permission: string };
  if (!WRITE_PERMISSIONS.has(perm.permission)) {
    throw new AuthError(
      403,
      `Push permission on ${auth.repo.owner}/${auth.repo.name} is required (found "${perm.permission}")`,
    );
  }
  return { login: user.login };
}
