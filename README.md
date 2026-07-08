# MDMX

A git-native CMS for Next.js, built around **MDMX** — a strict, round-trippable
subset of MDX where your own React components are first-class editor blocks.

Think Outstatic's model (CMS mounted inside your Next.js app, content committed
to your GitHub repo) with a Notion-style block editor that renders *your*
components live, driven by a generated component registry.

## Packages

| Package | Status | Purpose |
| --- | --- | --- |
| `@mdmx/core` | ✅ implemented | MDMX spec: parser, validator (diagnostics `MDMX001`–`MDMX007`), canonical serializer, registry types, `defineMDMX()` |
| `@mdmx/cli` | ✅ implemented | `mdmx generate` (TS compiler API prop extraction → registry.json + registry.ts), `mdmx check` (content lint, CI-ready exit codes), and `mdmx dev` (watch components/config → debounced, hash-diffed registry regenerate) |
| `@mdmx/editor` | ✅ implemented | Registry→ProseMirror schema, `fromMdast`/`toMdast` converters (byte-level round-trip tests), command/palette layer, and the **React editor** under `@mdmx/editor/react` — React NodeViews on raw ProseMirror (ADR-023), rail palette, slash menu, prop panel, live-source pane, **nested editing** (TwoColumn, ADR-021), and a **media library** (`MediaSource` adapter + browser/uploader, ADR-027). Run it via `examples/editor-playground`. Drop-indicator polish pending |
| `@mdmx/next` | ✅ implemented | LocalProvider, content readers, encrypted sessions (AES-GCM cookies), GitHub OAuth with push-permission authz + 5-min re-verification, full content/media/collections API handlers (web-standard Request→Response, mountable as App Router routes; collections resolved from config at request time, ADR-035), and a no-OAuth `localMode` for local authoring |
| `@mdmx/dashboard` | ✅ implemented | **The drop-in CMS** (ADR-034): mount two ~3-line files and get the full dashboard at `/mdmx` — auth gate, collection + entry management, new-entry scaffolding, the embedded block editor, media library, settings with a theme pin, ⌘K quick-open — styled by a shipped light+dark token stylesheet. `examples/demo-next` is exactly that consumer app |
| `@mdmx/provider-github` | ✅ implemented | Git Data API provider: atomic multi-file commits (blobs→tree→commit→ref), optimistic concurrency via blob shas, path-safety guards; tested against an in-memory GitHub fake |

## The MDMX subset (v1)

MDMX is validated as a whitelist over the standard MDX AST:

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

- **docs/guides/next-js/** — step-by-step integration guides: mount MDMX in a Next.js site, from install to GitHub-mode production
- **SPEC.md** — the MDMX v1 grammar, canonical form, registry schema, diagnostics, provider contract
- **AGENTS.md** / **CLAUDE.md** — context for AI coding agents (invariants, build gotchas)
- **llms.txt** — machine-readable index
- **examples/demo** — minimal consumer; `pnpm exec mdmx generate && pnpm exec mdmx check` inside it
- **examples/demo-next** — a complete, runnable Next.js app: the two-file dashboard mount over `@mdmx/dashboard`; edit components-as-blocks and save canonical MDMX to the local repo, no GitHub needed (`pnpm dev:next`). See its README
- **examples/editor-playground** — Vite harness for developing the editor UI in isolation

## Development

```sh
pnpm install
pnpm test          # builds all packages, then runs all 269 tests
pnpm build         # build all packages
pnpm check         # typecheck all packages
```

Convenience wrappers for the multi-step flows live in [`scripts/`](scripts/)
(also as `pnpm` aliases):

```sh
pnpm dev:next        # build deps + run the local Next.js CMS (examples/demo-next)
pnpm dev:playground  # build deps + run the Vite editor playground
pnpm generate        # regenerate .mdmx/registry.* for every example app
pnpm verify          # typecheck + test (pre-push gate)
pnpm clean           # remove build artifacts (--all also wipes node_modules)
```

Key guarantees under test in `@mdmx/core`:

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
   library, `mdmx check` in CI
3. **Phase 2.5 (0.4.0)** — the drop-in dashboard ✅: `@mdmx/dashboard` two-file
   mount, collections managed from the UI (config-as-code, live without
   redeploy), media library, settings, quick-open; Next 15 + React 19
4. **Phase 3** — segment composer, GitLab / generic git providers, collab (Yjs)
