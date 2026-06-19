# Roadmap

Status legend: ✅ done · 🟡 partial · ⬜ not started.

## Phase 1 — the spine (a credible Outstatic competitor)

| Item | Status | Notes |
| --- | --- | --- |
| iMDX subset spec + parser/validator/serializer | ✅ | `@imdx/core`, 27 tests |
| `imdx generate` (type extraction → registry) | ✅ | `@imdx/cli` |
| `imdx check` (content lint) | ✅ | `@imdx/cli` |
| Registry→ProseMirror schema + converters | ✅ | `@imdx/editor`, headless, 15 tests |
| Editor command/palette layer | ✅ | `slashItems`, `insertComponent`, input rules |
| GitHub provider (Git Data API) | ✅ | `@imdx/provider-github`, 7 tests |
| LocalProvider + content readers | ✅ | `@imdx/next` |
| Sessions + GitHub OAuth + API handlers | ✅ | `@imdx/next`, 27 tests |
| **Editor React UI (NodeViews, slash menu, prop panel)** | 🟡 | Flat editor done on raw ProseMirror (ADR-023): `@imdx/editor/react`, verified via `examples/editor-playground`. Nested editing pending (Phase 2). |
| **Editor mount page** (App Router route) | ✅ | `examples/demo-next/app/edit/[...slug]` wires the editor ↔ API |
| **Demo Next.js app** dogfooding the full loop | ✅ | `examples/demo-next` — runnable locally via `localMode` (ADR-024); load → edit → save to disk → conflict-safe |

Phase 1 is essentially complete: the headless pipeline, the flat React editor,
and a runnable local Next.js app (load → edit → save → conflict detection) are
all done and tested. What remains for Phase 2 is nested editing and structured
content; GitHub-mode deploy is wired but undocumented as a guide.

## Phase 2 — polish & structured content

| Item | Status | Notes |
| --- | --- | --- |
| **TwoColumn / nested editing** | ✅ | Nested NodeViews + seeded insert; renders/edits/round-trips (ADR-021). Polish (nested drop indicators, per-region slash) pending |
| Container components generally | ✅ | Same machinery as TwoColumn — any `blocks`/slot container works |
| Draft/publish workflow | ✅ | `status` frontmatter field; editor toggle + list grouping (ADR-025) |
| Media library UI | ⬜ | API exists (`POST /media`); needs a browser |
| Collections (typed frontmatter, list views) | ✅ | Config→registry; `validateFrontmatter` (IMDX008/009); editor frontmatter panel (ADR-025) |
| `imdx dev` (registry watch mode) | ✅ | Debounced, hash-diffed regenerate on component/config change (ADR-026). HMR push to a running editor still open |

## Phase 3 — the moat

| Item | Status | Notes |
| --- | --- | --- |
| Segment composer (reusable iMDX partials) | ⬜ | Reuses the editor |
| GitLab / generic git provider | ⬜ | Interface already abstracted (ADR-014) |
| Real-time collaboration (Yjs) | ⬜ | Single-`props`-attr design supports it |
| GitHub App auth backend | ⬜ | Auth behind an interface (ADR-017) |
| Component builder (visual primitive → code) | ⬜ | Parked; large scope |

## The immediate next milestone

The flat React editor is done (ADR-023). Next is **TwoColumn** — the first
nested component — building on the same React-NodeView adapter via `contentDOM`
holes and nested drop targets (plan: [TwoColumn](TwoColumn.md), ADR-021). That
unblocks container components broadly. In parallel, the `@imdx/next` editor
mount page wires the editor to the API handlers.
