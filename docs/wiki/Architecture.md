# Architecture

## The pipeline

MDMX is a pipeline with three representations of a document and a codegen
side-channel that types it all.

```
                 mdmx generate (CLI)
   components/*.tsx ─────────────────────►  .mdmx/registry.json  (data)
        │  defineMDMX()                      .mdmx/registry.ts    (server map)
        │                                    .mdmx/components.ts  (client map)
        │                                    .mdmx/server.ts      (bound helpers)
        │                                    .mdmx/studio.css     (studio styles)
        │                                          │
        │                                          ▼  drives
        ▼                              ┌───────────────────────────┐
   (the user's React components)       │ validator · palette ·     │
                                       │ schema · prop panel       │
                                       └───────────────────────────┘

   MDX text  ⇄  mdast  ⇄  ProseMirror doc
   (storage)    (hub)       (editing)
      │           │
      │           └── validate.ts → diagnostics (MDMX001–009)
      │
      ▼
   ContentProvider (GitHub Git Data API | local FS)  →  git repo
      │
      ▼
   build-time readers (listEntries/getEntry) → site render with registry components
```

Key property: **mdast is the hub** (ADR-009). Text never converts directly to
ProseMirror; both directions go through mdast, so one parse path serves the
validator, CLI, and editor, and round-trip tests run headlessly.

## The eight packages

| Package | Depends on | Role |
| --- | --- | --- |
| `@mdmx/core` | (nothing heavy) | The format: parse, validate, serialize; Registry; defineMDMX; collections config derivation; ContentProvider contract + path safety. Zero React/Next. |
| `@mdmx/project` | core | What a project on disk looks like: `mdmx.config.*` schema + loading (json and mjs), environment/mode resolution (fail-closed in production), registry loading. Node-only, framework-free (ADR-043). |
| `@mdmx/studio` | core | Component Studio: template model, validation, registry merge (code beats studio), TSX eject, one `{props.x}` implementation; `/react` holds the single template→React renderer (ADR-045). |
| `@mdmx/cli` | core, project, studio | `mdmx init` (scaffold), `mdmx generate` (registry + both component maps + bound server helpers + studio CSS), `mdmx check` (lint + stale-registry detection), `mdmx dev` (watch). |
| `@mdmx/editor` | core | Registry→ProseMirror schema; mdast⇄PM converters; command/palette layer; the React editor UI under `/react`. Headless — ships no CSS. |
| `@mdmx/next` | core | LocalProvider, build-time readers, sealed sessions, GitHub OAuth, content/media/collections API handlers (request-time collection resolution, ADR-035). |
| `@mdmx/provider-github` | core | GitHubProvider over the Git Data API: atomic multi-file commits, conflict detection. |
| `@mdmx/dashboard` | core + editor + next | **The app layer** (ADR-034): the drop-in CMS — two-file mount, shell, views, quick-open, shipped light+dark stylesheet that also themes the embedded editor. |

Dependency discipline (ADR-034 amends Invariant #9): every *library* package
depends only on `core`; `@mdmx/dashboard` is the one composition point above
them, and nothing depends on it. This is what keeps a future VS Code
extension or standalone use possible.

## Why the seams are where they are

- **core has no React** so the CLI and CI can load the registry and run the
  validator without a DOM or a React runtime.
- **The ContentProvider interface is in core** (not in provider-github) so
  GitHub assumptions don't leak into the editor, and a GitLab/local provider
  is a drop-in (ADR-014).
- **The registry is two files** (ADR-007): JSON (environment-agnostic data)
  and TS (the only thing importing real component code). The same registry
  object drives both the editor and the production site render, which is what
  guarantees WYSIWYG matches production.

## Request lifecycle (editor save)

1. Editor serializes its ProseMirror doc → canonical MDMX (`toMdast`→`toMDX`).
2. `PUT /api/mdmx/file` with `{path, content, expectedSha}`.
3. Handler: check session → re-verify repo permission (≤5 min cache) →
   origin check → `assertSafePath` + prefix confinement → **re-run validator**
   → `provider.commit([...], msg, {expectedShas})`.
4. Provider: blobs → tree (base merge) → commit → fast-forward ref. Conflict
   on stale sha → 409.
5. Host rebuilds; build-time readers parse content and render with the
   registry components.

See [Packages](Packages.md) for the per-module detail and
[Invariants](Invariants.md) for the rules each step upholds.
