# Testing

489 tests across eight packages, all green. The suites aren't just coverage —
several *are* the spec, locking guarantees that define the product.

## How to run

```sh
pnpm test                     # builds core, then all package suites
cd packages/<name> && pnpm exec vitest run   # one package (rebuild core first if you edited it)
```

## The load-bearing tests (don't weaken these)

| Guarantee | Test | Package |
| --- | --- | --- |
| `toMDX(parseMDX(x))` is a fixed point | `roundtrip.test.ts` | core |
| text→mdast→PM→mdast→text is byte-identical | `convert.test.ts` | editor |
| Editing one prop changes exactly one line | both above | core, editor |
| Raw nodes re-emit verbatim | `convert.test.ts` | editor |
| Every diagnostic code fires on its violation and only then | `validate.test.ts` | core |
| Schema rejects illegal nesting (Column outside TwoColumn) | `convert.test.ts` ("schema physics") | editor |
| Mark re-nesting is idempotent | `convert.test.ts` | editor |
| Conflict detection via expectedShas | `provider.test.ts`, `next.test.ts` | provider-github, next |
| Local & GitHub conflict semantics match | `provider.test.ts` + `next.test.ts` | both |
| Path traversal rejected everywhere | `provider.test.ts`, `api.test.ts` | both |
| Server re-validates saves; origin/prefix/409 enforced | `api.test.ts` | next |
| OAuth flow + session tamper/expiry + re-verification | `api.test.ts` | next |
| `localMode`: no-OAuth read/write, identity, CSRF + prefix still enforced, malformed→400 | `api.test.ts` ("localMode") | next |
| Type inference → control taxonomy | `cli.test.ts` | cli |
| Editor load→serialize is a fixed point (live source pane) | `source-map.test.ts` | editor |
| Source-pane text applies through the load path; a parse error dispatches nothing; frontmatter/raw regions land as a load would | `source-sync.test.ts`, `editor-mount.test.ts` | editor |
| React editor mounts; `contentDOM` lands in the component's render; live source matches | `editor-mount.test.ts` (jsdom) | editor |
| Prop-control value coercion (number/json/multiselect/empty→drop) | `prop-controls.test.ts` | editor |
| Canonical frontmatter YAML is a fixed point; field ordering; MDMX008/009 | `frontmatter.test.ts` | core |
| Collection resolves by longest dir prefix | `frontmatter.test.ts` | core |
| Frontmatter edit rewrites canonical YAML in the live source | `editor-mount.test.ts` | editor |
| Save validates frontmatter (strict 422 / report diagnostics) | `api.test.ts` | next |

If one of these fails after a change, the change is wrong (or it's a
deliberate semver-major decision that needs a new ADR and a fixture update).

## Conventions

- Tests live in `packages/*/tests`; fixtures under `tests/fixtures`.
- The CLI and GitHub provider use **fixtures/fakes** (a fixture app project; an
  in-memory GitHub with real blob shas) so suites run offline and fast.
- When adding grammar surface, add a kitchen-sink fixture line in **both**
  core and editor fixtures.
- When adding a provider, reuse the conflict/path tests as a checklist.

## Gaps to fill as features land

- Populated-TwoColumn round-trip fixture (when nested editing lands —
  see [TwoColumn](TwoColumn.md)).
- Property-based round-trip tests (fast-check) generating random valid PM docs
  — designed for, not yet implemented.

## 0.6 additions

- **editor**: `viewport.test.ts` (`fit` + device zoom math, persistence),
  `panels.test.ts` (collapsible rail/sidebar persistence),
  `interactive.test.ts` (event routing by target and per-policy, the
  canvas-wide link policy, a mounted-editor ⌘-click check, and a round trip
  pinning that `render.interactive` never touches content), plus mount tests
  for the content class, the `fit` default, device switching, and panel
  toggles.
- **cli**: `render.interactive` extraction + registry v2 (`Poll` fixture);
  `studio-handoff.test.ts` — a Tailwind host gets the class manifest and no
  `studio.css`, a non-Tailwind host the reverse, switching removes the stale
  sheet, and `check` warns until a stylesheet scans the manifest.
