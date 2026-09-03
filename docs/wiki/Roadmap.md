# Roadmap

Status legend: ✅ done · 🟡 partial · ⬜ not started.

## Phase 1 — the spine (a credible Outstatic competitor)

| Item | Status | Notes |
| --- | --- | --- |
| MDMX subset spec + parser/validator/serializer | ✅ | `@mdmx/core`, 27 tests |
| `mdmx generate` (type extraction → registry) | ✅ | `@mdmx/cli` |
| `mdmx check` (content lint) | ✅ | `@mdmx/cli` |
| Registry→ProseMirror schema + converters | ✅ | `@mdmx/editor`, headless, 15 tests |
| Editor command/palette layer | ✅ | `slashItems`, `insertComponent`, input rules |
| GitHub provider (Git Data API) | ✅ | `@mdmx/provider-github`, 7 tests |
| LocalProvider + content readers | ✅ | `@mdmx/next` |
| Sessions + GitHub OAuth + API handlers | ✅ | `@mdmx/next`, 27 tests |
| **Editor React UI (NodeViews, slash menu, prop panel)** | 🟡 | Flat editor done on raw ProseMirror (ADR-023): `@mdmx/editor/react`, verified via `examples/editor-playground`. Nested editing pending (Phase 2). |
| **Editor mount page** (App Router route) | ✅ | `examples/demo-next/app/edit/[...slug]` wires the editor ↔ API |
| **Demo Next.js app** dogfooding the full loop | ✅ | `examples/demo-next` — runnable locally via `localMode` (ADR-024); load → edit → save to disk → conflict-safe |

Phase 1 is essentially complete: the headless pipeline, the flat React editor,
and a runnable local Next.js app (load → edit → save → conflict detection) are
all done and tested. What remains for Phase 2 is nested editing and structured
content; GitHub-mode deploy is wired but undocumented as a guide.

## Phase 2 — polish & structured content

| Item | Status | Notes |
| --- | --- | --- |
| **TwoColumn / nested editing** | ✅ | Nested NodeViews + seeded insert; renders/edits/round-trips (ADR-021). Region-local + `allowedParents`-aware insertion, context-aware slash palette, constraint-aware rail drop (ADR-028). Remaining: *visual* drop indicator for rail drags |
| Container components generally | ✅ | Same machinery as TwoColumn — any `blocks`/slot container works |
| Draft/publish workflow | ✅ | `status` frontmatter field; editor toggle + list grouping (ADR-025) |
| Media library UI | ✅ | `MediaSource` adapter + `MediaLibrary` modal + `insertImage`; `image`-control Browse via `MediaPickerContext` (ADR-029); wired in demo-next over `/files`+`/media` (ADR-027) |
| Collections (typed frontmatter, list views) | ✅ | Config→registry; `validateFrontmatter` (MDMX008/009); editor frontmatter panel (ADR-025) |
| `mdmx dev` (registry watch mode) | ✅ | Debounced, hash-diffed regenerate on component/config change (ADR-026). HMR push to a running editor still open |

## Phase 2.5 — 0.4.0: the drop-in dashboard

| Item | Status | Notes |
| --- | --- | --- |
| Platform: Next 15 + React 19 | ✅ | Async request APIs; editor peers already `>=18` |
| `@mdmx/dashboard` app-layer package | ✅ | Two-file mount (`createDashboardPage` + handlers re-export); ADR-034 |
| Auth gate + shell (navbar / left nav / contextual right) | ✅ | Client gate over `/me`; localMode auto-enter with badge |
| Collections managed from the dashboard | ✅ | Config-as-code resolved per request; `GET/POST /collections`, `PUT /collections/:name`; seed-on-first-write migration (ADR-035) |
| Entry tables + new-entry scaffold + delete | ✅ | `GET /entries` (listing + frontmatter); conflict-safe deletes; `expectedSha: null` creates |
| Embedded editor view | ✅ | `next/dynamic` `ssr:false`; sha-refreshing saves; media adapter; back-links |
| Collection field editor | ✅ | Draft⇄config builder; nested controls via "advanced" escape hatch |
| Media library + settings pages | ✅ | Upload/copy/delete; session/repo/validation info; theme pin |
| Quick-open (Cmd/Ctrl+K) | ✅ | Entries + nav + actions; ranked matching |
| Shipped stylesheet incl. embedded editor | ✅ | `--mdmx-*` tokens, light+dark, scoped `.mdmx-dash-editor` chrome |
| demo-next = two-file mount | ✅ | Hand-built CMS pages deleted; `/` → `/mdmx` |

## Phase 2.6 — 0.4.1: render fidelity, private publishing, Component Studio

