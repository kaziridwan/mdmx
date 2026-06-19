# iMDX

A git-native CMS for Next.js, built around **iMDX** — a strict, round-trippable
subset of MDX where your own React components are first-class editor blocks.

Think Outstatic's model (CMS mounted inside your Next.js app, content committed
to your GitHub repo) with a Notion-style block editor that renders *your*
components live, driven by a generated component registry.

## Packages

| Package | Status | Purpose |
| --- | --- | --- |
| `@imdx/core` | ✅ implemented | iMDX spec: parser, validator (diagnostics `IMDX001`–`IMDX007`), canonical serializer, registry types, `defineIMDX()` |
| `@imdx/cli` | ✅ implemented | `imdx generate` (TS compiler API prop extraction → registry.json + registry.ts), `imdx check` (content lint, CI-ready exit codes), and `imdx dev` (watch components/config → debounced, hash-diffed registry regenerate) |
| `@imdx/editor` | ✅ implemented | Registry→ProseMirror schema, `fromMdast`/`toMdast` converters (byte-level round-trip tests), command/palette layer, and the **React editor** under `@imdx/editor/react` — React NodeViews on raw ProseMirror (ADR-023), rail palette, slash menu, prop panel, live-source pane, **nested editing** (TwoColumn, ADR-021), and a **media library** (`MediaSource` adapter + browser/uploader, ADR-027). Run it via `examples/editor-playground`. Drop-indicator polish pending |
| `@imdx/next` | ✅ implemented | LocalProvider, content readers, encrypted sessions (AES-GCM cookies), GitHub OAuth with push-permission authz + 5-min re-verification, full content/media API handlers (web-standard Request→Response, mountable as App Router routes), and a no-OAuth `localMode` for local authoring. The editor mount page + a runnable app live in `examples/demo-next` |
| `@imdx/provider-github` | ✅ implemented | Git Data API provider: atomic multi-file commits (blobs→tree→commit→ref), optimistic concurrency via blob shas, path-safety guards; tested against an in-memory GitHub fake |

## The iMDX subset (v1)

iMDX is validated as a whitelist over the standard MDX AST:

- CommonMark + GFM slice: headings, emphasis, lists, blockquotes, code,
  tables, task lists, thematic breaks
- Block-level JSX for **registered components only**
- **Props are JSON**: string/number/boolean/null literals, arrays, plain
  objects, unary minus — no identifiers, calls, templates, or spreads
- No `import`/`export`, no `{expressions}`, no raw HTML, no inline JSX,
  no reference-style links, no footnotes
- Children policies per component: `none` | `rich-text` | `blocks`, plus
  `allowedParents` / `allowedChildren` slot constraints
- YAML frontmatter for metadata

The serializer emits one **canonical form** (pinned remark-stringify +
mdx-jsx options) so saves produce minimal git diffs. Changing canonical
formatting is treated as a semver-major change.

## Repo guides

- **SPEC.md** — the iMDX v1 grammar, canonical form, registry schema, diagnostics, provider contract
- **AGENTS.md** / **CLAUDE.md** — context for AI coding agents (invariants, build gotchas)
- **llms.txt** — machine-readable index
- **examples/demo** — minimal consumer; `pnpm exec imdx generate && pnpm exec imdx check` inside it
- **examples/demo-next** — a complete, runnable Next.js app: edit components-as-blocks and save canonical iMDX to the local repo, no GitHub needed (`pnpm --filter demo-next dev`). See its README
- **examples/editor-playground** — Vite harness for developing the editor UI in isolation

## Development

```sh
pnpm install
pnpm test          # builds @imdx/core, then runs all 152 tests across packages
pnpm build         # build all packages
pnpm check         # typecheck all packages
```

Convenience wrappers for the multi-step flows live in [`scripts/`](scripts/)
(also as `pnpm` aliases):

```sh
pnpm dev:next        # build deps + run the local Next.js CMS (examples/demo-next)
pnpm dev:playground  # build deps + run the Vite editor playground
pnpm generate        # regenerate .imdx/registry.* for every example app
pnpm verify          # typecheck + test (pre-push gate)
pnpm clean           # remove build artifacts (--all also wipes node_modules)
```

Key guarantees under test in `@imdx/core`:

- `toMDX(parseMDX(x))` is a fixed point (idempotent canonicalization)
- ASTs survive serialize → parse cycles structurally
- Editing one prop changes exactly one line of output
- Every diagnostic code fires on its violation and only then

## Roadmap

1. **Phase 1 (spine)** — core ✅ · CLI `generate` via react-docgen-typescript ·
   editor with core blocks + leaf components + prop panel · GitHub provider ·
   Next.js mount with OAuth
2. **Phase 2** — collections + draft/publish ✅ (typed frontmatter, canonical
   YAML, editor panel); next: container components with nested editing, media
   library, `imdx check` in CI
3. **Phase 3** — segment composer, GitLab / generic git providers, collab (Yjs)