- **project**: `detectTailwind` (ancestor walk, dependency-list fallback).
- **dashboard**: `config.test.ts` (`contentClassName` convention + override).
- **Live verification is part of every milestone**: a playwright driver
  sweeps 18 surfaces for console errors/failed requests, `parity.mjs`
  compares every element of every block between the public page and the
  editor canvas at zoom 1, `interact.mjs` exercises routing, and a
  computed-style snapshot diff guards the dashboard chrome. They live in the
  session scratchpad, not the repo — the numbers are recorded in the
  SessionLog.

## 0.7 additions

- **dashboard**: `nav-state.test.ts` (collapsed-state persistence, the
  `Mod-\` rule, editable-target detection incl. ProseMirror and CodeMirror)
  and shell tests for the navbar toggle (class + `aria-expanded` +
  storage), restore-on-mount, and the shortcut yielding to an input.
- **core**: `registry-v3.test.ts` — the schema counter, a v2 registry
  loading unchanged, `preview`/`link.placeholder` carried through
  `Registry`, and every `isPropVisible` branch (`eq`, truthy, structural).
- **cli**: fixture `Chart` carries valid + invalid `showIf` rules and a
  `preview` with an undeclared key and children text on a leaf; `Poll` a
  `link` with a placeholder — extraction keeps the valid parts and warns
  about the rest; the registry is v3.
- **editor**: `initialProps` layers `preview` over defaults in declaration
  order; `previewChildren` ignores a leaf; `buildComponentNode` seeds the
  children text for rich-text and blocks; `insertComponent` carries the
  preview into the doc.
- **editor (M3)**: `component-context.test.ts` (caret → deepest component
  + ancestor chain, NodeSelection targets, null in plain content);
  `block-actions.test.ts` (duplicate selects the copy, move swaps and stops
  at the edges, delete leaves a paragraph in an emptied container, nested
  moves stay inside the parent, the keymap resolves the context);
  `render-boundary.test.tsx` (revive on props change, no loop);
  `prop-panel.test.tsx` — a state + dispatch harness with no DOM view:
  breadcrumb, crumb selection, effective default + reset, `showIf` against
  effective values, list rows as one transaction per edit, and the edited
  block staying selected; `controls.test.tsx` value-typed scalars, select
  `allowEmpty`, link/color/date, list and object composition.
- **editor (M4)**: `source-sync.test.ts` (valid text → one transaction
  that re-serializes identically; identical text → no-op; parse error →
  position, nothing dispatched; frontmatter → doc attr; unknown component →
  raw block; selection on the block under the cursor line; `lintSource`
  codes/positions, the syntax error as one marker, frontmatter against the
  collection, MDMX010; `parseError` fallbacks); `source-map.test.ts`
  duplicates + `blockIndexAtLine` + frontmatter offset; `editor-mount.test.ts`
  drives the real CodeMirror pane under jsdom (a `Range.getClientRects`
  polyfill in `tests/setup.ts`): debounce apply, syntax-error strip + fix,
  Mod-Enter, frontmatter → panel, unknown → raw, blur snap, canvas → pane.
- **Live verification (0.7)**, one playwright script per milestone in the
  session scratchpad (recreated from this description when needed):
  `m1-nav.mjs` (toggle, persistence, `Mod-\` and where it yields, canvas
  width delta), `m2-preview.mjs` (rail inserts carry preview props and
  children text), `m3-editing.mjs` (breadcrumb, effective default + reset,
  block actions by toolbar and keyboard, boundary revive), `m4-source.mjs`
  (typed prop → canvas, syntax-error strip + gutter, ⌘⏎, frontmatter →
  panel, unknown → raw, blur snap, undo, edit-source reveal),
  `m5-blocks.mjs` (insert every top-level block: no placeholder, no lint
  marker; popup preview; list-control rows), `parity.mjs` (21 computed
  properties per element of every block, public page vs desktop preview at
  zoom 1 with panels collapsed; root margins read from the block wrapper,
  height excluded), and `sweep.mjs` (16 surfaces, console errors + failed
  requests). Numbers are recorded in the SessionLog.
