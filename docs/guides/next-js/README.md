# Integrating MDMX into a Next.js site

MDMX is a git-native CMS you mount **inside your own Next.js app**. Your React
components become first-class blocks in a Notion-style editor; edits save as
canonical MDMX (a strict, round-trippable subset of MDX) committed to your git
repo. There is no external CMS service and no database — content lives next to
the code that renders it.

This guide series walks through the full integration, from an empty App Router
project to a deployed CMS backed by GitHub OAuth.

## The guides

| # | Guide | What you set up |
| --- | --- | --- |
| 1 | [Installation & project setup](01-installation.md) | Packages, `next.config`, directory layout, build scripts |
| 2 | [Components & the registry](02-components-and-registry.md) | `defineMDMX()`, `mdmx.config.json`, collections, `mdmx generate` / `check` / `dev` |
| 3 | [The content API](03-content-api.md) | `createMDMXHandlers()` mounted as an App Router route, `localMode` + `LocalProvider` |
| 4 | [Mounting the editor](04-editor.md) | The `/edit` page, `MDMXEditor`, conflict-safe saves, the media library |
| 5 | [Rendering content](05-rendering-content.md) | `getDocuments()` / `getDocumentBySlug()`, draft/publish, rendering MDMX on the public site |
| 6 | [Production: GitHub mode](06-production-github.md) | GitHub OAuth app, sealed sessions, `GitHubProvider`, deployment |
| 7 | [Troubleshooting](07-troubleshooting.md) | Common errors, HTTP status meanings, diagnostic codes |

## How the pieces fit

```
components/mdmx/*.tsx ──(mdmx generate)──► .mdmx/registry.{json,ts}
        │                                        │
        │ your components                        │ drives validation, the editor
        ▼                                        ▼ palette, and prop panels
   public site  ◄──(getDocuments)── content/*.mdx ◄──(save)── MDMXEditor
                                         ▲                        │
                                         └── ContentProvider ◄────┘
                                             (local FS in dev, GitHub in prod)
```

Four packages participate in a Next.js integration:

- **`@mdmx/core`** — the format: parser, validator, canonical serializer,
  `Registry`, `defineMDMX()`. No React, no Next.js.
- **`@mdmx/cli`** — `mdmx generate` (components → registry), `mdmx check`
  (content lint for CI), `mdmx dev` (watch mode).
- **`@mdmx/editor`** — the block editor. The React UI lives at
  `@mdmx/editor/react`.
- **`@mdmx/next`** — the glue: API route handlers, content readers,
  sessions/OAuth, and `LocalProvider` for local authoring.

In production a fifth package, **`@mdmx/provider-github`**, commits saves to
GitHub via the Git Data API (atomic multi-file commits, conflict detection).

## The two modes

| | Local mode | GitHub mode |
| --- | --- | --- |
| Who it's for | Local authoring, prototyping | A deployed CMS your collaborators log into |
| Auth | None (synthetic `local` session) | GitHub OAuth; push permission on the repo ⇒ CMS access |
| Writes go to | The working tree via `LocalProvider` | Atomic commits via `GitHubProvider` |
| Config | `localMode: true` | `auth` + `sessionSecret` + `createProvider` |

Guides 1–5 build the local-mode integration end to end; guide 6 converts it to
GitHub mode. Validation, path safety, CSRF-origin checks, and conflict
detection apply in both modes.

## A working reference

Everything in these guides is wired up and runnable in
[`examples/demo-next`](../../../examples/demo-next/) — when a snippet here
leaves you unsure, the demo app is the ground truth:

```sh
pnpm install
pnpm dev:next        # builds deps, generates the registry, runs next dev
```

## Prerequisites

- Next.js 14+ with the **App Router** (the API handlers are web-standard
  `Request → Response` functions, which the Pages Router's API routes don't
  accept).
- React 18+.
- Node 20+.
- Content directory tracked by git (that's the point).
