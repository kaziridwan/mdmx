# Architecture

## The pipeline

MDMX is a pipeline with three representations of a document and a codegen
side-channel that types it all.

```
                 mdmx generate (CLI)
   components/*.tsx ─────────────────────►  .mdmx/registry.json  (data)
        │  defineMDMX()                      .mdmx/registry.ts    (bindings)
        │                                          │
        │                                          ▼  drives
        ▼                              ┌───────────────────────────┐
   (the user's React components)       │ validator · palette ·     │
                                       │ schema · prop panel       │
                                       └───────────────────────────┘

   MDX text  ⇄  mdast  ⇄  ProseMirror doc
   (storage)    (hub)       (editing)
      │           │
      │           └── validate.ts → diagnostics (MDMX001–007)
      │
      ▼
   ContentProvider (GitHub Git Data API | local FS)  →  git repo
      │
      ▼
   build-time readers (getDocuments) → site render with registry components
```

Key property: **mdast is the hub** (ADR-009). Text never converts directly to
ProseMirror; both directions go through mdast, so one parse path serves the
validator, CLI, and editor, and round-trip tests run headlessly.

## The five packages

| Package | Depends on | Role |
| --- | --- | --- |
| `@mdmx/core` | (nothing heavy) | The format: parse, validate, serialize; Registry; defineMDMX; ContentProvider contract + path safety. Zero React/Next. |
| `@mdmx/cli` | core | `mdmx generate` (type extraction → registry), `mdmx check` (lint). |
| `@mdmx/editor` | core | Registry→ProseMirror schema; mdast⇄PM converters; command/palette layer. React UI chrome pending. |
| `@mdmx/next` | core | LocalProvider, build-time readers, sealed sessions, GitHub OAuth, content/media API handlers. Editor mount page pending. |
| `@mdmx/provider-github` | core | GitHubProvider over the Git Data API: atomic multi-file commits, conflict detection. |

Dependency discipline (ADR, Invariant #9): everything depends on `core`;
`core` depends on nothing heavy; siblings never depend on each other except
through `core`. This is what keeps a future VS Code extension or standalone
use possible.

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
