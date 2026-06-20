# Architecture Decision Record

Every significant decision behind iMDX, with the reasoning and the
alternatives that were rejected. This is the "why" companion to SPEC.md's
"what". Append new decisions; don't rewrite history — supersede with a new
entry that references the old one.

Format: each decision has Context / Decision / Rationale / Alternatives /
Status.

---

## ADR-001 — iMDX is a validation layer over MDX, not a new parser

**Context.** We need a content format that round-trips losslessly through a
block editor while staying plain text in git.

**Decision.** Define iMDX as a strict *subset* of MDX, validated as a
whitelist over the standard mdast (+ mdx-jsx) AST. Reuse `@mdx-js`/`remark`
for parsing; "is this valid iMDX?" is a pure AST-walking function.

**Rationale.** Inherits battle-tested parsing; the same parse path serves the
CLI, editor, and CI; validation runs headlessly in Node.

**Alternatives rejected.** A bespoke parser (huge surface, perpetual drift
from MDX); allowing full MDX (impossible to round-trip — arbitrary JS
expressions, imports, spreads).

**Status.** Implemented in `@imdx/core` (`parse.ts`, `validate.ts`).

---

## ADR-002 — Props are JSON

**Context.** Component props must survive text → editor → text round-trips and
be editable in a property panel.

**Decision.** Props in content may only be JSON-shaped: string/number/
boolean/null literals, arrays, plain objects (identifier or string keys), and
unary minus on numbers. No identifiers, calls, templates, spreads, computed
keys, regex, holes.

**Rationale.** One sentence to document ("props are JSON"); trivially
validated by walking the attribute estree; eliminates the main code-execution
/ XSS surface; makes the property panel a pure data editor.

**Alternatives rejected.** Allowing expressions/computed props (reopens
round-trip and security problems). Computed behavior belongs *inside*
components, configured by JSON props.

**Status.** Enforced in `core/src/props.ts` (content) and
`cli/src/static-eval.ts` (defineIMDX config). Both must change together.

---

## ADR-003 — Canonical serialization is a versioned contract

**Context.** Round-tripping isn't parse→serialize; it's parse→serialize→
*identical bytes*, or every save produces noisy git diffs.

**Decision.** Define exactly one canonical output format via pinned
remark-stringify + mdx-jsx options and a canonical prop printer. Editors
always emit canonical; hand-written files normalize on first save. Changing
any canonical option is **semver-major**.

**Rationale.** Clean diffs are the whole "git-native" promise. A
remark-stringify minor bump that flips `*` to `_` would dirty every file in
every user's repo — so dependency versions are pinned with `~`.

**Guarantees (tested).** `toMDX(parseMDX(x)) === x` for canonical x;
`parse(serialize(t))` structurally equals t; editing one prop changes exactly
one output line.

**Status.** `core/src/serialize.ts` (`CANONICAL_STRINGIFY_OPTIONS`,
`CANONICAL_MDX_OPTIONS`) and `editor/src/to-mdast.ts` (`printPropValue`).

---

## ADR-004 — Raw-node escape hatch

**Context.** A validator that destroys out-of-subset content on open is
hostile to adopting legacy/hand-edited files.

**Decision.** When the editor hits invalid content (an expression, unknown
component, raw HTML), wrap it in an opaque read-only `imdx_raw` block that
stores the exact source slice and re-emits it byte-for-byte. The CLI's
`check`, by contrast, reports these as errors.

**Rationale.** Strict in CI, forgiving in the editor. Graceful degradation
without compromising the format.

**Status.** `editor/src/from-mdast.ts` (raw wrapping) and `to-mdast.ts`
(verbatim re-emit); `core/src/validate.ts` (IMDX003).

---

## ADR-005 — Diagnostics are structured and code-stable

**Decision.** The validator returns `{code, severity, message, span}` with
1-indexed line/column spans. Codes IMDX001–007 have fixed meanings (see
SPEC.md §4); add new codes, never repurpose.

