# 3 · The content API

`createMDMXHandlers()` from `@mdmx/next` builds the CMS backend: auth, entry
listing/read/write/delete, collections, studio components, and media upload,
as **web-standard `Request → Response` handlers**. In the App Router you mount
them as a catch-all route and export them directly.

## Mount the route

```ts
// app/api/mdmx/[...route]/route.ts
import { createMDMXHandlers } from "@mdmx/next";

export const { GET, POST, PUT, DELETE } = createMDMXHandlers();
export const dynamic = "force-dynamic";
```

That's the whole file. `mdmx init nextjs` writes it for you.

`export const dynamic = "force-dynamic"` matters: the route reads and writes
per request and must never be statically optimized. The route segment
(`app/api/mdmx/…`) must match `basePath` (default `/api/mdmx`) — the handler
derives its internal route from the URL.

## What resolves by itself

Settings resolve on the first request and are cached (ADR-039):

| Value | Comes from |
| --- | --- |
| `contentDir`, `mediaDir`, `componentsDir`, `basePath`, `mountPath`, `validation`, `repo`, collections | `mdmx.config.json` |
| OAuth credentials, session secret | `MDMX_GITHUB_CLIENT_ID`, `MDMX_GITHUB_CLIENT_SECRET`, `MDMX_SESSION_SECRET` |
| Registry | `.mdmx/registry.json` under the config's `outDir` |
| Mode | Those env vars present → GitHub; absent → local (outside production) |
| Provider | `LocalProvider` in local mode, `GitHubProvider` in GitHub mode |
| `insecureCookies` | `NODE_ENV !== "production"` |

A misconfiguration doesn't crash the build: the first request answers with an
error naming exactly what's missing, and a corrected environment recovers on
the next request without a restart.

## Local mode

With no OAuth environment variables set (and outside production), MDMX runs in
local mode: every request is a synthetic `"local"` session and writes go
straight to the working tree. You edit, hit save, and `git diff` shows a
minimal canonical change — commit it like any other edit.

Everything else still applies: server-side validation, path-safety
confinement, CSRF-origin checks on mutations, and conflict detection via blob
shas. In production, local mode requires `mode: "local"` **and**
`allowLocalModeInProduction: true`, because it is an authentication bypass by
design.

## Options reference (`MDMXHandlerOptions`)

Every option is optional — this is the override layer for projects whose
layout differs from the convention.

| Option | Default | Meaning |
| --- | --- | --- |
| `root` | `process.cwd()` | Project root config and content resolve against |
| `repo` | config's `repo` | `{ owner, name, branch }`; required by GitHub mode |
| `contentDir` | config (`content`) | Directory content writes are confined to |
| `mediaDir` | config (`public/media`) | Directory media uploads are confined to |
| `componentsDir` | config (`components/mdmx`) | Where studio eject writes TSX |
| `mode` | detected | `"local"` or `"github"`, skipping detection |
| `allowLocalModeInProduction` | `false` | Required to serve unauthenticated writes in production |
| `auth` | from env | `{ clientId, clientSecret }` (+ `apiBase`/`oauthBase` for GHE). Passing it selects GitHub mode |
| `sessionSecret` | from env | Secret sealing the session cookie (AES-GCM) |
| `authStrategy` | from mode | An `AuthStrategy` implementation — the seam for non-GitHub hosts |
| `createProvider` | from mode | `(session) => ContentProvider` |
| `registry` | from `outDir` | Registry `.mdx` saves are validated against |
| `configPath` | `"mdmx.config.json"` | Config file collections resolve from at request time |
| `validation` | config (`"report"`) | `"report"`: save and return diagnostics. `"strict"`: reject error diagnostics (422) |
| `basePath` | config (`"/api/mdmx"`) | Route prefix the handlers are mounted under |
| `editorPath` | config `mountPath` (`"/mdmx"`) | Where to redirect after login |
| `insecureCookies` | `NODE_ENV !== "production"` | Allow cookies over plain HTTP |
| `maxMediaBytes` | 10 MiB | Upload size limit (413 beyond it) |
| `env` | `process.env` | Environment to read secrets from (tests inject one) |