| Item | Status | Notes |
| --- | --- | --- |
| Responsive preview modes (mobile/tab/desktop) | ✅ | Device-width canvas under CSS `zoom`; canvas is an inline-size container; demo styles moved to `@container` (ADR-036) |
| Container components lay out correctly in the editor | ✅ | `.mdmx-content`/`.mdmx-contentdom` are `display: contents` — child blocks are real grid/flex items (ADR-036) |
| `draft \| private \| published` | ✅ | `private` renders at `/private/<collection>/<slug>` behind the MDMX session; `getSession`/`privateHref` in `@mdmx/next` (ADR-037) |
| Public rendering (`@mdmx/next/render`) | ✅ | `MDMXContent` mdast→React; demo has a real public site (home, `/posts/[slug]`, guarded `/private/[...path]`) (ADR-037) |
| Component Studio (browser-built components) | ✅ | Template-tree defs in `content/_components/`, runtime registry merge, editor parity, Tailwind v4 browser runtime; two-stage WYSIWYG (source+preview, then click-to-select + inspector + palette) (ADR-038) |
| Eject studio component to TSX | ✅ | `studioComponentToTSX` codegen + eject route; def stays active until generate/rebuild promotes the code version (ADR-038) |
| Studio defs with children regions | ⬜ | v1 studio components are leaf components |
| `mdmx dev` HMR into a running editor | ⬜ | Carried over from Phase 2 |

## Phase 2.7 — 0.5.0: convention over configuration (reconstructed from S25–S31)

| Item | Status | Notes |
| --- | --- | --- |
| Pre-release review + grilling | ✅ | S25/S26: architecture/API/DX review, decisions locked |
| Correctness blockers | ✅ | S27 (M1): the 0.5 bug list |
| The breaking wave | ✅ | S28 (M2): provider contract v2 (deletions, binary reads), auth as an injectable strategy (ADR-044/046), dashboard surface shrink (ADR-048) |
| The convention layer | ✅ | S29 (M3): three-tier config, env-detected mode, codegen-owned `.mdmx/` (component maps, bound `server.ts`), `mdmx init nextjs`, `@mdmx/project` (ADR-039–043) |
| Studio as a package + docs wave | ✅ | S30/S31: `@mdmx/studio` (model, renderer, UI), studio CSS compiled at generate time (ADR-042/045), typechecked tests, README + guides 01–07 rewritten |

## Phase 2.8 — 0.6.0: shadcn example, canvas fidelity, publish prep (never published — shipped in 0.7.0)

Plan and decision table (Q1–Q15): `.dev-context/plans/2026-09-01-0.6-plan.md`
(local, untracked). One commit per verified milestone on `release/0.6.0`.

