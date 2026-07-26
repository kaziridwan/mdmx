# Session Log

Chronological record of what each work session changed. **Newest at the top.**
Every session appends one entry (see the template at the bottom and the upkeep
rule in `AGENTS.md`).

Entries below the divider were reconstructed from the commit history of the
initial design-and-build conversation (12 commits).

---

<!-- APPEND NEW ENTRIES ABOVE THIS LINE -->

### S27 — M1: 0.5 correctness blockers (release/0.5.0)
Executed milestone M1 of `.dev-context/plans/2026-07-26-0.5-plan.md` — the
S25 review's §5 blockers plus the W1 additions, each with a regression test:
- **core**: `collectionForPath` longest-prefix compared normalized vs raw
  lengths (a `"./"`-prefixed dir got a head start); props built on
  null-prototype objects (`__proto__` attr/key can no longer rebind);
  MDMX006 uses `Object.hasOwn` (required prop named `toString` now
  reported); cli `check` normalizes win32 separators before collection
  matching.
- **cli**: a non-exported `defineMDMX` component is now excluded from both
  registry artifacts with an actionable warning (previously emitted a
  non-compiling registry.ts).
- **editor**: multiselect display/coerce made symmetric
  (`displayControlValue` takes the control; arrays display comma-joined);
  `Control` gained a real multiselect input.
- **dashboard**: `ApiError` carries the server's `problems[]` (collection
  form validation visible again); field-draft default round-trip fixed for
  multiselect (array, not JSON string) and advanced/json string defaults
  (JSON-encoded both ways); CollectionView delete failures surface as an
  error line instead of an unhandled rejection.
- **next**: `clearCookie` honors `insecureCookies` (dev logout works over
  http); GitHub mode without `auth`/`sessionSecret` fails at factory time
  with a named-option error; 5-minute re-verify distinguishes AuthError
  (401 + clear) from transport failure (503, session kept); API responses
  send `cache-control: no-store`; collection existence checks use
  `Object.hasOwn` (a collection named `constructor` works).
- **provider-github**: lost ref-update race (non-fast-forward 422) maps to
  `ConflictError` (409 conflict UX); truncated tree listing throws a
  deliberate 500 instead of an accidental unhandled crash. (Blob-read
  truncation fix deferred to M2, landing with the D9 binary `read()`.)
- **demo-next**: passes its own `mdmx check` again (empty `<Stat />` given
  real props, `losslessly.asd` typo, roadmap.mdx trailing newline).
- Files/packages changed: all six packages + demo content (see commit).
- ADRs: none (implements S25 findings; decisions were ADR-039…048 in S26).
- Tests: **303** (was 285; +18 regression tests), `pnpm verify` green.
- Wiki pages touched: SessionLog. (Version/test-count sync in README /
  wiki/Home stays in M2 per the plan.)
- Follow-ups: M2 — the breaking wave (package splits, provider contract v2,
  auth seam, entry rename, export prune).

### S26 — 0.5 decisions locked: grilling session over the S25 review (no code changes)
Question-by-question architecture grilling against the session objectives
(quick recipe / extensible / layered API). Fifteen decisions made, resolving
all seven of the S25 review's open decisions (two against its leans) and
adding structural calls the review didn't propose. Consolidated into
`.dev-context/plans/2026-07-26-0.5-plan.md` (decisions D1–D15, milestones
M1–M5, target recipe, post-0.5 package graph — that doc wins where it and
the S25 review disagree). Headlines: convention-over-configuration as the
standing API principle (three-tier config, env-detected mode, fail-closed
production); codegen owns the convention layer (generated client/server
component maps, bound `.mdmx/server.ts` with `getEntry`/`MDMXEntry`,
committed deterministic `.mdmx/`); `mdmx init nextjs`; build-time
`studio.css` (supersedes the CDN-runtime posture); two new packages —
`@mdmx/project` (config/env/mode resolution) and `@mdmx/studio` (model +
`/react` renderer + `/ui` screens behind an injected `StudioClient`);
provider contract v2 (deletions in the change set, binary reads, three
methods); `AuthStrategy` seam; document/entry vocabulary split on the layer
boundary; dashboard surface shrink + `export *` removal; 0.5 ends with the
first npm publish (the real freeze).
- Files/packages changed: none (docs only).
- ADRs: **ADR-039 … ADR-048** (ADR-042/045 supersede parts of ADR-038;
  ADR-048 amends ADR-034).
- Tests: 285, unchanged.
- Wiki pages touched: SessionLog; DECISIONS.md; plan doc added.
- Follow-ups: execute M1–M5 per the 2026-07-26 plan; sync Roadmap/Home/
  Packages pages when M2's package splits land.

### S25 — 0.5 pre-release architecture/API/DX review (no code changes)
Full-repo review session. Five parallel deep-read reviews (core+cli, editor,
next+provider-github, dashboard, consumer-experience/docs), findings
spot-verified, synthesized into
`.dev-context/plans/2026-07-10-0.5-architecture-review.md` (untracked): four
consumer surfaces, layering scorecard, package-by-package findings, 9
release-blocking correctness issues, 8 ranked workstreams (W1–W8), 7 open
decisions, and a do-not-change list. Headlines: repo-wide export-surface
inflation (last free prune before 0.5), the Component Studio's missing seam
(3× interpolation, 2× merge rule, untested outside core), five missing API
affordances (core `validateDocument`, `SaveResult` sha, zero-config
localMode, generated component maps, studio render helper), multiselect
corruption in both editor and dashboard, and a docs wave (guides/llms.txt lag
0.4.1; demo fails its own `mdmx check`).
- Files/packages changed: none (this entry only).
- ADRs: none — decisions deferred to the review doc's §7.
- Tests: 285, unchanged.
- Wiki pages touched: SessionLog.
- Follow-ups: execute W1–W8 per the review doc after §7 decisions.

### S24 — Road to 0.4.1: responsive preview modes, private publishing, Component Studio
Executed the 0.4.1 brief on `release/0.4.1` (autonomous run; one commit per
verified milestone, browser-driven end-to-end checks via playwright).

- **M1 — responsive preview modes** (ADR-036): mobile/tablet/desktop switch
  in the editor toolbar; canvas renders at real device width (390/768/1280)
  under CSS `zoom` scale-to-fit; canvas is a named inline-size container and
  the demo `mk-*` styles moved from `@media` to `@container` so modes
  actually reflow. Root cause fix shipped alongside: `.mdmx-content` +
  `.mdmx-contentdom` are `display: contents`, so grid/flex container
  components (FeatureGrid, PricingTable, TwoColumn) finally lay out child
  blocks as real items inside the editor. New `viewport.ts` (widths, storage,
  zoom math) exported from `@mdmx/editor/react`.
- **M2 — private status groundwork** (ADR-037): `status` gains `private`
  (demo config select; dashboard badge); `@mdmx/next` exports
  `getSession(cookieHeader, {sessionSecret|localMode})` and
  `privateHref(collectionPath, slug)`; `SESSION_COOKIE` moved to session.ts
  as shared API. +7 next tests.
