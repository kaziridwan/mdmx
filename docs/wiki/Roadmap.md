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
| Entry tables + new-entry scaffold + delete | ✅ | `GET /documents` (listing + frontmatter); conflict-safe deletes; `expectedSha: null` creates |
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

## Phase 3 — the moat

| Item | Status | Notes |
| --- | --- | --- |
| Segment composer (reusable MDMX partials) | ⬜ | Reuses the editor |
| GitLab / generic git provider | ⬜ | Interface already abstracted (ADR-014) |
| Real-time collaboration (Yjs) | ⬜ | Single-`props`-attr design supports it |
| GitHub App auth backend | ⬜ | Auth behind an interface (ADR-017) |
| Component builder (visual primitive → code) | ⬜ | Parked; large scope |

## The immediate next milestone

0.4.0 (the drop-in dashboard) is feature-complete on `release/0.4.0`.
Remaining polish candidates before Phase 3: nested drop indicators in the
editor, HMR registry push to a running editor, collection deletion/dir
renames (currently git-side operations by design), and a GitHub-mode
deployment guide walkthrough with the dashboard mount.
