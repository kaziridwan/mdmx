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
// app/api/mdmx/[...route]/route.ts — unchanged from local development
import { createMDMXHandlers } from "@mdmx/next";

export const { GET, POST, PUT, DELETE } = createMDMXHandlers();
export const dynamic = "force-dynamic";
```

The mount file does not change between local and production. Setting the three
environment variables is what flips the mode: MDMX detects the OAuth
credentials, switches to `GitHubOAuthStrategy`, and builds a `GitHubProvider`
from the `repo` in `mdmx.config.json`. Install the provider package for
production (`pnpm add @mdmx/provider-github`) — it is an optional peer, so
local-only deployments don't carry it.

If you deploy with none of them set, MDMX refuses to serve and names the
missing variables. That is deliberate: the alternative is a public site
silently accepting unauthenticated writes.

Cookies also stop allowing plain HTTP automatically, because `insecureCookies`
defaults to `NODE_ENV !== "production"`. Commits are authored with the
*editor's own token*, so git history shows who changed what — no bot identity
in the blame.

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

## The dashboard in production

The dashboard mount from [guide 4](04-editor.md) needs **no changes**: its
client talks only to the content API, and reads through the session's
`GitHubProvider` hit the Git Data API directly — so entry tables, the editor,
and collection management always see the branch's current state, not the
deployed snapshot. An expired session surfaces as the GitHub login screen.

One nuance: the page factory reads `.mdmx/registry.json` from the deployed
filesystem, so **component** changes still flow through `mdmx generate` +
deploy (they're code changes anyway). **Collections** don't — they're
resolved from `mdmx.config.json` through the provider per request (ADR-035),
so a collection created in the dashboard is usable immediately, before the
rebuild that its own commit triggers.

The **public** site keeps reading the local filesystem at build time
([guide 5](05-rendering-content.md)) — a save commits to the branch, your
host rebuilds on push, and the new content ships. Runtime GitHub calls happen
only inside the CMS routes.

## Production checklist

- [ ] The three `MDMX_*` environment variables are set (that is what selects GitHub mode)
- [ ] `repo` in `mdmx.config.json` points at the content repository
- [ ] `@mdmx/provider-github` installed
- [ ] `"validation": "strict"` in `mdmx.config.json` so invalid content can't be committed
- [ ] OAuth callback URL matches `<origin><basePath>/auth/callback` exactly
- [ ] `MDMX_SESSION_SECRET` is long, random, and stored as a secret
- [ ] `mdmx generate && mdmx check` runs in CI (protects against hand-edited content)
- [ ] Host rebuilds on push to the content branch
- [ ] Repo collaborators reviewed — push permission *is* CMS access

Next: [troubleshooting →](07-troubleshooting.md)
