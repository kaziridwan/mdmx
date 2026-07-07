# 6 · Production: GitHub mode

Local mode writes to the working tree with no auth — fine on your machine,
an open door on a server. Production swaps in **GitHub OAuth** and the
**GitHub provider**: collaborators log in with GitHub, and every save becomes
an atomic commit on your branch.

## The authorization model

Deliberately git-native: **if GitHub says you can push to the configured
repo, you can use the CMS.** No user table, no roles, nothing to administer —
you manage editors by managing repo collaborators. Concretely:

- Login runs the standard OAuth flow (scope `repo`), then verifies the user's
  permission on `repo.owner/repo.name`. Anything below push (`write`,
  `maintain`, `admin`) is rejected with a 403.
- The session is an **AES-GCM-sealed cookie** (`mdmx_session`, 8-hour TTL) —
  stateless, nothing stored server-side.
- Push permission is **re-verified against GitHub every 5 minutes** during
  use, so removing a collaborator locks them out of the CMS within minutes,
  not at session expiry.

## 1. Create a GitHub OAuth app

GitHub → Settings → Developer settings → OAuth Apps → New:

- **Homepage URL**: `https://your-site.com`
- **Authorization callback URL**:
  `https://your-site.com/api/mdmx/auth/callback`
  (that is: `<origin><basePath>/auth/callback` — adjust if you changed
  `basePath`)

Note the client ID and generate a client secret.

## 2. Set the environment variables

```sh
GITHUB_CLIENT_ID=…
GITHUB_CLIENT_SECRET=…
# 32+ random bytes; seals the session cookie:
MDMX_SESSION_SECRET=$(openssl rand -base64 32)
```

Rotating `MDMX_SESSION_SECRET` invalidates all active sessions — that's the
kill switch if a secret leaks.

## 3. Swap the handler config

Install `@mdmx/provider-github`, then replace the local-mode route from
[guide 3](03-content-api.md):

```ts
// app/api/mdmx/[...route]/route.ts
import { createMDMXHandlers } from "@mdmx/next";
import { GitHubProvider } from "@mdmx/provider-github";
import { CONTENT_DIR, MEDIA_DIR, REPO, registry } from "../../../../lib/mdmx-config";

export const { GET, POST, PUT, DELETE } = createMDMXHandlers({
  repo: REPO, // { owner: "your-org", name: "your-repo", branch: "main" }
  contentDir: CONTENT_DIR,
  mediaDir: MEDIA_DIR,
  auth: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
  sessionSecret: process.env.MDMX_SESSION_SECRET!,
  createProvider: (session) =>
    new GitHubProvider({
      owner: REPO.owner,
      repo: REPO.name,
      branch: REPO.branch,
      token: session.token, // the logged-in editor's OAuth token
    }),
  registry: registry(),
  validation: "strict", // recommended in production: reject invalid saves
  editorPath: "/", // where /auth/login lands after success
});

export const dynamic = "force-dynamic";
```

The diff from local mode: `localMode` and `insecureCookies` are **gone**,
`auth` + `sessionSecret` + a `GitHubProvider`-backed `createProvider` are in.
Commits are authored with the *editor's own token*, so git history shows who
changed what — no bot identity in the blame.

Login entry point: send users to `/api/mdmx/auth/login` (e.g. from a "Log in"
button, or whenever an API call returns 401).

### `GitHubProviderOptions`

| Option | Meaning |
| --- | --- |
| `owner`, `repo`, `branch` | Target repository and branch |
| `token` | OAuth (or installation) token with push permission |
| `committer` | Optional `{ name, email }` override for the committer field |
| `apiBase` | GitHub Enterprise API root (pair with `auth.apiBase`/`auth.oauthBase` on the handler) |

## What the provider guarantees

`GitHubProvider` uses the low-level Git Data API (blobs → tree → commit →
ref), not the Contents API:

- **Atomic multi-file commits** — a post and its images land as one commit
  with a controlled message.
- **Optimistic concurrency** — `expectedSha` mismatches fail the ref update
  and surface as 409 to the editor, exactly like local mode. The
  sha-refreshing save loop from [guide 4](04-editor.md) needs no changes.
- **Path safety** — the same `contentDir`/`mediaDir` confinement applies
  before anything reaches GitHub.

## Editor pages in production

The `/edit` server page from guide 4 reads via `LocalProvider` — in GitHub
mode the deployed filesystem is read-only and stale between deploys. Read
through the API instead so the page sees the branch's current state, e.g.
fetch `GET <basePath>/file?path=…` (forwarding the request's cookies) and
redirect to `/api/mdmx/auth/login` on a 401. Reads through the session's
`GitHubProvider` hit the Git Data API directly.

The **public** site keeps reading the local filesystem at build time
([guide 5](05-rendering-content.md)) — a save commits to the branch, your
host rebuilds on push, and the new content ships. Runtime GitHub calls happen
only inside the CMS routes.

## Production checklist

- [ ] `localMode` removed; `insecureCookies` removed (cookies require HTTPS)
- [ ] `validation: "strict"` so invalid content can't be committed
- [ ] OAuth callback URL matches `<origin><basePath>/auth/callback` exactly
- [ ] `MDMX_SESSION_SECRET` is long, random, and stored as a secret
- [ ] `mdmx generate && mdmx check` runs in CI (protects against hand-edited content)
- [ ] Host rebuilds on push to the content branch
- [ ] Repo collaborators reviewed — push permission *is* CMS access

Next: [troubleshooting →](07-troubleshooting.md)