**Rationale.** Spans let the editor highlight the exact raw block, the CLI
print pretty errors, and a future LSP exist. Stable codes are public API
consumers can match on.

**Status.** `core/src/types.ts` (codes), `validate.ts` (emission).

---

## ADR-006 — defineIMDX with type inference, codegen via the TS compiler API

**Context.** Authoring component metadata by hand is tedious and drifts from
the real types.

**Decision.** Developers wrap components in `defineIMDX(Component, config)`.
The CLI extracts prop names/types/optionality/JSDoc from the TypeScript type
and overlays explicit config (explicit wins). Extraction uses the **TS
compiler API directly**, not react-docgen-typescript.

**Rationale.** react-docgen-typescript breaks on HOC-style
`export default defineIMDX(...)` wrappers; the compiler API gives exact
control — find the call, read the props type off the component, statically
evaluate the config literal. The CLI never executes user code.

**Alternatives rejected.** react-docgen-typescript (wrapper confusion);
runtime reflection (requires executing the app).

**Status.** `cli/src/extract.ts`, `infer.ts`, `static-eval.ts`.

---

## ADR-007 — Two generated artifacts: registry.json + registry.ts

**Decision.** `imdx generate` emits `.imdx/registry.json` (pure data, no
React — consumed by validator, CLI, CI, palette) and `.imdx/registry.ts`
(imports the actual components and binds them — consumed by the editor and
the site renderer). The spec is inlined into the .ts to dodge JSON-module
interop differences across bundlers.

**Rationale.** The JSON is environment-agnostic; the TS module is the only
thing that touches component code. One registry serves both the editor
(live block rendering) and production (the MDX `components` map) — that
symmetry is what guarantees WYSIWYG matches production.

**Status.** `cli/src/generate.ts`.

---

## ADR-008 — Function props excluded; required function prop is an error

**Decision.** Function-typed props are silently dropped from the editable
spec (they can't be serialized into iMDX). A *required* function prop is a
build error — the component could never appear validly in content.

**Status.** `cli/src/extract.ts` (warning vs. error), `infer.ts`
(`isFunctionType`).

---

## ADR-009 — mdast is the interchange format

**Context.** Three representations exist: MDX text (storage), ProseMirror doc
(editing), and the AST.

**Decision.** mdast is the hub. Never convert text ↔ ProseMirror directly;
both converters target mdast. Pipeline:
`MDX text ⇄ mdast ⇄ ProseMirror doc`.

**Rationale.** One parse path shared by validator, CLI, editor; round-trip
tests run entirely in Node without a DOM.

**Status.** `editor/src/from-mdast.ts`, `to-mdast.ts`.

---

## ADR-010 — Schema = static core + registry-generated component nodes

**Decision.** The ProseMirror schema has a fixed markdown core plus one node
type per registry component, generated at editor boot. Children policies
compile to content expressions: `none`→atom, `rich-text`→`paragraph*`,
`blocks`→`block*`, `allowedChildren:[X]`→`imdx_X*`.

**Rationale.** Registry constraints become *physics* — an illegal drop simply
won't happen because the content expression rejects it (e.g. `Column` outside
`TwoColumn`). Less error-message code, more correctness by construction.