## Endpoint reference

All routes are relative to `basePath`. Every route except the `auth` ones
requires a session (401 otherwise); in local mode the session is implicit.

| Method & route | Body / params | Returns |
| --- | --- | --- |
| `GET /auth/login` | — | 302 to GitHub authorize (or straight to `editorPath` in local mode) |
| `GET /auth/callback` | `?code&state` | Sets the session cookie, 302 to `editorPath` |
| `POST /auth/logout` | — | Clears the session cookie |
| `GET /me` | — | `{ login, repo }` |
| `GET /files` | `?dir=` (default `contentDir`) | `{ files: FileMeta[] }` |
| `GET /entries` | `?dir=` (default `contentDir`) | `{ entries: [{ path, sha, frontmatter }] }` — listing + parsed frontmatter in one round trip; bodies excluded |
| `GET /collections` | — | `{ collections: CollectionSpec[] }` — resolved from `configPath` per request (baked registry as fallback) |
| `POST /collections` | `{ name, dir?, fields }` | 201 `{ collection, commit }` — writes the config file via the provider; 409 duplicate, 400 + `problems` invalid |
| `PUT /collections/:name` | `{ fields }` | `{ collection, commit }` — replaces the field schema (`dir` is immutable) |
| `GET /file` | `?path=` | `{ path, content, sha }` |
| `PUT /file` | `{ path, content, message?, expectedSha? }` | `{ commit, diagnostics }` |
| `DELETE /file` | `{ path, message?, expectedSha? }` | `{ commit }` |
| `POST /media` | `{ path, dataBase64, message? }` | 201 `{ commit, path }` |

Semantics worth knowing:

- **Path confinement.** Every `path`/`dir` is checked with `assertSafePath`
  and must live under `contentDir/` or `mediaDir/`. Traversal or out-of-tree
  paths are a 400.
- **Server-side validation.** `PUT /file` on a `.mdx`/`.md` path re-runs the
  MDMX validator (and the collection's frontmatter schema) on the server — the
  editor client is never trusted. Unparseable MDX is a 400; error diagnostics
  are a 422 in `strict` mode, or saved-and-returned in `report` mode.
- **Collections are config-as-code.** The collection routes read and write
  `mdmx.config.json` through the provider, so a collection created from the
  dashboard is live immediately — no regenerate, no redeploy — and the change
  is a normal conflict-safe commit. Collection/field names must match
  `^[a-z0-9][a-z0-9_-]*$` and a collection's `dir` must sit under
  `contentDir`.
- **Optimistic concurrency.** Pass `expectedSha` (the git blob sha you read)
  on writes and deletes. If someone else changed the file since, the provider
  raises a conflict and the API returns **409** — refetch, merge, retry. Pass
  `expectedSha: null` to assert "this file must not exist yet" (used when
  creating).
- **CSRF.** Mutations with a cross-origin `Origin` header are rejected (403).
- **Media rules.** Uploads must land under `mediaDir`, carry an image
  extension (`png jpg jpeg gif webp avif`), be non-empty, fit
  `maxMediaBytes`, and never overwrite an existing path.

## Error status map

| Status | Meaning |
| --- | --- |
| 400 | Unsafe path, unparseable MDX, bad payload, unsupported media type |
| 401 | No/expired session, or repo access revoked on re-verification |
| 403 | Cross-origin mutation, or GitHub says no push permission |
| 404 | Unknown route or file not found |
| 409 | Write conflict — `expectedSha` didn't match |
| 413 | Media exceeds `maxMediaBytes` |
| 422 | Validation failed (`strict` mode); body contains `diagnostics` |

Next: [mount the editor →](04-editor.md)