- **M3 — public rendering** (ADR-037): new `@mdmx/next/render` subpath
  (react optional peer): `MDMXContent` renders mdast → React (markdown +
  GFM + component tags via `evaluateAttributes`); demo-next grew a public
  site — home lists published (+ Private section for sessions),
  `/posts/[slug]` published-only, `/private/[...path]` session-guarded
  private-only, drafts 404 everywhere. Newsletter became a client component
  (RSC boundary). Demo gains a private `team-notes` post.
- **M4 — studio backend** (ADR-038): core `studio.ts` — template-tree model
  (tag/attr allowlists, URL-scheme checks, node caps), validation,
  `studioComponentToSpec`, storage path under `<contentDir>/_components/`;
  `@mdmx/next` routes `GET/PUT/DELETE /studio/components(/:name)` via the
  provider (conflict-safe, collision-checked) and merges stored defs into
  save-time validation; `@mdmx/next/render` gains `studioComponent(def)`
  (tree → React, no dangerouslySetInnerHTML) + `getStudioComponentDefs`
  reader; dashboard merges defs into registry + ComponentMap after auth
  (rail "Studio" group, slash menu, prop panel, live render). +8 core tests.
- **M5 — studio UI stage 1**: `/mdmx/studio` list (live preview cards) +
  editor view: HTML+Tailwind source pane ⇄ sanitized tree (DOMParser in,
  pretty-printer out, dropped nodes reported), live in-page preview, prop
  schema builder, conflict-safe save. Tailwind v4 browser runtime
  (theme+utilities, **no preflight**; `tailwindSrc` config) loads on demand
  in the dashboard and on public demo pages using studio components. The
  initial studio fetch now gates dashboard rendering (registry swap would
  reset a mounted editor mid-typing).
- **M6 — studio UI stage 2**: click-to-select on the preview, inspector
  (class string, group-wise quick controls for padding/radius/type/colors/
  layout/gap, text editing with bind-text-to-prop, href/src/alt, delete),
  element palette (+Section/+Heading/+Text/+Button/+Image/+Row). All edits
  are immutable ops on the same tree the HTML pane serializes from
  (`template-edit.ts`).
- **M7 — eject to TSX** (ADR-038): core `studioComponentToTSX` codegen
  (typed props interface, Impl with defaults, JSX from tree, defineMDMX
  config); `POST /studio/components/:name/eject` writes
  `components/mdmx/<Name>.tsx` (never overwrites); def stays active until
  `mdmx generate` + rebuild promote the code version. `mdmx check` merges
  studio defs. Verified: ejected file extracts via the real generate
  pipeline and typechecks. +2 core tests.
- **M8 — release hygiene**: all packages 0.4.0 → 0.4.1; ADR-036/037/038;
  this entry; Packages/Roadmap/PROJECT_STATUS sync. Tests: 285 total
  (core 55, cli 19, editor 109, next 57, provider-github 7, dashboard 38).
- Wiki pages touched: SessionLog, Packages, Roadmap; DECISIONS.md;
  PROJECT_STATUS.md.
- Follow-ups: studio defs are leaf components (no children region yet);
  quick-control palette is a curated subset; `mdmx dev` HMR for studio defs
  not wired; pre-existing demo `welcome.mdx` has an empty `<Stat />`
  flagged by `mdmx check` (MDMX006, unrelated to 0.4.1).


### S23 — Road to 0.4.0: platform upgrade + `@mdmx/dashboard` scaffold (in progress)
Executing the 0.4.0 milestone plan on `release/0.4.0` (autonomous run; one
commit per green milestone). This entry grows as milestones land.

- **M1 — Next 15 + React 19** (`c913cf2`): next `^15.3` (→15.5.20),
  react/react-dom `^19` (→19.2.7) across demo-next, editor devDeps,
  playground, cli/demo type deps. Next 15 async request APIs: demo pages now
  `await params`. Editor mount tests: settle loop 4→8 ticks (React 19
  schedules nested-root renders across more macrotasks). Verified: 210 tests,
  demo production build, dev-server smoke (pages 200, content API serving).
