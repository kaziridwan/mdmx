# Session Log

Chronological record of what each work session changed. **Newest at the top.**
Every session appends one entry (see the template at the bottom and the upkeep
rule in `AGENTS.md`).

Entries below the divider were reconstructed from the commit history of the
initial design-and-build conversation (12 commits).

---

<!-- APPEND NEW ENTRIES ABOVE THIS LINE -->

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