| Milestone | Status | Notes |
| --- | --- | --- |
| M1 — demo-next on Next 16 (Turbopack) | ✅ | `next@16.3.4`, React 19.2 types; package peers stay `next >=15`. Turbopack fallout was one thing: build-time fs tracing warnings from `@mdmx/project`/`@mdmx/dashboard`, fixed in-source with `turbopackIgnore` (AGENTS.md sharp edge). Every surface + edit→save loop live-verified; `next build` clean. |
| M2 — Tailwind v4 + shadcn foundation | ✅ | Tailwind v4 via PostCSS, `shadcn init -d` (base-nova / Base UI) + `add --all` → 61 components in `components/ui/`. Dashboard chrome + `.mdmx-page` prose hardened against preflight with `@layer base` pins (ADR-049), driven by a computed-style diff of every screen (998 → 243 changed elements, the rest intended). `--muted` token collision renamed to `--ink-muted`. |
| M3 — canvas parity + editor structure | ✅ | `@mdmx/editor/styles.css` extracted (0-diff move); content class on the ProseMirror root (`contentClassName`), layout-only canvas, zero-specificity layered fallbacks (ADR-050); measured parity 0/9, 1/16, 4/101 (the rest is the demo's Stat figure, M5). `fit` default + collapsible rail/sidebar (ADR-051). Editor.tsx 612 → 344 with hooks. |
| M4 — interactivity | ✅ | NodeView `stopEvent` routes by target (buttons/inputs/tabs → component, else select); `render.interactive` override through core → CLI → registry v2 → SPEC → editor; links never navigate in the canvas, ⌘-click opens a tab (ADR-052). Pure routing helpers + mount/round-trip tests. |
| M5 — shadcn blocks + content | ✅ | 22 shadcn components registered as blocks (`UI` category); 17 marketing components rebuilt on shadcn primitives with names/props unchanged (content untouched, `mdmx check` clean); `mk-*` CSS gone; `posts/blocks.mdx` showcase. Block rules in ADR-053 (no context across blocks, grid containers, `keepMounted`, popup bodies as props); Carousel/ButtonGroup unregistered. Parity now differs only where the studio's CDN Tailwind runtime overrides the app's theme — M6's job. |
| M6 — studio Tailwind handoff | ✅ | `detectTailwind` (project) → `mdmx generate` writes `.mdmx/studio-classes.txt` and drops `studio.css`; host adds `@source`; `mdmx check` warns when it's missing; dashboard skips the CDN runtime (ADR-054). Canvas/page parity now exact. |
| M7 — distribution, docs, publish prep | ✅ | LICENSE (MIT) + `license` in all packages; versions 0.6.0 in lockstep; `pnpm pack:all` + `pnpm.overrides` for using mdmx from a checkout (guide 08, ADR-055); RELEASING.md + release notes; docs wave (README, guides index, llms.txt, wiki counts, AGENTS.md package map). Publish itself is the maintainer's step. |

## Phase 2.9 — 0.7.0: editing UX — two-way source, component editing, blocks that insert usable

Plan and decision table (Q1–Q11): `.dev-context/plans/2026-09-03-0.7-plan.md`
(local, untracked). One commit per verified milestone on `release/0.7.0`
(the renamed `release/0.6.0`; 0.6.0 is never published — 0.7.0 is the first
npm release).

| Milestone | Status | Notes |
| --- | --- | --- |
| M1 — Dashboard nav collapse | ✅ | Navbar toggle hides the left nav, persisted (`mdmx:dash-nav-collapsed`), `Mod-\` shortcut that yields to text editors; the editor route stops being four columns wide (ADR-056). |
| M2 — Registry v3 | ✅ | `preview` extracted (static-eval, validated) and used to seed every insert path — palette, slash, rail drop — with props over defaults plus the first paragraph's text; `showIf` panel visibility; `link.placeholder`; `isPropVisible` in core; v1/v2 registries load unchanged (ADR-057). |
| M3 — Component editing UX | ✅ | `componentContext` follows the caret into nested blocks (breadcrumb, crumb selects the ancestor; an edit keeps the block selected); value-typed controls incl. `list`/`object`/`link`/`color`/`date`; effective defaults muted + per-field reset; `showIf` filtering; block actions as pure commands + keymap + an anchored toolbar (delete/duplicate/move/edit source); the render boundary resets on prop change (ADR-058). |
| M4 — Two-way source pane | ✅ | The pane is a CodeMirror 6 editor: typed text applies to the canvas live (300 ms, parse-gated, ⌘⏎ now) through the load path; a syntax error keeps the canvas and shows a strip; MDMX diagnostics are lint markers; the focused pane is authoritative and snaps to canonical on blur; `blockLineMap` maps blocks ↔ lines both ways (ADR-059). |
| M5 — Blocks made usable | ✅ | Wrapper pass over all 39 demo-next blocks: every required prop has a component default mirrored in the registry, defensive parsing, 30/39 previews, 6 `showIf` rules, 5 array props as `list` controls (content updated where shapes changed), variant gaps closed (`Badge.href`/`link`, `Item.size`/`href`, `Separator.orientation`, `Tabs.orientation`/`defaultTab`, `Tooltip.align`/`sideOffset`, `HoverCard.side`/`align`, `TwoColumn.ratio`, `columns` on PricingTable/StatsBand), Tooltip/HoverCard interactive; `mdmx check` clean; parity 0 differing blocks on all four posts (ADR-053 note, ADR-060 records the deferred write-back). |
| M6 — 0.7.0 release prep + docs wave | ✅ | Versions 0.7.0 in lockstep (eight packages + root, AGENTS.md, RELEASING.md, guide 08); `docs/releases/0.7.0.md` absorbs 0.6.0's notes; guides 02 (`preview`, `showIf`, defaults mirror the component) and 04 (source pane, properties, block actions, making room), 07 (syntax-error strip); README, llms.txt, wiki, `PROJECT_STATUS.md` reduced to a pointer; `pnpm verify`, full live sweep, `next build` 0 warnings, `npm pack --dry-run` lists `dist/` only. Publish is the maintainer's step (RELEASING.md). |

## Phase 3 — the moat

| Item | Status | Notes |
| --- | --- | --- |
| Segment composer (reusable MDMX partials) | ⬜ | Reuses the editor |
| GitLab / generic git provider | ⬜ | Interface already abstracted (ADR-014) |
| Real-time collaboration (Yjs) | ⬜ | Single-`props`-attr design supports it |
| GitHub App auth backend | ⬜ | Auth behind an interface (ADR-017) |
| Component builder (visual primitive → code) | ⬜ | Parked; large scope |

## The immediate next milestone

0.7.0 is prepared on `release/0.7.0` and waits on the maintainer's publish
(RELEASING.md) — the first npm release. Deferred from 0.7, in rough order of
value: canvas → prop write-back through a per-block `setProp` channel
(ADR-060); an MDX grammar for the CodeMirror pane (JSX blocks highlight as
markdown HTML today); the CLI extractor honoring tsconfig `paths`; Carousel
and ButtonGroup as blocks (a wrapper-aware layout contract, ADR-053); a page
picker for `link` controls; sidebar auto-switch to Properties on selection
(rejected for 0.7, Q4); an icon-rail nav; `mdmx dev` HMR into a running
editor; nested drop indicators; a from-npm smoke app in CI (guide 08's
tarball flow against a fresh `create-next-app`); then the Phase 3 items
below.
