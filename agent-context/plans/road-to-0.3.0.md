# Road to 0.3.0 — demo presentability

Goal: make the iMDX demo presentable. Driven by a self-paced `/loop` (≤8h / ≤100
iterations). Each iteration: pick the next unchecked item, implement it fully,
add tests, run the **full** typecheck + test suite green, do the AGENTS.md wiki
upkeep (SessionLog entry, ADR if architectural, sync Packages/Roadmap/Testing/
Home counts), and commit with a `Co-Authored-By` trailer. Re-read this file and
`docs/wiki/SessionLog.md` at the start of each iteration.

**Never** alter canonical serialization or round-trip tests to make something
pass. The editor main entry stays React-free (Invariant 9); React lives under
`@imdx/editor/react`. CSS lives in the consumers (`examples/demo-next/app/
globals.css`, `examples/editor-playground/src/styles.css`) — keep both in sync.

## Standing assumptions (flagged for the user)
- **Tailwind Plus UI blocks are proprietary** (paid). We implement *original*
  components inspired by standard marketing-section patterns (hero, CTA, feature
  grid, pricing, testimonial, logo cloud, FAQ, stats, newsletter), not copies of
  their code.
- **"Save HTML block as a new component"**: true codegen (writing a `.tsx` +
  regenerating the registry) needs a build step the in-browser editor can't run
  safely. We implement a pragmatic version (a named, reusable HTML snippet
  surfaced in the picker) and document the boundary; revisit if the user wants
  full file-writing via the CLI/dev server.

## Iterations / checklist

### Editor sidebar (the breaking right side)
- [x] **S11 — Unified right sidebar.** Replace the always-on source (col 4) +
  properties (col 3) columns with ONE sidebar that toggles between **Source** and
  **Properties** via a header with two icon buttons. Properties mode shows the
  prop panel when a component is selected, else the frontmatter panel. Default
  mode: source (the signature view). Update demo + playground CSS to a 3-column
  grid. jsdom tests for the toggle.
- [x] **S12 — Resizable sidebar (desktop).** Drag handle on the sidebar's left
  edge sets `--imdx-sidebar-width` on the editor root (clamped); persist the last
  width. Pure-ish resize logic unit-tested; jsdom drag smoke.
- [x] **S13 — Mobile layout.** Below a breakpoint: the left palette collapses to a
  floating button (bottom-left) opening a half-height/scrollable modal; the right
  sidebar becomes two floating buttons (bottom-right) — Source and Properties —
  each opening a half-screen (horizontal) scrollable modal with the editor still
  visible behind. Shared modal primitive; tests for open/close + which panel.

### Component picker
- [x] **S14 — Grouping UX.** The rail already groups by `category`; make groups
  collapsible + add a filter box, and group the slash menu by category too.
  Headless tests for grouping/filtering.

### New demo components (original, inspired by common marketing blocks)
- [x] **S15 — Hero + CTA** components (`category: "Marketing"`), live-rendered in
  demo-next, registry regenerated, a showcase `.mdx`.
- [x] **S16 — Feature grid + Stats band.**
- [x] **S17 — Pricing + Testimonial.**
- [ ] **S18 — Logo cloud + FAQ + Newsletter signup.**
  (Each: real component in `examples/demo-next/components/imdx`, `defineIMDX`
  metadata with category/icon, generate, a showcase post, verify in `next dev`.)

### HTML component
- [ ] **S19 — `<Html>` component.** A registered component with a raw-HTML string
  prop, rendered sandboxed (sanitized) in the editor + at build time; a "save as
  snippet/component" affordance per the assumption above. Tests for the
  component + sanitization.

### Release
- [ ] **S20 — Bump to 0.3.0.** All package `version` fields → `0.3.0`, root and
  examples as appropriate; update README/Home/PROJECT_STATUS; final full verify.

## Status notes
- Baseline at start of this plan: 165 tests green (S10), commit `a42c6ee`.
- `examples/demo-next/content/posts/welcome.mdx` is modified in the working tree
  by the user's live demo session — **do not stage/commit it**.
