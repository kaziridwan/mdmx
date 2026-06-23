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

## Phase 3 — the moat

| Item | Status | Notes |
| --- | --- | --- |
| Segment composer (reusable MDMX partials) | ⬜ | Reuses the editor |
| GitLab / generic git provider | ⬜ | Interface already abstracted (ADR-014) |
| Real-time collaboration (Yjs) | ⬜ | Single-`props`-attr design supports it |
| GitHub App auth backend | ⬜ | Auth behind an interface (ADR-017) |
| Component builder (visual primitive → code) | ⬜ | Parked; large scope |

## The immediate next milestone

The flat React editor is done (ADR-023). Next is **TwoColumn** — the first
nested component — building on the same React-NodeView adapter via `contentDOM`
holes and nested drop targets (plan: [TwoColumn](TwoColumn.md), ADR-021). That
unblocks container components broadly. In parallel, the `@mdmx/next` editor
mount page wires the editor to the API handlers.
