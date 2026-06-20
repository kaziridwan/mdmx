# Session Log

Chronological record of what each work session changed. **Newest at the top.**
Every session appends one entry (see the template at the bottom and the upkeep
rule in `AGENTS.md`).

Entries below the divider were reconstructed from the commit history of the
initial design-and-build conversation (12 commits).

---

<!-- APPEND NEW ENTRIES ABOVE THIS LINE -->

### S17 — Demo marketing components: Pricing + Testimonial
- **demo-next**: three more Marketing components:
  - `PricingTable` — `blocks` container, `allowedChildren: ["PricingTier"]`.
  - `PricingTier` — `rich-text`, `allowedParents: ["PricingTable"]`; name/price/
    period/ctaLabel/ctaHref (link) + **featured** (boolean → checkbox control).
  - `Testimonial` — `rich-text` quote; author/role + **avatar** (image → Browse
    via the S10 media picker).
  Registered in `lib/components.ts`; demo-next registry now **12** components.
  Extended `marketing.mdx` (pricing row + testimonial); canonical + `imdx
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
  StatsBand (3 Stats); canonical + `imdx check`-clean. Added `.mk-features`/
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
  `toMDX(parseMDX(...))`** and validated clean by `imdx check`. Marketing CSS
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
- **CSS** (demo + playground in sync): `.imdx-rail-filter`, `.imdx-rail-empty`,
  `.imdx-rail-group-chevron`, group label as a button, `.imdx-slash-group-label`.
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
  `imdx:sidebar-width`, best-effort/SSR-safe). `EditorSidebar` renders a
  `.imdx-sidebar-resize` grab strip on its left edge (`role="separator"`);
  `Editor.tsx` owns the width (init from storage), applies it as the
  `--imdx-sidebar-width` CSS var on the editor root, and drives a mouse-drag
  resize (width = root.right − clientX, clamped, persisted on release; adds
  `body.imdx-resizing` for the drag cursor/selection guard). Exported from
  `react/index.ts`.
- **CSS** (demo + playground in sync): `.imdx-sidebar` is now `position:
  relative`; added `.imdx-sidebar-resize` (hover/active indicator) and
  `body.imdx-resizing`.
- Tests: +8 editor (65→73): `sidebar-resize.test.ts` (clamp bounds/rounding/
  non-finite, storage round-trip + invalid) and a jsdom drag smoke in
  `editor-mount.test.ts` (mousedown→move→up sets the CSS var + persists).
  **174 total.** Builds on ADR-030's `--imdx-sidebar-width` seam (no new ADR).
- Plan: `road-to-0.3.0.md` (S12 ✓). Wiki: Packages, Testing, Home, SessionLog;
  README, PROJECT_STATUS. No SPEC change.
- Follow-ups: S13 mobile layout (floating buttons + half-screen modals).

### S11 — Unified editor sidebar (Source ⇄ Properties)
- **The bug**: the editor laid out as a 4-column grid with the source pane
  (col 4) *and* the properties/frontmatter panel (col 3) both always on; on
  narrower viewports they collided (the user's screenshot). **Fix**: one right
  sidebar with a header that toggles between **Source** (live canonical iMDX) and
  **Properties** (the component prop panel, or the frontmatter panel when nothing
  is selected). Default mode: source (the signature view).
- **editor**: new `react/EditorSidebar.tsx` (`SidebarMode = "source" |
  "properties"`, inline SVG tab icons). `Editor.tsx` holds `sidebarMode` and
  renders one `<EditorSidebar>` in place of the two columns; exported from
  `react/index.ts`. `SourcePane`/`PropPanel`/`FrontmatterPanel` are unchanged —
  now mounted inside the sidebar body.
- **CSS** (demo + playground, kept in sync): grid is now `220px | 1fr |
  var(--imdx-sidebar-width, 380px)`; added `.imdx-sidebar`/`-tabs`/`-tab`/`-body`;
  `.imdx-source` and `.imdx-props` lost their `grid-column` and own scroll (the
  sidebar body scrolls). The `--imdx-sidebar-width` var is the hook for S12's
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
  place a `Column` at the top level (schema-valid, iMDX-invalid).
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
  aligns editor insertion with the existing IMDX004/005 constraint semantics).
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

### S7 — `imdx dev` (registry watch mode)
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
  the palette/schema) is still open; `imdx dev` only regenerates the artifacts.

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
  `CANONICAL_YAML_OPTIONS`, `validateFrontmatter`). New diagnostics **IMDX008**
  (required field missing) / **IMDX009** (value/type mismatch).
- **cli**: `imdx.config.json` gains `collections`; `generate` normalizes + emits
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
  Verified end-to-end in `next dev`: grouping, edit page, IMDX008 on save,
  publish flow.
- Follow-ups: media library UI; per-field frontmatter diagnostics in the panel;
  GitHub-mode deploy guide.

### S4 — Fix workspace linking (`workspace:*` protocol)
- `pnpm install` was 404-ing on `@imdx/next` (and would on any sibling): plain
  `"0.1.0"` internal deps aren't reliably linked by pnpm 10, so it tried the npm
  registry. Converted every internal `@imdx/*` dep across packages + examples to
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
  renders `@imdx/editor/react` via `next/dynamic` ssr:false and saves over the
  API), and the content API mounted at `app/api/imdx/[...route]/route.ts`.
- **`@imdx/next` `localMode`**: `createIMDXHandlers` gains an opt-in that skips
  GitHub OAuth and runs a synthetic `local` session; pairs with `LocalProvider`
  so saves write to the working tree. Validation, path-safety, CSRF-origin, and
  conflict (`expectedSha` → 409) checks all still apply. `auth`/`sessionSecret`
  are now optional (required only without `localMode`). → **ADR-024**.
- Hardened the save path: an unparseable `.mdx` body now returns **400** (was a
  500) — `validateSource` is wrapped in try/catch.
- **`@imdx/editor`**: `IMDXEditor` gains `onSave`/`docTitle` + a save toolbar
  (dirty/saving/saved/error states); computes canonical source via
  `serializeDoc`.
- Verified end-to-end against a running `next dev` AND a production `next build`:
  home list, `/me` (login `local`), file read, **save persisted to disk**, stale
  sha → 409, edit page renders, unknown component → IMDX001 diagnostic, malformed
  MDX → 400.
- Tests: +6 in next (27→33, localMode + parse-guard) → **108 total**.
- Wiki touched: Home, Packages, Testing, Roadmap, SessionLog; README,
  PROJECT_STATUS. No SPEC change. Follow-ups: TwoColumn nested editing; media
  library UI; GitHub-mode deploy guide.

### S1 — React editor UI (flat): NodeViews, chrome, Vite playground
- Ported the prototype's flat editor into `@imdx/editor` as real React over the
  existing tested schema/converters. New `src/react/`: `react-node-view.tsx`
  (thin React-NodeView adapter with `contentDOM` placement — the piece that
  replaces TipTap), `ComponentBlock.tsx` (live render + error boundary →
  placeholder), `Editor.tsx` (`IMDXEditor`: owns the `EditorView`, plugins,
  drag-from-rail drop), and chrome `Rail`/`SlashMenu`/`PropPanel`/`SourcePane`,
  plus `slash-plugin.ts`, `source-map.ts`, `prop-controls.ts`.
- React lives behind a new `@imdx/editor/react` export subpath; the package main
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
  links the plain-versioned `@imdx/*` cross-deps.
- Wiki touched: Home, Packages, Testing, Roadmap, SessionLog; README,
  PROJECT_STATUS, AGENTS package map. No SPEC change (no grammar/registry/
  diagnostic change). Follow-ups: TwoColumn nested editing (next phase),
  `@imdx/next` mount page, runnable demo Next app.

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
- `@imdx/editor` `commands.ts`: `slashItems`, `insertComponent` (seeds
  defaults), markdown input rules, mark commands. Tests added.
- Built `examples/editor-prototype.html` — the interactive UI spec with the
  signature live-source split view. `DESIGN_NOTES.txt` records the aesthetic.

### S0.7 — Build determinism + PROJECT_STATUS
- Root `test`/`build`/`check` build `@imdx/core` first so clean
  `npm install && npm test` works. Added `PROJECT_STATUS.md`.

### S0.6 — @imdx/next server layer
- Sealed AES-256-GCM sessions; GitHub OAuth with push-permission authz + 5-min
  re-verification; `createIMDXHandlers` content/media API with server-side
  validation, origin checks, prefix enforcement, conflict 409s. Caught and
  documented the `return await` error-mapping gotcha.

### S0.5 — Docs + demo
- `SPEC.md` v1; `AGENTS.md`/`CLAUDE.md`/`llms.txt`; `examples/demo` consumer
  (end-to-end generate + check verified).

### S0.4 — Providers
- `ContentProvider` contract + `assertSafePath` in core; `GitHubProvider` over
  the Git Data API with conflict detection; `LocalProvider` + content readers
  in `@imdx/next`. In-memory GitHub fake with real blob shas.

### S0.3 — @imdx/editor converter core
- Registry→ProseMirror schema; `fromMdast`/`toMdast` with mark
  canonicalization, raw fallback, canonical prop printing. Byte-level
  round-trip tests.

### S0.2 — @imdx/cli
- `generate` (TS compiler API extraction, control inference, config merge,
  registry emission) and `check` (content linting).

### S0.1 — Monorepo + @imdx/core
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
