# Project status

Snapshot of the MDMX monorepo at packaging time. For the full picture read
**README.md** (overview), **SPEC.md** (the MDMX v1 spec), and **AGENTS.md**
(contributor/agent guide with the nine invariants).

## At a glance

- **v0.3.1** — all five packages at `0.3.1`.
- **210 tests passing**, all five packages typecheck clean under strict TS.
- The entire **headless pipeline is implemented and tested**: define a
  component → generate a typed registry → edit content as a validated block
  document → serialize to canonical MDMX → commit atomically to GitHub with
  conflict safety → read back at build time.
- The **flat React editor UI is built** (`@mdmx/editor/react`): React NodeViews
  on raw ProseMirror (ADR-023) over the existing schema/converters, with the
  rail palette, slash menu, prop panel, the signature live-source pane, and a
  save toolbar. Develop it in isolation via `examples/editor-playground`.
- A **runnable local Next.js app** (`examples/demo-next`) dogfoods the full loop:
  collection-driven home → per-collection lists → **create a new post** → edit →
  save canonical MDMX to disk, conflict-safe, no GitHub needed (`@mdmx/next`
  `localMode`, ADR-024). Breadcrumb navigation throughout; the editor accepts
  pasted images (uploaded into a per-collection media dir) and places the caret
  when you click the canvas below the last block (ADR-033).

## Package status

| Package | State | Tests |
| --- | --- | --- |
| `@mdmx/core` | done — parser, validator (MDMX001–009), canonical serializer, Registry, defineMDMX, collections/frontmatter, provider contract + path safety | 38 |
| `@mdmx/cli` | done — `mdmx generate` (TS-compiler-API extraction → registry.json/.ts), `mdmx check` (content lint), `mdmx dev` watch | 19 |
| `@mdmx/editor` | converters + command layer + React UI (`@mdmx/editor/react`): rail/slash/prop/source, nested editing, media library, paste-to-upload, caret-at-edge | 109 |
| `@mdmx/next` | done — LocalProvider, content readers, sealed sessions, GitHub OAuth, content/media API handlers, `localMode` for local authoring | 37 |
| `@mdmx/provider-github` | done — Git Data API, atomic multi-file commits, conflict detection | 7 |

## Run it

```sh
pnpm install
pnpm test        # builds core, then runs all package tests
pnpm build       # builds all packages
pnpm check       # typechecks all packages

# end-to-end demo of the CLI pipeline
pnpm build
cd examples/demo
node ../../packages/cli/dist/bin.js generate   # writes .mdmx/registry.{json,ts}
node ../../packages/cli/dist/bin.js check      # lints content/ against the registry
```

Run the real editor inside a Next.js app (local, no GitHub):

```sh
pnpm --filter @mdmx/core build && pnpm --filter @mdmx/cli build
pnpm --filter @mdmx/editor build && pnpm --filter @mdmx/next build
pnpm --filter demo-next dev      # runs mdmx generate, then next dev → localhost:3000
```

Open a document, edit it (slash menu, rail drag, prop panel, live source pane),
hit **Save** — the canonical MDMX is written to `examples/demo-next/content/`.
For developing the editor UI in isolation there's also
`pnpm --filter editor-playground dev` (Vite); `examples/editor-prototype.html`
remains the original self-contained design spec.

Collections & draft/publish are done (ADR-025): typed frontmatter in config,
validated (MDMX008/009), edited via the editor's document panel (canonical YAML);
the demo groups its list into Published/Drafts.

## What's next (Phase 2 cont.)

TwoColumn / nested editing (ADR-021), `mdmx dev` watch mode (ADR-026), the
media library + `image`-control Browse (ADR-027, ADR-029), and region-aware
nested insertion + context-aware slash palette (ADR-028) have landed. Remaining:

1. A GitHub-mode deploy guide (drop `localMode`; wire OAuth + `GitHubProvider`).
2. HMR: push registry changes from `mdmx dev` into a running editor.
3. Visual drop indicator for rail (new-component) drags into nested containers.

Phase 2/3 (collections, draft/publish workflow, media library UI, segment
composer, GitLab provider, Yjs collaboration) are scoped in README.md.