- **M2 — `@mdmx/dashboard` scaffold** (ADR-034): new app-layer package
  (core+editor+next; amends Invariant #9 with the one composition point).
  Ships: `createDashboardPage()` optional-catch-all factory reading
  `.mdmx/registry.json` per request; `@mdmx/dashboard/next` re-exports the
  `@mdmx/next` surface (two ~3-line mount files); client `DashboardApp` with
  pure `resolveRoute(slug)` view router; `AuthGate` over `/me` (login screen
  / unreachable-API help / localMode auto-enter with "local" badge);
  `DashboardShell` (navbar, left nav, main, contextual right slot); typed
  API client (`UnauthorizedError` drops to login); shipped stylesheet
  (`--mdmx-*` tokens, light+dark, `data-mdmx-theme` override) imported by the
  package itself → zero-config styling via transpilePackages; `next/link`
  NodeNext-CJS interop shim. 19 new tests (routes/gate/shell). Root
  `test`/`check` now build all packages first. Demo mounts the dashboard at
  `/mdmx` alongside its old pages (replaced in M8); smoke-verified: `/mdmx`
  200, route-scoped CSS chunk contains tokens, `/me` answers local.
- **M3 — collections API, resolved at request time** (ADR-035): collections
  stay config-as-code; the API reads/writes `mdmx.config.json` **through the
  provider per request**, so dashboard-created collections are live without
  regenerate/redeploy in both modes. New: `configPath` option;
  `GET/POST /collections`, `PUT /collections/:name` (fields only; dir
  immutable; PUT not PATCH to keep the handler surface); registry fallback +
  seed-on-first-write migration; name/dir/control validation server-side
  (400 + problems, 409 duplicates); frontmatter validation in `PUT /file` now
  uses the request-time set (MDMX008 fires on a just-created collection —
  live-tested). Core: `collections-config.ts` (record⇄array derivation +
  `validateCollectionConfig` + standalone `collectionForPath`; CLI now reuses
  it). `/me` reports contentDir/mediaDir/validation/localMode. Dashboard:
  collections client methods, `DashboardContext` + live collection state
  behind the gate. +19 tests (7 core, 12 next) → 248 total.
- **M4 — dashboard core surfaces**: the CMS is now usable end to end from
  `/mdmx`. New `GET /documents?dir=` in `@mdmx/next` (listing + parsed
  frontmatter in one round trip; malformed files degrade to empty
  frontmatter, bodies excluded). Dashboard views: `CollectionView` (entry
  table with title/status badge/path, client filter, confirmed delete with
  listed sha), `EntryNewView` (title→slug scaffold via `scaffoldDocument` —
  moved from the demo into the package — committed `expectedSha: null`, then
  straight into the editor), `EditorView` (embedded `MDMXEditor` via
  `next/dynamic` `ssr:false` with CJS-interop shim; sha-refreshing saves;
  `MediaSource` adapter over the API; back-link to the collection),
  `CollectionFormView` (create + field-schema edit over a pure
  `field-draft.ts` draft⇄config converter; nested list/object controls pass
  through an "advanced" escape hatch verbatim). Editor routes carry the full
  repo-relative path (`/mdmx/edit/content/posts/x.mdx`). Styles: forms,
  field rows, entry table, status badges. +11 tests (2 next, 9 dashboard) →
  259 total; all dashboard routes smoke-tested live against the demo.
- **M5 — media library + settings**: `MediaView` (image grid over
  `GET /files`, upload via local `media-upload.ts` helpers — the editor's
  equivalents can't be imported statically without dragging ProseMirror into
  the SSR graph; `Blob.arrayBuffer` with FileReader fallback; copy-URL;
  confirmed delete with listed sha). `SettingsView` (session + repo,
  content/media dirs, validation mode, registry stats, logout) plus a
  **theme pin**: system/light/dark radio persisting to localStorage and
  applying `data-mdmx-theme` on the root; re-applied on dashboard load.
  +5 tests → 264 total; media/settings routes smoke-tested live.
- **M6 — quick-open (Cmd/Ctrl+K)**: palette over entries (fresh
  `GET /documents` per open) + collections + pages + "new …" actions; pure
  `quick-open.ts` scoring (prefix > word-prefix > substring; label outranks
  detail) with a navbar trigger. Keyboard: ⌘K toggle, arrows, Enter, Esc;
  listbox/option ARIA. The shell takes the trigger as a `search` slot so it
  stays context-free. +5 tests → 269 total.
- **M7 — stylesheet completion**: the embedded editor is now fully styled by
  the shipped stylesheet — the demo's reference editor CSS ported onto the
  `--mdmx-*` tokens (new: `--mdmx-accent-wash`, `--mdmx-code-*`,
  `--mdmx-content-font`), **scoped under `.mdmx-dash-editor`** so a
  standalone editor mount elsewhere stays headless. Covers rail, canvas
  typography, NodeViews/placeholders/TwoColumn, slash menu, prop panel +
  controls, dark source pane with amber active line, toolbar, media modal,
  mobile sheets/FABs, ProseMirror cursors — all light+dark via tokens
  (webfont references dropped; system font stacks). A11y: `:focus-visible`
  rings, `prefers-reduced-motion` disables sheet transitions/spinner.
  Verified the editor route's CSS chunk ships the scoped chrome. 269 tests.
- **M8 — demo-next converted to the two-file mount**: deleted the hand-built
  CMS (`app/collections/`, `app/edit/` + `EditorClient`, `CmsHeader`,
  `DocList`, `NewPostButton`, `lib/scaffold.ts`); `/` now redirects to
  `/mdmx`. `globals.css` shrank ~1330 → ~330 lines: only the demo's own
  `mk-*` author-component styles remain — all CMS/editor chrome comes from
  the package stylesheet. The route table is exactly `/`,
  `/api/mdmx/[...route]`, `/mdmx/[[...slug]]`. README rewritten around the
  two-file DX. Smoke-verified: redirect, editor 200, byte-identical
  conflict-safe save. 269 tests green.
- **M9 — release hygiene (0.4.0)**: SPEC §5 amended with the runtime
  collection-resolution rule (config authoritative, registry = build-time
  snapshot, seed-on-first-write, name/dir constraints). Wiki synced: Home
  (6 packages, v0.4.0, 269 tests, dashboard bullet), Architecture (six-package
  table, ADR-034 discipline note), Packages (+@mdmx/dashboard section, new
  core/next rows, counts), Roadmap (Phase 2.5 table, next-milestone rewrite).
  Guides updated to the dashboard-first DX: README map, install (dashboard
  package + mount in layout/transpile), content API (configPath +
  collections/documents endpoints + config-as-code semantics), guide 4
  rewritten as "Mounting the dashboard" (DashboardPageOptions, theming
  tokens, manual editor mount kept as the advanced path), production ("The
  dashboard in production" replaces the stale editor-pages section),
  troubleshooting (+unstyled-dashboard and gate-unreachable entries). Root
  README package table + roadmap; **all packages bumped to 0.4.0**. Final
  gate: 269 tests, guide link check clean.
- **This session's ADRs**: ADR-034 (app-layer dashboard package),
  ADR-035 (collections config-as-code, request-time resolution).

### S22 — Next.js integration guide series (docs only)
- **docs/guides/next-js/** (new): seven consumer-facing guides documenting how
  to integrate MDMX into a Next.js App Router site, written against the actual
  v0.3.1 API surface and mirroring `examples/demo-next`:
  - `README.md` — overview, package map, local vs GitHub mode, prerequisites
  - `01-installation.md` — packages, `transpilePackages`, layout, `pre*` scripts,
    shared `lib/mdmx-config.ts`
  - `02-components-and-registry.md` — `defineMDMX()` + `DefineMDMXConfig`
    reference, children policies, constraints, `ControlSpec`, `mdmx.config.json`,
    collections, `generate`/`check`/`dev`
  - `03-content-api.md` — `createMDMXHandlers()` mount, `localMode`, full
    `MDMXHandlerOptions`, endpoint + error-status reference
  - `04-editor.md` — server page + client mount (`next/dynamic` `ssr:false`),
    sha-refreshing save loop, `MDMXEditorProps` reference, `MediaSource`
    adapter, no-stylesheet styling note
  - `05-rendering-content.md` — `getDocuments`/`getDocumentBySlug`,
    draft/publish via `status`, rendering with standard MDX tooling
    (`next-mdx-remote/rsc` + `remark-gfm` recipe; MDMX ships no renderer)
  - `06-production-github.md` — OAuth app setup, env vars, `GitHubProvider`
    swap-in, authorization model (push permission ⇒ access, 5-min re-verify),
    production checklist
  - `07-troubleshooting.md` — startup/API/editor failure modes, HTTP status
    map, MDMX001–009 diagnostics table
- **docs/wiki/Home.md** — added the guide series to the map of the docs.
- **README.md** (root) — added the guides to "Repo guides".
- No code, spec, or behavior changes; no ADR needed.

### S21 — Collections UI, new-post authoring, paste-to-upload, caret-at-edge
- **editor (package code)**:
  - `Editor.tsx` — **caret at document edge**: a `mousedown` on the canvas
    padding (which lands on the mount, never the ProseMirror child, so PM's own
    click handling never fired) now places the caret at the doc start/end based
    on click-Y vs the editable's box; if the doc ends in a non-textblock
    component it appends a trailing paragraph first. Fixes "no cursor when I
    click below the last block."
  - `Editor.tsx` + `react/media.ts` — **paste-to-upload**: a `handlePaste`
    extracts an image from the clipboard, uploads it via the `MediaSource`
    adapter, and inserts it. New helpers `imageFromClipboard`,
    `timestampedMediaName`, `pastedMediaPath`, `pastedImageUpload` route the
    asset into a directory named after the post's collection under the media
    dir, with a sortable timestamped filename
    (`public/media/<collection>/pasted-<iso>.png`). Latest media/collection read
    via refs so the view-creation effect isn't a dependency.
  - `Editor.tsx` — optional `backHref`/`backLabel` render a back link in the
    toolbar (editor stays framework-agnostic; the host wires the URL).
  - Decision → **ADR-033**.
- **examples/demo-next (CMS UI)**:
  - Home (`app/page.tsx`) is now **collection-driven**: a grid of collection
    cards (entry/published counts, dir) instead of a flat article list.
  - New **`/collections/[name]`** route: per-collection Published/Drafts lists
    plus a **New post** button.
  - `components/` — `CmsHeader` (brand + breadcrumbs, shared across pages),
    `DocList`, `NewPostButton` (client: prompts a title, writes a scaffolded
    `.mdx` conflict-safe via `expectedSha: null`, opens the editor). `lib/scaffold.ts`
    builds canonical frontmatter from the collection spec via core's
    `stringifyFrontmatter`.
  - `app/edit/[...slug]` passes `backHref` (to the collection) into the editor;
    `globals.css` gains header/breadcrumb, collection-grid/card, collection-head,
    new-post, and toolbar-back styles.
- **Tests**: +9 editor cases in `media.test.ts` (timestamp/path/clipboard/upload
  helpers). New count **210** (core 38, cli 19, editor 109, next 37, github 7).
- **Verification**: `pnpm check` clean, `pnpm test` 210 green, `next build` of
  demo-next compiles all routes, runtime smoke test (home/collection render,
  new-post create→200 / duplicate→409, paste-media upload→201 under
  `public/media/posts/`).
- **Wiki**: SessionLog, DECISIONS (ADR-033), Packages, Testing, Roadmap, Home,
  PROJECT_STATUS. No SPEC/grammar change (collections data layer unchanged since
  ADR-025).
- **Follow-ups**: media library `list()` doesn't recurse into collection
  subdirs yet (pasted images upload fine but won't show in the Browse grid);
  caret-at-edge isn't jsdom-tested (layout-dependent).

### S20 — Release 0.3.0
- Bumped all five packages (`core`/`cli`/`editor`/`next`/`provider-github`) and
  the root from `0.1.0`/`0.0.0` → **`0.3.0`**. Internal deps use `workspace:*`
  (no version pins to update); `pnpm-lock.yaml` unchanged (a package's own
  version isn't a lockfile importer field).
- Closes the **road-to-0.3.0** plan: editor sidebar overhaul (S11–S13), picker
  grouping (S14), 11 new demo components across Content/Marketing/Layout/Data/
  Advanced (S15–S18), and the `<Html>` block + snippets (S19).
- Verification: full `pnpm check` + **201 tests** green at 0.3.0.
- Wiki: PROJECT_STATUS, Home (version note), SessionLog; plan (S20 ✓ — **plan
  complete**). No ADR, no SPEC change.

### S19 — `<Html>` custom-markup block + snippets
- **editor (package code)**:
  - `src/sanitize-html.ts` — pure, dependency-free `sanitizeHtml` (runs at build
    time without a DOM): strips `<script>`/`<iframe>`/`<object>`/`<embed>` +
    bodies, `<base>`/`<meta>`/`<link>`, `on*` handlers (all quoting styles), and
    `javascript:` URLs in href/src/xlink:href. Documented best-effort (regex,
    not a full parser; production untrusted input → DOMPurify).
  - `src/snippets.ts` — localStorage-backed snippet store (`listSnippets`/
    `saveSnippet`/`deleteSnippet`; upsert-by-name, SSR/corruption-safe). The
    pragmatic "save as a component" (no runtime `.tsx` codegen).
  - `Rail` gains a **Snippets** group (filterable; insert via `onInsertSnippet`).
    `Editor` reads the store, inserts a snippet as an `<Html>` block, and shows a
    **Save as snippet** toolbar affordance (inline name input) when an `<Html>`
    node is selected.
  Exported from the main (React-free) index: `sanitizeHtml`, `listSnippets`,
  `saveSnippet`, `deleteSnippet`, `Snippet`.
- **demo-next**: `Html.tsx` (category **Advanced**, leaf, `code` textarea) renders
  `dangerouslySetInnerHTML` of `sanitizeHtml(code)`; registry now **17**
  components (5 categories). Showcase `Html` block in `marketing.mdx` (canonical,
  `mdmx check`-clean). `.mk-html` + snippet-chrome CSS (both stylesheets for the
  chrome).
- Decisions → **ADR-032**. Tests: **+16 editor (84→100)** — `sanitize-html.test.ts`
  (7), `snippets.test.ts` (6), Rail snippets group (+2), editor-mount snippet
  insert (+1). **201 total.** No SPEC change (`Html` is an ordinary registered
  component; no new control type/diagnostic).
- Plan: `road-to-0.3.0.md` (S19 ✓). Wiki: Packages, Testing, Home, SessionLog;
  README, PROJECT_STATUS. Next: **S20 — bump to 0.3.0**.
- Follow-up: the Save-as-snippet trigger is selection-gated (covered by store
  units + manual check; jsdom can't drive PM node-selection); a future pass could
  surface snippet management (rename/delete) in the UI.

### S18 — Demo marketing components: LogoCloud + FAQ + Newsletter
- **demo-next**: four more Marketing components, completing the new-components
  phase (S15–S18):
  - `LogoCloud` — leaf; title + `names` (comma-separated, rendered as logo chips;
    `textarea` control to dodge the not-yet-editable `list` control).
  - `FAQ` / `FAQItem` — `blocks` container + `rich-text` slotted item (question
    prop, answer inline).
  - `Newsletter` — leaf email-signup band; heading/buttonLabel/placeholder/note.
  Registered in `lib/components.ts`; demo-next registry now **16** components
  across 4 categories. Extended `marketing.mdx` with all three sections;
  canonical + `mdmx check`-clean. CSS `.mk-logos`/`.mk-faq`/`.mk-newsletter`.
- Verification: demo-next `tsc` clean; full repo `pnpm check` + 185 tests green.
- No package code → no test-count change (185), no ADR, no SPEC change. Plan:
  `road-to-0.3.0.md` (S18 ✓) — **all S15–S18 demo components done**.
- Known gap (pre-existing, noted for later): the `list` control type isn't
  editable in the prop panel (`coerceControlValue`/`Control` fall through to a
  text input); that's why `LogoCloud.names` uses `textarea`.
- Next: S19 HTML component (package code — tests + ADR), then S20 0.3.0 bump.

### S17 — Demo marketing components: Pricing + Testimonial
- **demo-next**: three more Marketing components:
  - `PricingTable` — `blocks` container, `allowedChildren: ["PricingTier"]`.
  - `PricingTier` — `rich-text`, `allowedParents: ["PricingTable"]`; name/price/
    period/ctaLabel/ctaHref (link) + **featured** (boolean → checkbox control).
  - `Testimonial` — `rich-text` quote; author/role + **avatar** (image → Browse
    via the S10 media picker).
  Registered in `lib/components.ts`; demo-next registry now **12** components.
  Extended `marketing.mdx` (pricing row + testimonial); canonical + `mdmx
  check`-clean. CSS `.mk-pricing`/`.mk-tier`/`.mk-quote` (featured tier
  highlight, auto-fit grid).
- Verification: demo-next `tsc` clean; full repo `pnpm check` + 185 tests green;
  controls confirmed (boolean/link/image).
- No package code → no test-count change (185), no ADR, no SPEC change. Plan:
  `road-to-0.3.0.md` (S17 ✓).
- Follow-ups: S18 logo cloud / FAQ / newsletter; then S19 HTML component, S20 bump.

### S16 — Demo marketing components: FeatureGrid + StatsBand
- **demo-next**: three more Marketing components, exercising the slot-container
  machinery (ADR-021) end-to-end in the demo:
  - `FeatureGrid` — `blocks` container, `allowedChildren: ["Feature"]`, `columns`
    prop (select 2/3/4).
  - `Feature` — `rich-text` card, `allowedParents: ["FeatureGrid"]`; title + icon.
  - `StatsBand` — `blocks` container, `allowedChildren: ["Stat"]` (**reuses** the
    existing `Stat` leaf), optional title.
  Registered in `lib/components.ts`; demo-next registry now **9** components.
  Extended `content/posts/marketing.mdx` with a FeatureGrid (3 Features) and a
  StatsBand (3 Stats); canonical + `mdmx check`-clean. Added `.mk-features`/
  `.mk-feature`/`.mk-stats` CSS (responsive grid).
- Verification: demo-next `tsc` clean; full repo `pnpm check` + 185 tests green;
  constraints confirmed (allowedChildren/allowedParents) — insertion seeds two
  children automatically (the S6 repeater case).
- No package code → no test-count change (185), no ADR, no SPEC change. Plan:
  `road-to-0.3.0.md` (S16 ✓).
- Follow-ups: S17 Pricing + Testimonial; S18 logo cloud / FAQ / newsletter.

### S15 — Demo marketing components: Hero + CallToAction
- **demo-next**: two original components (category **Marketing**) inspired by
  common landing-page sections (not copies of any proprietary kit):
  - `Hero.tsx` — leaf (`children: none`); props eyebrow/title/subtitle/
    primary+secondary label+href/align. Inference gave `select` for `align`,
    `link` for hrefs, `textarea` for subtitle.
  - `CallToAction.tsx` — `children: rich-text` (supporting copy edited inline);
    heading/buttonLabel/buttonHref/variant (`select`).
  Registered in `lib/components.ts`; `pnpm generate` → demo-next registry now has
  **6** components across Content/Marketing/Layout/Data (exercising the S14
  grouping). Added `content/posts/marketing.mdx` showcase, **canonicalized via
  `toMDX(parseMDX(...))`** and validated clean by `mdmx check`. Marketing CSS
  (`.mk-hero`/`.mk-cta`/`.mk-btn`) added to demo `globals.css`.
- Verification: demo-next `tsc` clean; full repo `pnpm check` + 185 tests green;
  registry controls confirmed (select/link/textarea); showcase round-trips.
- No package code → **no test-count change (185)**, no ADR, no SPEC change. Plan:
  `road-to-0.3.0.md` (S15 ✓). Wiki: SessionLog (+ this entry).
- Follow-ups: S16 Feature grid + Stats band; later iterations add more sections.

### S14 — Component-picker grouping UX
- **editor**: extracted pure `react/rail-groups.ts` (`filterComponents` — matches
  name/category/description; `groupByCategory` — order-preserving). The **Rail**
  gains a filter box and **collapsible** category groups (header is a button with
  a chevron + `aria-expanded`; a non-empty filter auto-expands so matches show).
  `commands.ts` gains `groupSlashItems` (core → "Blocks", components → category,
  order-preserving so flattening reproduces nav order). The **SlashMenu** now
  renders grouped with labels while keeping a single flat index for keyboard nav.
- **CSS** (demo + playground in sync): `.mdmx-rail-filter`, `.mdmx-rail-empty`,
  `.mdmx-rail-group-chevron`, group label as a button, `.mdmx-slash-group-label`.
- Tests: +9 editor (75→84): `rail-groups.test.ts` (filter + group order, +4),
  `commands.test.ts` `groupSlashItems` (+2), `rail.test.tsx` jsdom (group/filter/
  collapse, +3). **185 total.** No ADR (UX feature; grouping was already the rail's
  model).
- Plan: `road-to-0.3.0.md` (S14 ✓). Wiki: Packages, Testing, Home, SessionLog;
  README, PROJECT_STATUS. No SPEC change.
- Follow-ups: S15+ new demo components (original, inspired by marketing blocks) —
  these will populate the new categories the grouping now shows off.

### S13 — Mobile layout (floating controls + off-canvas sheets)
- **editor**: below 860px the rail and sidebar become slide-in **sheets** (same
  DOM, repositioned by CSS — no duplicate panels) toggled by floating buttons.
  `Editor.tsx` tracks `mobilePanel: "palette" | "sidebar" | null`, applies
  `is-palette-open`/`is-sidebar-open` on the root, and renders FABs (bottom-left
  **Components**; bottom-right **Source**/**Properties** — the latter two set
  `sidebarMode` then open the sidebar sheet) + a backdrop that dismisses. The rail
  gained `onAfterInsert` so inserting from the mobile palette closes the sheet.
  Shared inline icons extracted to `react/icons.tsx` (`CodeIcon`/`SlidersIcon`/
  `LayersIcon`), reused by the sidebar tabs and FABs.
- **CSS** (demo + playground in sync): FABs/backdrop hidden on desktop; a
  `@media (max-width: 860px)` block collapses the grid to one column, makes the
  rail a left sheet and the sidebar a right sheet (`translateX` toggled by the
  root classes; editor visible behind a translucent backdrop), hides the resize
  handle, and styles the FABs.
- Decisions → **ADR-031** (mobile = same-DOM panels repositioned by CSS + a React
  open-state, not a separate mobile tree).
- Tests: +2 editor (73→75) in `editor-mount.test.ts` (jsdom): palette FAB opens
  the sheet + backdrop dismisses; Source/Properties FABs open the sidebar sheet in
  the correct mode. **176 total.**
- Plan: `road-to-0.3.0.md` (S13 ✓). Wiki: Packages, Testing, Home, SessionLog;
  README, PROJECT_STATUS. No SPEC change.
- Follow-ups: S14 component-picker grouping UX (collapsible + filter; group the
  slash menu too).

### S12 — Resizable sidebar (desktop)
- **editor**: new `react/sidebar-resize.ts` — pure `clampSidebarWidth`
  (260–640px) + `readStoredWidth`/`storeSidebarWidth` (localStorage,
  `mdmx:sidebar-width`, best-effort/SSR-safe). `EditorSidebar` renders a
  `.mdmx-sidebar-resize` grab strip on its left edge (`role="separator"`);
  `Editor.tsx` owns the width (init from storage), applies it as the
  `--mdmx-sidebar-width` CSS var on the editor root, and drives a mouse-drag
  resize (width = root.right − clientX, clamped, persisted on release; adds
  `body.mdmx-resizing` for the drag cursor/selection guard). Exported from
  `react/index.ts`.
- **CSS** (demo + playground in sync): `.mdmx-sidebar` is now `position:
  relative`; added `.mdmx-sidebar-resize` (hover/active indicator) and
  `body.mdmx-resizing`.
- Tests: +8 editor (65→73): `sidebar-resize.test.ts` (clamp bounds/rounding/
  non-finite, storage round-trip + invalid) and a jsdom drag smoke in
  `editor-mount.test.ts` (mousedown→move→up sets the CSS var + persists).
  **174 total.** Builds on ADR-030's `--mdmx-sidebar-width` seam (no new ADR).
- Plan: `road-to-0.3.0.md` (S12 ✓). Wiki: Packages, Testing, Home, SessionLog;
  README, PROJECT_STATUS. No SPEC change.
- Follow-ups: S13 mobile layout (floating buttons + half-screen modals).

### S11 — Unified editor sidebar (Source ⇄ Properties)
- **The bug**: the editor laid out as a 4-column grid with the source pane
  (col 4) *and* the properties/frontmatter panel (col 3) both always on; on
  narrower viewports they collided (the user's screenshot). **Fix**: one right
  sidebar with a header that toggles between **Source** (live canonical MDMX) and
  **Properties** (the component prop panel, or the frontmatter panel when nothing
  is selected). Default mode: source (the signature view).
- **editor**: new `react/EditorSidebar.tsx` (`SidebarMode = "source" |
  "properties"`, inline SVG tab icons). `Editor.tsx` holds `sidebarMode` and
  renders one `<EditorSidebar>` in place of the two columns; exported from
  `react/index.ts`. `SourcePane`/`PropPanel`/`FrontmatterPanel` are unchanged —
  now mounted inside the sidebar body.
- **CSS** (demo + playground, kept in sync): grid is now `220px | 1fr |
  var(--mdmx-sidebar-width, 380px)`; added `.mdmx-sidebar`/`-tabs`/`-tab`/`-body`;
  `.mdmx-source` and `.mdmx-props` lost their `grid-column` and own scroll (the
  sidebar body scrolls). The `--mdmx-sidebar-width` var is the hook for S12's
  resize.
- Decisions → **ADR-030** (one sidebar, mode toggle, default source; consumer
  CSS goes 4-col → 3-col).
- Tests: +1 editor (64→65): `editor-mount.test.ts` toggle test (default source;
  switch to properties shows the panel; switch back). Two frontmatter tests now
  switch to Properties first via a `switchSidebar` helper. **166 total.**
- Plan: `agent-context/plans/road-to-0.3.0.md` (S11 ✓). Wiki: Packages, Roadmap,
  Testing, Home, SessionLog. No SPEC change.
- Follow-ups (next plan items): S12 resizable sidebar; S13 mobile layout
  (floating buttons + half modals).

### S10 — `image`-control "Browse…" into the media library
- **editor**: `image`-typed controls (prop panel + frontmatter) now render a
  **Browse…** button that opens the media library and writes the picked asset's
  url into the control, plus an inline thumbnail preview. New
  `react/media-context.ts` (`MediaPickerContext` + `useMediaPicker`): the editor
  owns a single library modal and exposes a `requestMedia(onPick)` opener through
  context, so both the toolbar "Insert image" and any control route their pick
  back to the right place. `Editor.tsx` replaced the `mediaOpen` boolean with a
  `mediaPick` callback and wraps the tree in the provider (null when no `media`
  source → Browse hides). `controls.tsx` gained the `image` case.
- **demo-next**: added an optional `coverImage` (`image` control) field to the
  `posts` collection so the frontmatter panel shows Browse; image-control CSS.
- Decisions → **ADR-029** (single modal, context-routed picker; extends ADR-027).
- Tests: +4 editor (60→64) in `controls.test.tsx` (jsdom): Browse appears with a
  picker and routes the pick to `onChange`; hidden without one; thumbnail
  preview for image-looking values only. **165 total.**
- Wiki touched: Packages, Roadmap, Testing, Home, SessionLog; README,
  PROJECT_STATUS. No SPEC change (the `image` control type already existed).
- Follow-ups: the same context could back a `link`-control picker; rail-drag
  visual drop indicator (from S9) still open.

### S9 — Region-aware nested insertion (TwoColumn polish)
- **Found a real bug**: slash/palette `insertComponent` used
  `replaceSelectionWith`, which **lifted the component out of the Column to the
  document top level** (proven by a throwaway probe). Also `allowedParents` is
  *not* a ProseMirror-schema constraint (every component node is in the `block`
  group) — it was only enforced by the core validator — so `insertPoint` would
  place a `Column` at the top level (schema-valid, MDMX-invalid).
- **editor/commands.ts**: insertion is now **region-local and constraint-aware**.
  `planComponentInsert` lands the node in the deepest valid container (replacing
  an empty seeded paragraph in place, else `insertPoint`); `parentAllowed`
  enforces `allowedParents`. New exports: `canInsertComponent` (predicate),
  `resolveComponentDrop` (rail-drop resolver that rejects invalid targets), and
  `slashItemsFor` (context-aware palette — filters components to those
  insertable at the selection). `Editor.tsx` drop handler uses
  `resolveComponentDrop` (was `insertPoint(...) ?? coords.pos`, which could force
  an invalid doc); `SlashMenu` uses `slashItemsFor`, recomputed as the selection
  moves → a `Column` is never offered/inserted outside a `TwoColumn`.
- Decisions → **ADR-028** (allowedParents enforced in the editor, not the
  schema; region-local insertion; constraint-aware palette/drop).
- Tests: +9 editor (51→60) in `nested-commands.test.ts` — region-local insert
  (lands in the Column, replaces the empty paragraph), `allowedParents`
  rejection, empty-doc top-level still works, `resolveComponentDrop` into a
  Column / reject Column-at-top, and `slashItemsFor` hiding `Column`. Existing
  `commands.test.ts` (8) unchanged. **161 total.**
- Wiki touched: Packages, Roadmap, Testing, Home, TwoColumn, SessionLog; README,
  PROJECT_STATUS. No SPEC change (no grammar/registry/diagnostic change — this
  aligns editor insertion with the existing MDMX004/005 constraint semantics).
- Follow-ups: the *visual* drop indicator for **rail** (new-component) drags
  isn't shown — `prosemirror-dropcursor` only renders for PM-managed drags;
  internal block moves already show nested indicators. Deletion semantics
  (Step 5) unchanged.

### S8 — Media library UI
- **editor**: new `src/react/media.ts` — `MediaSource` adapter interface
  (API-agnostic `list`/`upload`, like `onSave`), pure helpers (`safeFilename`,
  `mediaPath`, `bytesToBase64`, `fileToUpload`, `isImagePath`), and an
  `insertImage` ProseMirror command (inserts the existing inline `image` node;
  wraps in a paragraph when the cursor isn't in inline content). New
  `MediaLibrary.tsx` modal: lists assets, search-filters, uploads, and yields
  the picked asset. `Editor.tsx` gains `media`/`mediaDir` props → an "Insert
  image" toolbar button opens the library; picking inserts an image. Exported
  from `react/index.ts`.
- **demo-next**: `EditorClient` implements `MediaSource` over the API
  (`GET /files?dir=public/media` to list, `POST /media` to upload; empty dir →
  `[]`), passes it to the editor; added a `public/media/sample-logo.svg` asset
  and full media-library CSS in `globals.css`.
- Decisions → **ADR-027** (editor-side `MediaSource` adapter; image insertion
  reuses the CommonMark `image` node — no new grammar; upload type-whitelist
  stays a server concern).
- Tests: +12 editor (39→51): `media.test.ts` (helpers + image→`![]()` round
  trip) and `media-library.test.ts` (jsdom: list/filter/pick/upload, plus editor
  integration — "Insert image" → pick → `![](/media/logo.png)` in the source).
  **152 total.**
- Verified end-to-end against `next dev`: `list` returns the sample asset, PNG
  `upload` writes to disk and returns 201, re-upload of the same path → **409**
  (media is never silently overwritten). Confirmed `.svg` upload is correctly
  rejected by the server whitelist (XSS safety).
- Wiki touched: Packages, Roadmap, Testing, Home, SessionLog; README, AGENTS,
  PROJECT_STATUS. No SPEC change (the `image` node was already in the subset).
- Follow-ups: `image`-typed prop/frontmatter controls could open the same
  library (a "Browse…" button); the editor previews `.svg` but the server
  rejects svg uploads — a host may want to narrow the file `accept` to match.

### S7 — `mdmx dev` (registry watch mode)
- **cli**: new `src/dev.ts` — `runGenerate` (one generate pass + a formatted
  status line), `staticBase`/`watchTargets` (derive watch dirs from the
  component glob's non-glob prefix + the config file; **never** the `outDir`,
  which `generate` writes to), an injectable `Watcher` (`fsWatcher` over
  `node:fs.watch`), and `dev()` — the watch server with a debounced regenerate,
  in-flight coalescing, and **hash-based change detection** (the registry `hash`
  excludes `generatedAt`, so an unchanged component set is reported as
  `unchanged` instead of re-announced). `bin.ts` gains the `dev` command
  (SIGINT/SIGTERM-closable); exported from `index.ts`.
- Decisions → **ADR-026** (watch-mode design: injectable watcher/scheduler for
  determinism, hash-diff to silence no-op saves, outDir excluded from watch).
- Tests: +7 cli (12→19): `staticBase`, `watchTargets` (outDir excluded),
  `runGenerate`, and the `dev` loop (initial generate + hash; event coalescing
  via cancel-count; `unchanged` on no-op; new hash + count when a component is
  added). Deterministic — the loop is driven by an injected watcher and
  `await handle.regenerate()`, not wall-clock timers. **140 total.**
- Verified the real `fsWatcher` path end-to-end against `examples/demo`: initial
  generate prints count+hash, a `touch` regenerates and correctly reports
  `unchanged`, SIGINT exits 0.
- Wiki touched: Packages, Roadmap, Testing, Home, SessionLog; README. No SPEC
  change (no grammar/registry/diagnostic change — watch mode is tooling only).
- Follow-ups: HMR signal for a running editor (the registry changed → refresh
  the palette/schema) is still open; `mdmx dev` only regenerates the artifacts.

### S6 — TwoColumn / nested editing
- **editor**: `buildComponentNode` seeds a usable subtree on insert — `none`→atom,
  `rich-text`/`blocks`→one empty paragraph, slot containers→one of each allowed
  child (or **two** when a single type, the TwoColumn case), recursive (capped).
  `insertComponent` now uses it; exported for reuse. Nested NodeView editing
  works on the existing React-NodeView adapter (nested `contentDOM` holes) — no
  adapter change needed (ADR-021/023).
- **demo-next**: added `TwoColumn`/`Column` components (`children:"blocks"` +
  `allowedChildren`/`allowedParents` constraints), a `layout.mdx` showcase, and
  column CSS. Registry now has 4 components.
- Tests: +6 editor (33→39): `buildComponentNode` seeding (commands) and jsdom
  nested editing (two columns render with editable `contentDOM`; live source
  keeps the nested structure). **133 total.** Populated-TwoColumn byte round-trip
  already covered by `convert.test.ts`.
- Verified in `next dev`: layout post lists under Published, edit page loads,
  TwoColumn content saves clean and stays canonical.
- Follow-ups: nested drag-into-column indicators and per-region slash menu come
  free-ish from PM `dropPoint`/selection but aren't yet explicitly tested;
  placeholder-mode fallback for components that can't place `contentDOM`.

### S5 — Collections & draft/publish (typed frontmatter, canonical YAML)
- **core**: `CollectionSpec`/`FrontmatterField` types, `RegistrySpec.collections`,
  `Registry.collections`/`getCollection`/`collectionForPath`; new
  `frontmatter.ts` (`parseFrontmatter`, `stringifyFrontmatter` with pinned
  `CANONICAL_YAML_OPTIONS`, `validateFrontmatter`). New diagnostics **MDMX008**
  (required field missing) / **MDMX009** (value/type mismatch).
- **cli**: `mdmx.config.json` gains `collections`; `generate` normalizes + emits
  them into the registry (hash covers them); `check` validates each file's
  frontmatter against its collection.
- **next**: save API validates frontmatter for the matching collection (strict →
  422, report → save + diagnostics).
- **editor**: shared `Control` renderer extracted; new `FrontmatterPanel` edits
  collection fields and rewrites the doc's frontmatter attr as canonical YAML in
  one transaction (`setDocAttribute`). Right sidebar shows it when no component
  is selected.
- **demo-next**: `posts` collection; home grouped into Published/Drafts; editor
  page passes the resolved collection; added a draft `roadmap.mdx`.
- Decisions → **ADR-025**; extended Invariants 1 (canonical YAML) and 4 (codes
  now 001–009); SPEC §1.1/§4/§5 updated.
- Tests: +19 → **127** (core 27→38, cli 10→12, editor 31→33, next 33→37).
  Verified end-to-end in `next dev`: grouping, edit page, MDMX008 on save,
  publish flow.
- Follow-ups: media library UI; per-field frontmatter diagnostics in the panel;
  GitHub-mode deploy guide.

### S4 — Fix workspace linking (`workspace:*` protocol)
- `pnpm install` was 404-ing on `@mdmx/next` (and would on any sibling): plain
  `"0.1.0"` internal deps aren't reliably linked by pnpm 10, so it tried the npm
  registry. Converted every internal `@mdmx/*` dep across packages + examples to
  `workspace:*`. Install now symlinks them; build + 108 tests green. Recorded the
  convention in `AGENTS.md`. (Supersedes the S1 `.npmrc` workaround, left in
  place harmlessly.)

### S3 — CLI convenience scripts
- Added `scripts/` (POSIX `sh`, ASCII output): `dev-next`, `dev-playground`,
  `build`, `generate`, `test`, `check`, `clean`, with a README. Wired root
  `pnpm` aliases: `dev:next`, `dev:playground`, `generate`, `verify`, `clean`.
  No package code changed.

### S2 — Runnable local Next.js app (mount page + save loop)
- New `examples/demo-next`: a complete Next 14 / React 18 app dogfooding the
  full loop locally — document list (`app/page.tsx`), editor mount
  (`app/edit/[...slug]/page.tsx` server-reads file+sha → client `EditorClient`
  renders `@mdmx/editor/react` via `next/dynamic` ssr:false and saves over the
  API), and the content API mounted at `app/api/mdmx/[...route]/route.ts`.
- **`@mdmx/next` `localMode`**: `createMDMXHandlers` gains an opt-in that skips
  GitHub OAuth and runs a synthetic `local` session; pairs with `LocalProvider`
  so saves write to the working tree. Validation, path-safety, CSRF-origin, and
  conflict (`expectedSha` → 409) checks all still apply. `auth`/`sessionSecret`
  are now optional (required only without `localMode`). → **ADR-024**.
- Hardened the save path: an unparseable `.mdx` body now returns **400** (was a
  500) — `validateSource` is wrapped in try/catch.
- **`@mdmx/editor`**: `MDMXEditor` gains `onSave`/`docTitle` + a save toolbar
  (dirty/saving/saved/error states); computes canonical source via
  `serializeDoc`.
- Verified end-to-end against a running `next dev` AND a production `next build`:
  home list, `/me` (login `local`), file read, **save persisted to disk**, stale
  sha → 409, edit page renders, unknown component → MDMX001 diagnostic, malformed
  MDX → 400.
- Tests: +6 in next (27→33, localMode + parse-guard) → **108 total**.
- Wiki touched: Home, Packages, Testing, Roadmap, SessionLog; README,
  PROJECT_STATUS. No SPEC change. Follow-ups: TwoColumn nested editing; media
  library UI; GitHub-mode deploy guide.

### S1 — React editor UI (flat): NodeViews, chrome, Vite playground
- Ported the prototype's flat editor into `@mdmx/editor` as real React over the
  existing tested schema/converters. New `src/react/`: `react-node-view.tsx`
  (thin React-NodeView adapter with `contentDOM` placement — the piece that
  replaces TipTap), `ComponentBlock.tsx` (live render + error boundary →
  placeholder), `Editor.tsx` (`MDMXEditor`: owns the `EditorView`, plugins,
  drag-from-rail drop), and chrome `Rail`/`SlashMenu`/`PropPanel`/`SourcePane`,
  plus `slash-plugin.ts`, `source-map.ts`, `prop-controls.ts`.
- React lives behind a new `@mdmx/editor/react` export subpath; the package main
  entry stays React-free (Invariant 9). Added `react`/`react-dom`/`jsdom`/types
  devDeps, `prosemirror-dropcursor`/`prosemirror-gapcursor` deps, jsx+DOM
  tsconfig.
- New `examples/editor-playground` (Vite) renders the demo registry + components
  and `welcome.mdx` in the full rail·canvas·source layout; verified it builds and
  the dev server boots.
- Decisions → **ADR-023** (raw ProseMirror + React adapter, **supersedes
  ADR-019**'s TipTap choice; performance parity + the dynamic registry schema
  argue for raw PM).
- Tests: +16 in editor (15→31) → **102 total**. New `prop-controls.test.ts`,
  `source-map.test.ts` (load→serialize fixed point), `editor-mount.test.ts`
  (jsdom: contentDOM placement, live render, live source).
- Added root `.npmrc` (`link-workspace-packages=true`) so the pnpm workspace
  links the plain-versioned `@mdmx/*` cross-deps.
- Wiki touched: Home, Packages, Testing, Roadmap, SessionLog; README,
  PROJECT_STATUS, AGENTS package map. No SPEC change (no grammar/registry/
  diagnostic change). Follow-ups: TwoColumn nested editing (next phase),
  `@mdmx/next` mount page, runnable demo Next app.

## ───────── reconstructed from initial build ─────────

### S0.12 — Handoff prep: wiki, decision record, agent upkeep rule
- Added `docs/DECISIONS.md` (ADR-001 onward) capturing every architectural
  choice and rationale from the design conversation.
- Created `docs/wiki/` (Home, Architecture, Packages, Invariants, Glossary,
  Roadmap, TwoColumn, Testing, Session Log).
- Added the "Wiki upkeep (required)" rule to `AGENTS.md`; rewrote `CLAUDE.md`
  and `llms.txt` to foreground it and link the new docs.
- Added `agent-context/claude-code-handoff.md`.
- Re-review surfaced a latent time-bomb: `unseal` hard-coded `Date.now()`, so
  the api.test.ts suite (sealing against a fixed 2026-06-13 timestamp) began
  401-ing once the real clock passed that date — 11 failures. Fixed by making
  the clock injectable (ADR-022); anchored the test clock to `Date.now()`.
  Back to 86/86 green.
- Verified all internal doc links resolve; ADR numbering and test counts honest.
- Wiki touched: all pages (created). ADRs added: 022.

### S0.11 — Editor prototype: canvas-level drop-anywhere
- Replaced per-block drop handlers with canvas-level nearest-edge detection;
  any pixel resolves to a valid insertion point; no-op suppression for the
  dragged block. Removed the end-only dropzone.

### S0.10 — Editor prototype: delete + drag-from-sidebar
- Block delete (gutter button, component-bar button, keyboard Delete/Backspace
  guarded against text fields). Palette items draggable onto the canvas;
  unified `{kind:"move"|"new"}` drag model.

### S0.9 — Editor prototype: working block drag-and-drop
- Handle-armed `draggable`, edge-aware drop indicators, reorder reducer
  (verified for adjacent/self/end cases).

### S0.8 — Editor UI: command/palette layer + interactive prototype
- `@mdmx/editor` `commands.ts`: `slashItems`, `insertComponent` (seeds
  defaults), markdown input rules, mark commands. Tests added.
- Built `examples/editor-prototype.html` — the interactive UI spec with the
  signature live-source split view. `DESIGN_NOTES.txt` records the aesthetic.

### S0.7 — Build determinism + PROJECT_STATUS
- Root `test`/`build`/`check` build `@mdmx/core` first so clean
  `npm install && npm test` works. Added `PROJECT_STATUS.md`.

### S0.6 — @mdmx/next server layer
- Sealed AES-256-GCM sessions; GitHub OAuth with push-permission authz + 5-min
  re-verification; `createMDMXHandlers` content/media API with server-side
  validation, origin checks, prefix enforcement, conflict 409s. Caught and
  documented the `return await` error-mapping gotcha.

### S0.5 — Docs + demo
- `SPEC.md` v1; `AGENTS.md`/`CLAUDE.md`/`llms.txt`; `examples/demo` consumer
  (end-to-end generate + check verified).

### S0.4 — Providers
- `ContentProvider` contract + `assertSafePath` in core; `GitHubProvider` over
  the Git Data API with conflict detection; `LocalProvider` + content readers
  in `@mdmx/next`. In-memory GitHub fake with real blob shas.

### S0.3 — @mdmx/editor converter core
- Registry→ProseMirror schema; `fromMdast`/`toMdast` with mark
  canonicalization, raw fallback, canonical prop printing. Byte-level
  round-trip tests.

### S0.2 — @mdmx/cli
- `generate` (TS compiler API extraction, control inference, config merge,
  registry emission) and `check` (content linting).

### S0.1 — Monorepo + @mdmx/core
- Scaffolded the npm-workspaces monorepo; implemented core parser, validator,
  canonical serializer with round-trip tests.

---

## Append template

```
### S<n> — <one-line summary>
- What changed (files/packages).
- Decisions made → added/updated ADR-NNN in docs/DECISIONS.md (if any).
- Tests added/changed and the new count.
- Wiki pages touched.
- Follow-ups / known gaps.
```