**Status.** `editor/src/schema.ts`. Tested in `convert.test.ts` ("schema
physics").

---

## ADR-011 — One `props` attr per component node

**Decision.** All of a component's props live in a single ProseMirror `props`
attribute (a JSON object), not one attr per prop.

**Rationale.** A prop edit is a single `setNodeMarkup` transaction → clean
undo/redo and trivial future collaboration (Yjs) semantics. PM attrs must be
JSON-serializable anyway, which the props-are-JSON rule already guarantees.

**Status.** `editor/src/schema.ts` (`nodeSpecFor`).

---

## ADR-012 — Mark canonicalization priority

**Decision.** Inline marks nest in a fixed order, outermost→innermost:
link, strong, em, strike, code.

**Rationale.** Links must never be split across mark boundaries; `inlineCode`
is a leaf in mdast so it must be innermost. This makes serialization
deterministic and idempotent.

**Status.** `editor/src/schema.ts` (`MARK_PRIORITY`), applied in
`to-mdast.ts`. The "strong wrapping an entire link re-nests once" case is
tested and intentional.

---

## ADR-013 — Inline (text-level) components excluded from v1

**Decision.** Only block-level JSX (`mdxJsxFlowElement`) is valid iMDX.
Inline usage like `<Badge/>` mid-sentence (`mdxJsxTextElement`) is IMDX003.

**Rationale.** Halves editor complexity (no inline NodeViews, simpler
selection model). Revisit in a later spec version if demanded.

**Status.** `core/src/validate.ts`.

---

## ADR-014 — ContentProvider contract lives in core; two impls ship

**Decision.** The storage interface (`list/read/commit/delete`) lives in
`@imdx/core` as type-only code. `commit` takes an **array** of changes (atomic
multi-file). Two implementations ship: `GitHubProvider` (Git Data API) and
`LocalProvider` (dev-mode filesystem). Define the interface now even though
GitLab is deferred, so GitHub assumptions don't leak into core/editor.

**Rationale.** A post plus its pasted images must be one commit.
`LocalProvider` gives zero-config local evaluation and doubles as the
reference implementation keeping the interface honest.

**Status.** `core/src/provider.ts`, `provider-github/src/github-provider.ts`,
`next/src/local-provider.ts`.

---

## ADR-015 — Optimistic concurrency via git blob shas

**Decision.** `read()` returns the git blob sha; `commit()` accepts
`expectedShas` (path→sha, `null` = must-not-exist) and throws `ConflictError`
on mismatch. `LocalProvider` computes git-style shas so its conflict
semantics are identical to GitHub's.

**Rationale.** Two open tabs must not silently overwrite each other. Keeping
Local and GitHub semantics in lockstep means the interface has one meaning.

**Status.** Both providers; tested against an in-memory GitHub fake with real
blob shas.

---

## ADR-016 — Path safety is a two-layer guard

**Decision.** Every path passes `assertSafePath` (no `..`, absolute paths,
backslashes, drive letters, control chars) AND a resolved-root containment
check. The API layer additionally confines paths to contentDir/mediaDir
prefixes.

**Rationale.** A git-backed CMS is one `../.github/workflows/x.yml` away from
owning someone's CI. Treat path validation like auth.

**Status.** `core/src/provider.ts` (`assertSafePath`), both providers,
`next/src/api.ts` (prefix check).

---

## ADR-017 — Git-native authorization; stateless sealed sessions

**Decision.** Authorization = GitHub push permission on the configured repo,
re-verified every 5 minutes. No user table, no roles. Sessions are stateless:
data sealed into an AES-256-GCM authenticated cookie, no server store.

**Rationale.** If GitHub says you can write to the repo, you can use the CMS —
authz matching the git-native storage model. Stateless sessions keep the
package deployable anywhere with no database.

**Trade-off acknowledged.** OAuth needs the broad `repo` scope. A GitHub App
(per-repo, fine-grained) is the more trustworthy posture but adds setup
friction; the auth module is behind an interface so a GitHub App backend can
slot in later.

**Status.** `next/src/session.ts`, `auth.ts`.

---

## ADR-018 — API handlers are web-standard Request→Response

**Decision.** `createIMDXHandlers()` returns `{GET,POST,PUT,DELETE}` functions
typed as `Request → Response`, mountable directly as an App Router catch-all
route. Server **re-runs the iMDX validator on every save** (never trusts the
editor client), enforces origin checks on mutations, prefix-confines paths,
maps `ConflictError`→409 / `PathSafetyError`→400 / `AuthError`→status.

**Rationale.** Web-standard handlers are framework-portable and fully
testable headlessly (no Next runtime needed). Client-submitted content is
untrusted input.

**Gotcha codified.** Async sub-handlers are `return await`-ed inside the try
block on purpose — `return promise` would skip the route-level error mapping.

**Status.** `next/src/api.ts`. Tested in `api.test.ts` (17 tests).

---

## ADR-019 — Editor UI: build on TipTap/ProseMirror, not from scratch

**Decision.** The block editor builds on ProseMirror (TipTap for the React
NodeView plumbing). The converters + schema are the project's core IP; the
editor chrome (slash menu, drag handles, prop panel) sits on top.

**Rationale.** A block editor from scratch is a multi-year project.
TipTap's `ReactNodeViewRenderer` solves React-in-ProseMirror, which is the
annoying part.

**Status.** **Superseded by ADR-023** on the TipTap point. Converters, schema,
and command/palette layer remain the foundation; the React NodeView layer was
built on raw ProseMirror rather than TipTap.

---

## ADR-020 — Interactive prototype as the UI spec

**Decision.** `examples/editor-prototype.html` is a self-contained React
artifact demonstrating the full editor UX (registry palette, block editing,
prop panel with live renders, live canonical source pane, drag-and-drop,
delete). It is the **visual/behavioral spec** for the real editor, not
production code.

**Signature design choice.** The split view — blocks on the left, live
canonical iMDX on the right with active-block sync — makes the round-trip
*visible*; that's the product thesis. (See `editor/DESIGN_NOTES.txt`.)

**Drag-and-drop model.** Unified `{kind:"move"|"new"}` drag; canvas-level
nearest-edge drop detection so any pixel resolves to a valid insertion point.

**Known limit.** Operates on a flat top-level block list. Nested editing
(dropping into a TwoColumn's columns) is deliberately *not* in the prototype —
it belongs in the real ProseMirror NodeViews (ADR-021).

**Status.** Prototype complete and iterated; ported pieces pending.

---

## ADR-021 — TwoColumn / nested editing belongs in @imdx/editor, not the prototype

**Context.** Making TwoColumn functional requires a recursive tree model,
nested editable regions, and nested drop targets.

**Decision.** The headless layers (schema content expressions, converters,
validator) already handle nesting and are tested. The remaining work —
NodeViews with `contentDOM`-placed editable holes, nested drop detection via
ProseMirror's `dropPoint` — should be built **directly in `@imdx/editor`**,
not retrofitted into the flat-list prototype.

**Rationale.** Adding recursive nesting to the prototype means reimplementing
most of what ProseMirror already does, then throwing it away. Building it in
the real editor is the higher-value path and the natural next milestone.

**Status.** Not started. Detailed plan in `docs/wiki/TwoColumn.md`.

---

## ADR-022 — Time is injectable in session validation

**Context.** `unseal` hard-coded `Date.now()` for the session-expiry check,
while the API handlers already thread an injectable `now()` everywhere else.
The api.test.ts suite sealed sessions against a fixed timestamp, so once the
real clock passed that date every handler test 401'd — a latent time-bomb.

**Decision.** `unseal(sealed, secret, now = Date.now)` takes an optional clock;
the API handlers pass their `o.now`. Tests anchor `now` to `Date.now()` at run
start so they're deterministic within a run and never time-bomb.

**Rationale.** All time-dependent logic should read one injectable clock;
hard-coding the wall clock in one spot makes that path untestable and
introduces date-dependent flakiness.

**Status.** `next/src/session.ts`, `api.ts`; `next/tests/api.test.ts`.

---

## ADR-023 — Editor React layer on raw ProseMirror, not TipTap (supersedes ADR-019)

**Context.** ADR-019 picked TipTap for the React-NodeView plumbing. When
building the actual React UI, two facts reframed the choice: (1) TipTap *is*
ProseMirror — it adds no faster editing engine, only an abstraction whose main
value is `ReactNodeViewRenderer`; and (2) our schema is **generated dynamically
from the registry** (`buildSchema()`), and the byte-level round-trip invariants
depend on that exact `prosemirror-model` `Schema`. TipTap builds its schema from
Extensions, so adopting it would mean reconstructing or force-injecting the
prebuilt Schema — friction and risk against the round-trip guarantees.

**Decision.** Build the React NodeView layer directly on raw ProseMirror with a
thin (~100-line) React-NodeView adapter (`editor/src/react/react-node-view.tsx`)
that mounts a React root per component node and places PM's `contentDOM` where
the author's component renders `{children}`. Core blocks keep ProseMirror's
plain-DOM rendering; only registered components pay the React cost.

**Rationale.** Performance is at parity (TipTap runs on ProseMirror) and, if
anything, raw PM is leaner: smaller bundle and explicit control over which nodes
are React vs. cheap plain DOM. Keeping the tested `buildSchema()` authoritative
preserves the round-trip invariants with no schema reconciliation. The only
thing TipTap would have provided — React-in-PM — is the small adapter we wrote.

**Status.** Done for the flat editor (`editor/src/react/*`, `@imdx/editor/react`
export). Nested editing (TwoColumn) reuses the same adapter via `contentDOM` and
is the next phase (wiki/TwoColumn, ADR-021).

---

## ADR-024 — `localMode` for the API handlers (run without GitHub)

**Context.** `createIMDXHandlers` required GitHub OAuth on every non-auth route.
That's correct for a deployed CMS but blocks the most useful thing for authoring
and demos: running the editor entirely locally against the working tree. The
roadmap's "runnable demo Next.js app" needs a no-OAuth path.

**Decision.** Add an opt-in `localMode: true`. When set, `requireSession`
returns a synthetic `{ login: "local" }` session and the OAuth routes/callback
are short-circuited; `auth` and `sessionSecret` become optional. Everything else
is unchanged — server-side validation, two-layer path safety, the CSRF same-origin
check on mutations, and `expectedSha` conflict detection (409) all still run.
Pair it with a `LocalProvider` so saves write to the filesystem. `examples/demo-next`
uses exactly this.

**Rationale.** Local authoring shouldn't require provisioning an OAuth app and a
real repo. Gating the bypass behind one explicit flag keeps production safe (the
default still demands OAuth) while making the security-relevant checks
flag-independent, so local mode isn't a hole — it's the same pipeline minus the
identity provider. The companion hardening (a parse failure in a saved `.mdx`
returns 400, not 500) keeps the save endpoint honest under hand-crafted input.

**Status.** `next/src/api.ts`; tested in `next/tests/api.test.ts` ("localMode").
Never enable in production.

---

## ADR-025 — Collections & draft/publish (typed frontmatter, canonical YAML)

**Context.** Content had no schema for its frontmatter and no structured notion
of groupings; draft/publish existed only as an unvalidated `status` string that
readers happened to filter on. Phase 2 needed typed collections and a real
editing surface for frontmatter.

**Decision.**
- **Collections** are authored in `imdx.config.json` (`collections: { name:
  { dir, fields } }`, fields reusing the shared `ControlSpec`) and emitted into
  the registry by `imdx generate` as `CollectionSpec[]`. The content `hash`
  covers them. `Registry.collectionForPath()` resolves a path by longest `dir`
  prefix.
- **Validation**: `validateFrontmatter()` adds **IMDX008** (required field
  missing) and **IMDX009** (value/type mismatch); undeclared keys are allowed.
  Wired into `imdx check` and the save API (strict → 422, report → save + return
  diagnostics).
- **Editing**: the editor gains a `FrontmatterPanel` (sharing the prop panel's
  `Control` renderer). A field edit re-serializes the whole block to **canonical
  YAML** (`stringifyFrontmatter`, pinned `CANONICAL_YAML_OPTIONS`) and writes it
  to the doc node's `frontmatter` attr in one transaction (`setDocAttribute`).
- **Draft/publish** is just a `status` field (`select` over draft/published);
  the demo groups its list by it.

**Why canonical YAML now (chosen over a surgical status-only toggle).** A full
panel is the more complete feature and keeps frontmatter on the same
"canonical-form is the contract" footing as the body (Invariant 1). The cost is
a new pinned serializer (semver-relevant) — accepted deliberately. Frontmatter
the panel doesn't touch still round-trips **verbatim** (the converter is
unchanged); canonicalization happens only on edit, and for typical scalar
frontmatter the canonical form equals the hand-written form, so a status flip is
a one-line diff.

**Status.** `core/frontmatter.ts`, `core/types.ts`; `cli/{config,generate,check}.ts`;
`next/src/api.ts`; `editor/src/react/{FrontmatterPanel,controls}.tsx`,
`Editor.tsx`; `examples/demo-next`. SPEC §1.1/§4/§5 updated. Tested across all
four packages.

## ADR-026 — `imdx dev` watch mode: injectable watcher, hash-diff, no outDir

**Context.** `imdx generate` is a one-shot; authoring components meant re-running
it by hand. Phase 2 listed a watch mode ("HMR-style palette refresh"). The risk
in any watcher is two-fold: (1) it's timing-dependent and therefore hard to test
deterministically, and (2) regenerating writes `registry.{json,ts}` into the
`outDir`, so a naive recursive watch over the project root feeds its own output
back in as a change event — an infinite loop.

**Decision.**
- **The watch surface is exactly the component glob's static base + the config
  file, never the `outDir`.** `staticBase("components/imdx/**/*.tsx")` →
  `components/imdx`; `watchTargets` unions those with `imdx.config.{json,mjs}`
  and filters to paths that exist. The default `outDir` (`.imdx`) is never under
  a component dir, so generate's own writes don't retrigger it.
- **The watcher and the debounce scheduler are injectable** (`Watcher` type;
  `fsWatcher` is the `node:fs.watch` default). Tests drive the loop with a fake
  watcher and `await handle.regenerate()` — no wall-clock timers, no flake.
- **Change detection uses the registry content `hash`** (which deliberately
  excludes `generatedAt`, see `generate.ts`). A regenerate that yields the same
  hash logs `unchanged` rather than re-announcing; this makes editor-save churn
  (mtime bumps with identical content) quiet.
- **Reentrancy**: a regenerate requested while one is in flight sets a `rerun`
  flag and runs exactly once more on completion, collapsing bursts.

**Why injectable over a real-FS integration test.** A test that spawns a watcher
and touches files races the TS extraction (~300ms) — an early version used
`setTimeout(0)` and passed only standalone, failing under parallel load. Driving
the documented `regenerate()` entry point directly tests the same code path
deterministically; the real `fsWatcher` is covered by a manual end-to-end smoke
against `examples/demo` instead.

**Status.** `cli/src/dev.ts`, `cli/src/bin.ts` (`dev` command),
`cli/src/index.ts` (exports); `cli/tests/dev.test.ts` (+7). No format/registry
change, so no SPEC or diagnostic impact. Open: signaling a running editor to
refresh its palette/schema is not yet wired — `dev` regenerates artifacts only.

## ADR-027 — Media library via an editor-side `MediaSource` adapter

**Context.** The `@imdx/next` API already had `POST /media` (upload) and could
list a media dir through `GET /files`, but there was no UI to browse, upload, or
insert media. The question was where the browser lives and how it talks to
storage without coupling the editor to `@imdx/next` (Invariant 9 keeps layers
from depending upward).

**Decision.**
- **The editor owns the UI but not the transport.** `IMDXEditor` takes an
  optional `media: MediaSource` prop — an interface with `list()` and
  `upload()` — mirroring how `onSave` abstracts persistence. The host wires it
  to `@imdx/next`'s routes, a GitHub provider, or a fake. The editor never
  fetches directly; the `MediaLibrary` modal calls only through the adapter.
- **Insertion reuses the existing CommonMark `image` node** (already in the
  schema, converters, and SPEC §2). `insertImage` drops an inline image at the
  cursor (or wraps it in a paragraph when the selection isn't inline). **No new
  grammar, registry, or diagnostic** — picking media is editor behavior, not a
  format change, so SPEC is untouched.
- **Upload helpers are pure and unit-tested** (`safeFilename` sanitizes to a
  repo-safe basename, `mediaPath` joins under the media dir, `bytesToBase64`
  builds the `POST /media` payload). The library component is the only
  DOM-coupled piece; jsdom covers list/filter/pick/upload.
- **The upload type-whitelist stays a server concern.** `@imdx/next`'s
  `MEDIA_EXTENSIONS` (png/jpg/jpeg/gif/webp/avif — deliberately *not* svg, which
  can carry scripts) is the authority; the editor's `IMAGE_EXTENSIONS` governs
  only thumbnail *preview*. A rejected upload surfaces the server error in the
  modal rather than being pre-validated client-side, keeping one source of truth.

**Why an adapter over a built-in fetch client.** Hard-coding `fetch("/api/imdx/
media")` into the editor would couple it to one mount path and one backend, and
break the "main entry is React/Next-free" boundary. The adapter keeps the editor
testable with an in-memory fake and reusable outside Next.

**Status.** `editor/src/react/media.ts`, `MediaLibrary.tsx`, `Editor.tsx`,
`react/index.ts`; `examples/demo-next` (`EditorClient` adapter, sample asset,
CSS). Tests: `editor/tests/media.test.ts`, `media-library.test.ts` (+12).
Verified end-to-end against `next dev`. Open: an `image`-control "Browse…" entry
point into the same library; narrowing the upload `accept` to the server set.

## ADR-028 — `allowedParents` enforced in the editor; region-local insertion

**Context.** S6 shipped TwoColumn nesting, but two gaps surfaced under test:
(1) slash/palette `insertComponent` used `replaceSelectionWith`, which lifted a
component *out* of the Column the cursor was in up to the document top level; and
(2) `allowedParents` is enforced only by the core validator, **not** the
ProseMirror schema — every component node is in the `block` group, so the schema
happily lets a `Column` be a direct child of `doc` (or of another Column). A
slash insert or rail drop could therefore build a schema-valid but
iMDX-*invalid* document (IMDX005) with no immediate feedback. This **refines
ADR-010**: registry constraints are "physics" only on the *children* axis
(`allowedChildren` → the parent's content expression, so `TwoColumn` rejects a
bare paragraph); the *parents* axis (`allowedParents`) is policy the editor must
apply, not schema the model enforces.

**Decision.**
- **Insertion is region-local.** `planComponentInsert` finds the deepest valid
  position for the selection: when the cursor is in an empty textblock (e.g. a
  seeded Column paragraph) whose container accepts the node, replace that block
  in place; otherwise use `insertPoint`. The component lands in the Column it was
  triggered in, not at the top level.
- **The editor enforces `allowedParents` itself** (`parentAllowed`): the node's
  resolved container must be one of `allowedParents` (null/empty ⇒ anywhere).
  This is a deliberate duplication of a validator rule into the editing layer —
  the validator remains the normative authority (SPEC §3), but the editor must
  prevent the bad edit *before* it happens, not just flag it after.
- **The palette and drop are constraint-aware.** `slashItemsFor` filters
  components to those `canInsertComponent` returns true for at the current
  selection (so `Column` never appears outside a `TwoColumn`);
  `resolveComponentDrop` returns null for a forbidden target so the drop is
  rejected rather than forced.

**Why duplicate the rule instead of leaning on the schema.** Encoding
`allowedParents` into the schema (excluding `Column` from the `block` group and
giving it a bespoke group) would make the generated schema depend on the full
cross-product of constraints and would reject *paste*/programmatic construction
that the validator is meant to handle with a diagnostic, not a hard throw. Keeping
the schema permissive and enforcing the constraint at the interaction layer keeps
the two concerns — "what documents exist" vs "what edits the UI offers" —
separate, and matches how core blocks already behave (the schema allows, the
validator judges).

**Status.** `editor/src/commands.ts` (`planComponentInsert`, `parentAllowed`,
`canInsertComponent`, `resolveComponentDrop`, `slashItemsFor`, rewritten
`insertComponent`); `react/Editor.tsx` (drop), `react/SlashMenu.tsx` (palette);
`editor/tests/nested-commands.test.ts` (+9). No SPEC change. Open: a visual drop
indicator for rail (new-component) drags — `prosemirror-dropcursor` only renders
for PM-managed drags; internal block moves already indicate correctly.

## ADR-029 — One media modal, routed to openers via React context

**Context.** After the media library (ADR-027), a second entry point was needed:
`image`-typed prop/frontmatter controls should also open the library to pick a
path. Controls are rendered deep in the tree (PropPanel/FrontmatterPanel →
`Control`), far from the `IMDXEditor` that owns the modal, and there will be more
openers later (e.g. a `link` control). Passing `media` + open/close props down
through every panel and control would be invasive and couple each control to the
modal's lifecycle.

**Decision.** The editor owns **one** `MediaLibrary` instance and exposes a
`requestMedia(onPick)` opener through `MediaPickerContext`. Whoever opens the
library supplies the callback that should receive the pick; the editor stores it
(`mediaPick` state, replacing the old `mediaOpen` boolean) and routes the chosen
asset back to exactly that opener, then clears it. The provider's value is null
when no `media` source is configured, so a control's "Browse…" button hides
itself with a one-line `useMediaPicker()` check. This keeps controls decoupled
from transport (consistent with ADR-027's adapter) and makes a new picker entry
point a few lines, not a prop-drilling change.

**Alternatives rejected.** Prop-drilling `media`/open/close through panels (couples
every control to the modal, repetitive); a second modal per control (duplicated
state, focus/escape handling). A global store would work but context is the
minimal fit for a single-editor subtree.

**Status.** `editor/src/react/media-context.ts`, `Editor.tsx` (provider +
`requestMedia`), `controls.tsx` (`image` case); `editor/tests/controls.test.tsx`
(+4); `examples/demo-next` (`coverImage` field, CSS). Extends ADR-027; no SPEC
change.

## ADR-030 — One editor sidebar with a Source ⇄ Properties toggle

**Context.** The editor shipped a 4-column grid: rail, canvas, properties panel
(col 3), source pane (col 4). Both side panels were always visible, so on
narrower viewports they overlapped and the properties panel spilled under the
canvas (reported with a screenshot). Showing two fixed side panels also leaves no
room for a comfortable editing column.

**Decision.** Collapse the two side panels into **one** right sidebar
(`EditorSidebar`) with a header that toggles between **Source** (the live
canonical iMDX view — the product's signature) and **Properties** (the selected
component's prop panel, or the document frontmatter panel when nothing is
selected). The editor owns a `sidebarMode` state; default is **source** so the
round-trip view — and the existing source-oriented tests — stay the landing view.
The grid becomes three columns with the sidebar width behind a
`--imdx-sidebar-width` CSS variable (the seam for a future drag-to-resize, S12).

**Consumer impact.** This changes the markup consumers style: the always-on
`grid-column: 3/4` panels are gone; CSS moves to a 3-column grid plus
`.imdx-sidebar*` classes. Both bundled stylesheets (`examples/demo-next`,
`examples/editor-playground`) were updated in lockstep; downstream consumers must
do the same. `SourcePane`/`PropPanel`/`FrontmatterPanel` keep their own markup and
classes — they're just mounted inside the sidebar body — so their styles carry
over unchanged.

**Alternatives rejected.** Keeping both panels and making them collapsible
independently (still two columns of fixed cost, the original problem); a bottom
panel (breaks the live-source-beside-content reading that motivates the design).

**Status.** `editor/src/react/EditorSidebar.tsx`, `Editor.tsx`, `react/index.ts`;
`examples/demo-next/app/globals.css`, `examples/editor-playground/src/styles.css`;
`editor/tests/editor-mount.test.ts` (+1, two updated). No SPEC change. Mobile
adaptation and resize handle are tracked as S12/S13 in
`agent-context/plans/road-to-0.3.0.md`.
