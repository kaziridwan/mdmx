# Project status

Snapshot of the MDMX monorepo. For the full picture read **README.md**
(overview), **SPEC.md** (the MDMX v1 spec), and **AGENTS.md** (contributor/
agent guide with the nine invariants).

## At a glance

- **v0.4.1** — all six packages at `0.4.1`.
- **285 tests passing**, all packages typecheck clean under strict TS.
- The entire **headless pipeline is implemented and tested**: define a
  component → generate a typed registry → edit content as a validated block
  document → serialize to canonical MDMX → commit atomically to GitHub with
  conflict safety → read back at build time.
- **`@mdmx/dashboard` is a drop-in CMS** (ADR-034): mount one page + one API
  route and get the full authoring UI — collections, entry tables, embedded
  editor, media library, quick-open, settings, and (new in 0.4.1) the
  **Component Studio**.
- **0.4.1 highlights** (session S24, ADR-036/037/038):
  - **Responsive preview modes** — the editor canvas renders at real device
    widths (mobile 390 / tablet 768 / desktop 1280) zoomed to fit; author
    components reflow via container queries, and container components
    finally lay out child blocks as real grid/flex items in the editor.
  - **`draft | private | published`** — private entries render at
    `/private/<collection>/<slug>` behind the MDMX session (`getSession` /
    `privateHref`); a real mdast→React renderer ships as
    `@mdmx/next/render`, and demo-next has a public site proving all three
    modes.
  - **Component Studio** — build Tailwind-styled components in the browser
    (HTML source + live preview, click-to-select inspector, element
    palette); stored as sanitized template-tree JSON in
    `content/_components/`, live in the editor immediately (localMode *and*
    GitHub mode), rendered via the Tailwind v4 browser runtime, and
    ejectable to a real `defineMDMX` TSX file.

## Package status

| Package | State | Tests |
| --- | --- | --- |
| `@mdmx/core` | done — parser, validator (MDMX001–009), canonical serializer, Registry, defineMDMX, collections/frontmatter, provider contract + path safety, studio model + eject codegen | 55 |
| `@mdmx/cli` | done — `mdmx generate`, `mdmx check` (merges studio defs), `mdmx dev` watch | 19 |
| `@mdmx/editor` | converters + command layer + React UI: rail/slash/prop/source, nested editing, media library, paste-to-upload, viewport preview modes | 109 |
| `@mdmx/next` | done — LocalProvider, content readers, sealed sessions + viewer guard, GitHub OAuth, content/media/collections/studio API handlers, `localMode`, `/render` subpath | 57 |
| `@mdmx/dashboard` | done — drop-in dashboard: shell, collections, entries, editor, media, settings, quick-open, Component Studio | 38 |
| `@mdmx/provider-github` | done — Git Data API, atomic multi-file commits, conflict detection | 7 |

## Run it

```sh
pnpm install
pnpm test        # builds all packages, then runs all suites
pnpm build       # builds all packages
pnpm check       # typechecks all packages

# full local CMS (install + build + demo app on :3000)
pnpm dev-next
```

Open `http://localhost:3000` for the demo's public site (published posts;
private posts show for authenticated sessions — always, in localMode) and
`http://localhost:3000/mdmx` for the dashboard. In the editor, switch the
viewport (mobile/tablet/desktop) from the toolbar. Under **Studio**, build a
component from HTML + Tailwind classes and insert it into a post from the
rail or slash menu — no rebuild. For editor-UI work in isolation:
`pnpm --filter editor-playground dev` (Vite).

## What's next

1. A GitHub-mode deploy guide (drop `localMode`; wire OAuth + `GitHubProvider`).
2. HMR: push registry changes from `mdmx dev` into a running editor.
3. Studio components with children regions (v1 defs are leaf components).
4. Visual drop indicator for rail (new-component) drags into nested containers.
5. The 0.5 pre-release architecture review (see `.dev-context/sessions`).

Phase 3 (segment composer, GitLab provider, Yjs collaboration, GitHub App
auth) is scoped in `docs/wiki/Roadmap.md`.
