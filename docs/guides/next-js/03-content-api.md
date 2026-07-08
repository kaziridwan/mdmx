# 3 · The content API

`createMDMXHandlers()` from `@mdmx/next` builds the CMS backend: auth, file
listing/read/write/delete, and media upload, as **web-standard
`Request → Response` handlers**. In the App Router you mount them as a
catch-all route and export them directly.

## Mount the route

```ts
// app/api/mdmx/[...route]/route.ts
import { createMDMXHandlers, LocalProvider } from "@mdmx/next";
import {
  CONTENT_DIR,
  MEDIA_DIR,
  REPO,
  projectRoot,
  registry,
} from "../../../../lib/mdmx-config";

export const { GET, POST, PUT, DELETE } = createMDMXHandlers({
  repo: REPO,
  contentDir: CONTENT_DIR,
  mediaDir: MEDIA_DIR,
  localMode: true, // local authoring — see guide 6 for production
  createProvider: () => new LocalProvider(projectRoot()),
  registry: registry(),
  validation: "report",
  insecureCookies: true, // http://localhost
});

export const dynamic = "force-dynamic";
```

`export const dynamic = "force-dynamic"` matters: the route reads and writes
the filesystem per request and must never be statically optimized.

The route segment (`app/api/mdmx/…`) must match the `basePath` option
(default `/api/mdmx`) — the handler derives its internal route from the URL.

## Local mode

`localMode: true` skips GitHub OAuth entirely: every request runs as a
synthetic `"local"` session, and `LocalProvider(rootDir)` reads and writes the
working tree directly. You edit, hit save, and `git diff` shows a minimal
canonical change — commit it like any other edit.

Everything else still applies in local mode: server-side validation,
path-safety confinement, CSRF-origin checks on mutations, and conflict
detection via blob shas. **Never enable `localMode` in production** — it is
an authentication bypass by design.

## Options reference (`MDMXHandlerOptions`)

| Option | Required | Default | Meaning |
| --- | --- | --- | --- |
| `repo` | ✅ | — | `{ owner, name, branch }`. In local mode the values are informational (shown by `/me`); in GitHub mode they identify the repo for auth + commits |
| `contentDir` | ✅ | — | Directory (repo-relative) writes of content are confined to |
| `mediaDir` | ✅ | — | Directory media uploads are confined to (e.g. `public/media`) |
| `createProvider` | ✅ | — | `(session) => ContentProvider` — `LocalProvider` locally, `GitHubProvider` in production |
| `localMode` | | `false` | Skip OAuth, synthetic session. Development only |
| `auth` | in GitHub mode | — | `{ clientId, clientSecret }` of the GitHub OAuth app (+ optional `apiBase`/`oauthBase` for GHE) |
| `sessionSecret` | in GitHub mode | — | Secret sealing the session cookie (AES-GCM) |
| `registry` | | — | When present, `.mdx` saves are re-validated server-side against it |
| `configPath` | | `"mdmx.config.json"` | Project config file collections are resolved from at request time and written back to by the collection routes |
| `validation` | | `"report"` | `"report"`: save and return diagnostics. `"strict"`: reject saves with error diagnostics (422) |
| `basePath` | | `"/api/mdmx"` | Route prefix the handlers are mounted under |
| `editorPath` | | `"/mdmx"` | Where to redirect after login |
| `insecureCookies` | | `false` | Allow cookies over plain HTTP (development) |
| `maxMediaBytes` | | 10 MiB | Upload size limit (413 beyond it) |

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
| `GET /documents` | `?dir=` (default `contentDir`) | `{ documents: [{ path, sha, frontmatter }] }` — listing + parsed frontmatter in one round trip; bodies excluded |
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
