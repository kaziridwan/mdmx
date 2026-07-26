# Architecture Decision Record

Every significant decision behind MDMX, with the reasoning and the
alternatives that were rejected. This is the "why" companion to SPEC.md's
"what". Append new decisions; don't rewrite history — supersede with a new
entry that references the old one.

Format: each decision has Context / Decision / Rationale / Alternatives /
Status.

---

## ADR-001 — MDMX is a validation layer over MDX, not a new parser

**Context.** We need a content format that round-trips losslessly through a
block editor while staying plain text in git.

**Decision.** Define MDMX as a strict *subset* of MDX, validated as a
whitelist over the standard mdast (+ mdx-jsx) AST. Reuse `@mdx-js`/`remark`
for parsing; "is this valid MDMX?" is a pure AST-walking function.

**Rationale.** Inherits battle-tested parsing; the same parse path serves the
CLI, editor, and CI; validation runs headlessly in Node.

**Alternatives rejected.** A bespoke parser (huge surface, perpetual drift
from MDX); allowing full MDX (impossible to round-trip — arbitrary JS
expressions, imports, spreads).

**Status.** Implemented in `@mdmx/core` (`parse.ts`, `validate.ts`).

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
`cli/src/static-eval.ts` (defineMDMX config). Both must change together.

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
component, raw HTML), wrap it in an opaque read-only `mdmx_raw` block that
stores the exact source slice and re-emits it byte-for-byte. The CLI's
`check`, by contrast, reports these as errors.

**Rationale.** Strict in CI, forgiving in the editor. Graceful degradation
without compromising the format.

**Status.** `editor/src/from-mdast.ts` (raw wrapping) and `to-mdast.ts`
(verbatim re-emit); `core/src/validate.ts` (MDMX003).

---

## ADR-005 — Diagnostics are structured and code-stable

**Decision.** The validator returns `{code, severity, message, span}` with
1-indexed line/column spans. Codes MDMX001–007 have fixed meanings (see
SPEC.md §4); add new codes, never repurpose.

**Rationale.** Spans let the editor highlight the exact raw block, the CLI
print pretty errors, and a future LSP exist. Stable codes are public API
consumers can match on.

**Status.** `core/src/types.ts` (codes), `validate.ts` (emission).

---

## ADR-006 — defineMDMX with type inference, codegen via the TS compiler API

**Context.** Authoring component metadata by hand is tedious and drifts from
the real types.

**Decision.** Developers wrap components in `defineMDMX(Component, config)`.
The CLI extracts prop names/types/optionality/JSDoc from the TypeScript type
and overlays explicit config (explicit wins). Extraction uses the **TS
compiler API directly**, not react-docgen-typescript.

**Rationale.** react-docgen-typescript breaks on HOC-style
`export default defineMDMX(...)` wrappers; the compiler API gives exact
control — find the call, read the props type off the component, statically
evaluate the config literal. The CLI never executes user code.

**Alternatives rejected.** react-docgen-typescript (wrapper confusion);
runtime reflection (requires executing the app).

**Status.** `cli/src/extract.ts`, `infer.ts`, `static-eval.ts`.

---

## ADR-007 — Two generated artifacts: registry.json + registry.ts

**Decision.** `mdmx generate` emits `.mdmx/registry.json` (pure data, no
React — consumed by validator, CLI, CI, palette) and `.mdmx/registry.ts`
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
spec (they can't be serialized into MDMX). A *required* function prop is a
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
`blocks`→`block*`, `allowedChildren:[X]`→`mdmx_X*`.

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

**Decision.** Only block-level JSX (`mdxJsxFlowElement`) is valid MDMX.
Inline usage like `<Badge/>` mid-sentence (`mdxJsxTextElement`) is MDMX003.

**Rationale.** Halves editor complexity (no inline NodeViews, simpler
selection model). Revisit in a later spec version if demanded.

**Status.** `core/src/validate.ts`.

---

## ADR-014 — ContentProvider contract lives in core; two impls ship

**Decision.** The storage interface (`list/read/commit/delete`) lives in
`@mdmx/core` as type-only code. `commit` takes an **array** of changes (atomic
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

**Decision.** `createMDMXHandlers()` returns `{GET,POST,PUT,DELETE}` functions
typed as `Request → Response`, mountable directly as an App Router catch-all
route. Server **re-runs the MDMX validator on every save** (never trusts the
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
canonical MDMX on the right with active-block sync — makes the round-trip
*visible*; that's the product thesis. (See `editor/DESIGN_NOTES.txt`.)

**Drag-and-drop model.** Unified `{kind:"move"|"new"}` drag; canvas-level
nearest-edge drop detection so any pixel resolves to a valid insertion point.

**Known limit.** Operates on a flat top-level block list. Nested editing
(dropping into a TwoColumn's columns) is deliberately *not* in the prototype —
it belongs in the real ProseMirror NodeViews (ADR-021).

**Status.** Prototype complete and iterated; ported pieces pending.

---

## ADR-021 — TwoColumn / nested editing belongs in @mdmx/editor, not the prototype

**Context.** Making TwoColumn functional requires a recursive tree model,
nested editable regions, and nested drop targets.

**Decision.** The headless layers (schema content expressions, converters,
validator) already handle nesting and are tested. The remaining work —
NodeViews with `contentDOM`-placed editable holes, nested drop detection via
ProseMirror's `dropPoint` — should be built **directly in `@mdmx/editor`**,
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

**Status.** Done for the flat editor (`editor/src/react/*`, `@mdmx/editor/react`
export). Nested editing (TwoColumn) reuses the same adapter via `contentDOM` and
is the next phase (wiki/TwoColumn, ADR-021).

---

## ADR-024 — `localMode` for the API handlers (run without GitHub)

**Context.** `createMDMXHandlers` required GitHub OAuth on every non-auth route.
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
- **Collections** are authored in `mdmx.config.json` (`collections: { name:
  { dir, fields } }`, fields reusing the shared `ControlSpec`) and emitted into
  the registry by `mdmx generate` as `CollectionSpec[]`. The content `hash`
  covers them. `Registry.collectionForPath()` resolves a path by longest `dir`
  prefix.
- **Validation**: `validateFrontmatter()` adds **MDMX008** (required field
  missing) and **MDMX009** (value/type mismatch); undeclared keys are allowed.
  Wired into `mdmx check` and the save API (strict → 422, report → save + return
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

## ADR-026 — `mdmx dev` watch mode: injectable watcher, hash-diff, no outDir

**Context.** `mdmx generate` is a one-shot; authoring components meant re-running
it by hand. Phase 2 listed a watch mode ("HMR-style palette refresh"). The risk
in any watcher is two-fold: (1) it's timing-dependent and therefore hard to test
deterministically, and (2) regenerating writes `registry.{json,ts}` into the
`outDir`, so a naive recursive watch over the project root feeds its own output
back in as a change event — an infinite loop.

**Decision.**
- **The watch surface is exactly the component glob's static base + the config
  file, never the `outDir`.** `staticBase("components/mdmx/**/*.tsx")` →
  `components/mdmx`; `watchTargets` unions those with `mdmx.config.{json,mjs}`
  and filters to paths that exist. The default `outDir` (`.mdmx`) is never under
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

**Context.** The `@mdmx/next` API already had `POST /media` (upload) and could
list a media dir through `GET /files`, but there was no UI to browse, upload, or
insert media. The question was where the browser lives and how it talks to
storage without coupling the editor to `@mdmx/next` (Invariant 9 keeps layers
from depending upward).

**Decision.**
- **The editor owns the UI but not the transport.** `MDMXEditor` takes an
  optional `media: MediaSource` prop — an interface with `list()` and
  `upload()` — mirroring how `onSave` abstracts persistence. The host wires it
  to `@mdmx/next`'s routes, a GitHub provider, or a fake. The editor never
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
- **The upload type-whitelist stays a server concern.** `@mdmx/next`'s
  `MEDIA_EXTENSIONS` (png/jpg/jpeg/gif/webp/avif — deliberately *not* svg, which
  can carry scripts) is the authority; the editor's `IMAGE_EXTENSIONS` governs
  only thumbnail *preview*. A rejected upload surfaces the server error in the
  modal rather than being pre-validated client-side, keeping one source of truth.

**Why an adapter over a built-in fetch client.** Hard-coding `fetch("/api/mdmx/
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
MDMX-*invalid* document (MDMX005) with no immediate feedback. This **refines
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
`Control`), far from the `MDMXEditor` that owns the modal, and there will be more
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
canonical MDMX view — the product's signature) and **Properties** (the selected
component's prop panel, or the document frontmatter panel when nothing is
selected). The editor owns a `sidebarMode` state; default is **source** so the
round-trip view — and the existing source-oriented tests — stay the landing view.
The grid becomes three columns with the sidebar width behind a
`--mdmx-sidebar-width` CSS variable (the seam for a future drag-to-resize, S12).

**Consumer impact.** This changes the markup consumers style: the always-on
`grid-column: 3/4` panels are gone; CSS moves to a 3-column grid plus
`.mdmx-sidebar*` classes. Both bundled stylesheets (`examples/demo-next`,
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

## ADR-031 — Mobile editor: one DOM, repositioned by CSS

**Context.** On narrow viewports the three-column editor (rail · canvas ·
sidebar) doesn't fit. The panels need to become overlays, but the rail and
sidebar are stateful (ProseMirror view, prop panel, live source) — rendering a
second "mobile" copy would duplicate that state and risk divergence.

**Decision.** Keep a **single** render tree and reposition it with CSS. Below an
860px breakpoint a `@media` block turns the rail into a left slide-in sheet and
the sidebar into a right slide-in sheet (`position: fixed` + `translateX`),
collapses the grid to one column, and reveals floating action buttons. React owns
only the open-state (`mobilePanel`), exposed as `is-palette-open` /
`is-sidebar-open` classes on the editor root that flip the sheets' transform; a
backdrop dismisses. The Source/Properties FABs reuse the existing `sidebarMode`
(ADR-030) — they set the mode, then open the one sheet — so there is exactly one
source pane and one prop panel regardless of viewport. Inserting from the mobile
palette closes the sheet via a new `Rail.onAfterInsert`.

**Why not a separate mobile component tree.** Two trees would mean two
ProseMirror views (or prop-drilling one into both), doubling the surface for
selection/undo bugs and the live-source divergence the design is built to avoid.
CSS repositioning keeps the desktop and mobile experiences literally the same
components.

**Status.** `editor/src/react/Editor.tsx` (mobile state + FABs + backdrop),
`Rail.tsx` (`onAfterInsert`), `icons.tsx` (shared); `examples/demo-next/app/
globals.css`, `examples/editor-playground/src/styles.css` (`@media` block);
`editor/tests/editor-mount.test.ts` (+2). No SPEC change. The half-screen sheet
width (`min(440px, 92vw)`) and breakpoint are tunable; resize is desktop-only.

## ADR-032 — `<Html>` block: best-effort sanitizer + snippets as "save as component"

**Context.** Users want an escape hatch — drop in custom HTML — and to "save it
as a new component in the picker." Two hard constraints shape the design: (1)
rendering arbitrary HTML is an XSS vector, and the same component renders at
**build time** (no DOM) and in the editor; (2) MDMX components are *code*
(`.tsx`) compiled into the registry by `mdmx generate`, so the in-browser editor
cannot mint a real new component at runtime without a build step.

**Decision.**
- **`<Html>` is an ordinary registered component** with a single `code` string
  prop (textarea control). No grammar/registry/diagnostic change — it round-trips
  like any other component, so SPEC is untouched.
- **Sanitize on render with a pure, dependency-free `sanitizeHtml`** living in
  `@mdmx/editor`'s React-free main entry (so the build-time render can import it
  without a DOM). It strips active-content elements, `on*` handlers, and
  `javascript:` URLs. It is explicitly **best-effort** (a regex pass, not a
  parser) and documented as such — production untrusted input should use a real
  sanitizer (DOMPurify). Chosen over a DOM-based sanitizer because there is no DOM
  at build time and we won't add a heavy dep to the demo path.
- **"Save as component" is a snippet, not codegen.** Saved HTML is persisted to
  `localStorage` (`mdmx:snippets`) and surfaced as a **Snippets** group in the
  rail; inserting one drops an `<Html>` block carrying the saved markup. This is
  the pragmatic stand-in for `.tsx` codegen (which would require writing a file
  and re-running `mdmx generate` — a CLI/dev-server job, not an editor one).
  Flagged to the user; revisit if true file-writing codegen is wanted.

**Alternatives rejected.** Allowing raw HTML in the MDMX grammar (reopens the
round-trip/security surface MDMX003 deliberately closes — raw HTML stays *out* of
the subset; `<Html code="…">` keeps it as JSON-prop data instead). Runtime
`.tsx` generation from the browser (no safe build step). A DOM/iframe sandbox
(doesn't help the no-DOM build render).

**Status.** `editor/src/sanitize-html.ts`, `snippets.ts`, `Rail.tsx` (snippets
group), `Editor.tsx` (insert + save affordance), main `index.ts` exports;
`editor/tests/sanitize-html.test.ts` + `snippets.test.ts` + rail/editor-mount
(+16). `examples/demo-next/components/mdmx/Html.tsx`, showcase, CSS. No SPEC
change. Open: snippet rename/delete UI; selection-gated save trigger isn't
jsdom-tested.

## ADR-033 — Caret at the canvas edge + paste-image upload into the collection dir

**Context.** Two editor gaps surfaced from authoring. (1) The canvas mount has
large bottom padding; clicking it lands on the mount element, never the inner
`.ProseMirror` editable, so ProseMirror's own click-to-place handling never
fires and the caret appears to vanish below the last block — worse when that
block is a non-textblock component (an atom you can't type into). (2) Authors
expect to **paste a screenshot** and have it stored and inserted, and want
pasted assets organized per post, not dumped in one flat media folder.

**Decision.**
- **Caret-at-edge is a host-level `mousedown` on the mount, not a ProseMirror
  plugin.** When the target *is* the mount (so the click hit padding, not
  content), compare the pointer Y to the editable's bounding box: below → select
  doc end, above → doc start; side padding is left to default. If the doc ends in
  a non-textblock node, append an empty paragraph first so there's a caret
  target. Chosen over a "trailing-node" plugin that always keeps an empty
  paragraph — that would risk dirtying canonical output (Invariant 1) and only an
  explicit user click should mutate the doc.
- **Paste-to-upload reuses the existing `MediaSource` adapter** (same seam as the
  media library; no new transport). `handlePaste` pulls the first image from
  `clipboardData` and uploads it; the destination is
  `<mediaDir>/<collection-name>/pasted-<iso-timestamp>.<ext>`. The collection
  subdir stays **within the API's media-dir containment check**, so path-safety
  (Invariant 7) is unchanged; timestamped names avoid the never-overwrite
  (`expectedShas: null`) media-commit path colliding. The collection name comes
  from the editor's existing `collection` prop, read through a ref so the
  long-lived ProseMirror view isn't rebuilt when it changes.

**Alternatives rejected.** A trailing-paragraph plugin (canonical-output risk,
above). Embedding pasted images as data-URLs (bloats content, not a repo asset).
A new upload endpoint (the `/media` route + `MediaSource` already cover it).
Putting the back link in the demo's chrome instead of the editor toolbar (the
editor takes the full viewport; a toolbar affordance is the natural slot and
stays framework-agnostic via a plain `backHref`).

**Status.** `editor/src/react/Editor.tsx` (caret handler, `handlePaste`,
`backHref`/`backLabel`), `editor/src/react/media.ts` (`imageFromClipboard`,
`timestampedMediaName`, `pastedMediaPath`, `pastedImageUpload`);
`editor/tests/media.test.ts` (+9). Example CMS UI (collections home,
`/collections/[name]`, `CmsHeader`/`DocList`/`NewPostButton`, `lib/scaffold.ts`)
is host-app scope, not core. No SPEC change. Open: media `list()` doesn't recurse
into collection subdirs; caret-at-edge is layout-dependent so not jsdom-tested.

## ADR-034 — `@mdmx/dashboard`: a drop-in app-layer package above the sibling rule

**Context.** 0.4.0's goal is a full CMS dashboard the consumer gets by
creating one page route (plus the API route) — no hand-built list/edit pages.
That UI inherently composes two siblings: the editor (`@mdmx/editor/react`)
and the Next.js glue (`@mdmx/next`). Invariant #9 says siblings only depend
on each other through `core`, which kept the format/editor/provider layers
untangled — but a dashboard that may not import the editor cannot exist.
Putting the UI inside `@mdmx/next` would give the React-free glue package a
React surface; growing `@mdmx/editor/react` would give the editor routing and
auth concerns.

**Decision.**
- **New package `@mdmx/dashboard`, explicitly the app layer.** It depends on
  `core` + `editor` + `next` and sits at the top of the dependency graph;
  nothing depends on it. Invariant #9 is amended: *library* siblings still
  only meet through `core`; `@mdmx/dashboard` is the one composition point
  allowed to import them all. The format/editor/provider layers stay as
  decoupled as before — the dashboard is a consumer of their public APIs, a
  living test that those APIs suffice.
- **Two-file mount is the canonical DX** (Outstatic's model): an optional
  catch-all page (`app/mdmx/[[...slug]]/page.tsx`) built by
  `createDashboardPage()`, and the existing API catch-all built by
  `createMDMXHandlers()`. `@mdmx/dashboard/next` re-exports the `@mdmx/next`
  surface so both files import from one package. App Router cannot serve
  mutations from a `page.tsx`, so one file is physically impossible; two
  ~3-line files is the honest minimum.
- **The server side of the page stays thin.** It reads `.mdmx/registry.json`
  per request and passes the spec + resolved config (both JSON) to the client
  `DashboardApp`, which does everything else through the content API. One
  data path (the API) serves both localMode and GitHub mode; the dashboard
  has no provider access of its own. Author components cross the boundary as
  client references via the factory's `components` option.
- **The dashboard ships a stylesheet** (`dist/styles.css`, imported by the
  `next` entry so the mount is styled with zero config): light + dark via
  `prefers-color-scheme` with a `data-mdmx-theme` override, every value on
  `--mdmx-*` custom properties. This deliberately diverges from the editor's
  headless stance (ADR: editor stays unstyled): a drop-in product must look
  like one out of the box, while the editor remains embeddable in any design
  system. Consumers theme by overriding tokens or replacing the file.
- **Routing is one pure function** (`resolveRoute(slug)`): the catch-all's
  slug segments map to views (`home`, `collection`, `collection-new`,
  `collection-edit`, `entry-new`, `editor`, `media`, `settings`), so the URL
  scheme is unit-tested without React and navigation is plain `next/link`
  server round-trips (fresh registry per view, no client cache to invalidate).
- **Auth is a client gate over `/me`.** The page renders unconditionally; the
  client asks the API who it is (401 → GitHub login screen → the existing
  OAuth routes; localMode → synthetic `local` session, shown as a "local"
  badge). The API remains the sole enforcement point — the gate is UX, not
  security, matching the existing model where every mutation re-checks the
  session server-side.

**Alternatives rejected.** A `./dashboard` subpath of `@mdmx/next` (drags
React into the glue package and still violates the sibling rule toward the
editor, just implicitly). Growing `@mdmx/editor/react` into the shell (the
editor package would take on `next` as a peer and auth/routing concerns).
Server-gating the page via cookie unsealing in the page factory (would need
the session secret in the page's config too — two places to misconfigure —
for no security gain, since the API enforces everything). CSS Modules baked
into components (hardest to theme; the single tokenized stylesheet is
replaceable wholesale).

**Status.** `packages/dashboard` scaffolded: config resolution, route
resolver, typed API client, `AuthGate`, `DashboardShell` (navbar / left nav /
main / contextual right panel), `HomeView`, placeholder views, stylesheet
foundation, `createDashboardPage()` factory, `next/link` CJS-interop shim;
19 tests (routes, gate, shell). Collection CRUD API + the real views land in
the following 0.4.0 milestones. Root `test`/`check` scripts now build all
packages first (dashboard typecheck/tests need sibling dists).

## ADR-035 — Collections are config-as-code, resolved at request time

**Context.** The 0.4.0 dashboard creates and edits collections. Collections
live in `mdmx.config.json` and were baked into `.mdmx/registry.json` by
`mdmx generate` — so a dashboard-created collection would not exist until the
next generate + rebuild, which in GitHub mode means a redeploy before the
author can add a first entry. Moving collections to a runtime store would fix
the latency but fork the source of truth away from the config file the CLI
and generate pipeline read.

**Decision.**
- **`mdmx.config.json` stays the single source of truth.** The dashboard
  mutates collections by writing that file through the ContentProvider —
  the same commit pipeline as content, with `expectedShas` conflict safety
  (a concurrent config edit → 409, like any stale save).
- **The API resolves collections per request** (`@mdmx/next`): new option
  `configPath` (default `mdmx.config.json`); `GET /collections`,
  `POST /collections`, `PUT /collections/:name` and the frontmatter
  validation inside `PUT /file` all read the file via the provider and derive
  `CollectionSpec[]` on the spot. A collection created from the dashboard is
  therefore live immediately — in localMode *and* GitHub mode — while
  `mdmx generate` keeps baking the same data into the registry for the CLI,
  `mdmx check`, and build-time readers. No cache in 0.4.0: one provider read
  per request that needs collections (a file read locally, one API call on
  GitHub) is the predictable baseline; add caching only if it hurts.
- **The conversion lives in core** (`collections-config.ts`):
  record-form (authored) ⇄ array-form (registry) plus
  `validateCollectionConfig` (name/dir shape, recursive `ControlSpec`
  checking) and a standalone `collectionForPath`. The CLI's private
  `normalizeCollections` was replaced by the same function — one canonical
  derivation everywhere.
- **Fallback + migrate-on-write.** When the config file is missing or has no
  `collections` block, reads fall back to the collections baked into the
  registry; the first collection write seeds those into the file so it
  becomes complete and authoritative from then on. `PUT` edits fields only
  (renaming a collection's `dir` means moving committed files — out of scope
  for 0.4.0). Update uses `PUT /collections/:name`, not PATCH, so the
  `MDMXHandlers` surface stays `{GET, POST, PUT, DELETE}` and existing mount
  files keep working.
- **Constraints enforced server-side:** collection names and field names are
  `^[a-z0-9][a-z0-9_-]*$`; a collection's `dir` must sit under `contentDir`
  (else the file API could never reach its entries); duplicates → 409;
  invalid shapes → 400 with a `problems` list. `/me` now also reports
  `contentDir`/`mediaDir`/`validation`/`localMode` for the settings surface.

**Alternatives rejected.** A runtime collections store (`.mdmx/collections.
json`) — instant but forks the source of truth and the CLI would need to
merge two inputs. Regenerating the registry from the server (drags the TS
compiler / `@mdmx/cli` into the request path). PATCH for updates (new method
export forced into every consumer's route file). Writing config only at
generate time (the status quo — exactly the redeploy latency this removes).

**Limitation.** Runtime collection management requires a *JSON* config; a
project configured only via `mdmx.config.mjs` gets read-fallback from the
baked registry, but a dashboard write creates `mdmx.config.json`, which
`loadConfig` prefers — such projects should migrate their config to JSON
before using dashboard collection management.

**Status.** `core/src/collections-config.ts` (+7 tests),
`collectionForPath` extracted; `next/src/api.ts` collection routes +
request-time resolution (+12 tests, incl. strict-mode MDMX008 on a
just-created collection); CLI reuses the core derivation; dashboard client
(`listCollections`/`createCollection`/`updateCollection`, richer `Me`) and a
`DashboardContext` feeding live collections to the shell. Verified live:
create → list → validated save, then config restored.

## ADR-036 — Responsive preview modes: device-width canvas under CSS `zoom`, container queries for authors

**Context.** The editor canvas was a fixed `max-width: 720px` column, so
every component rendered in its narrow/"mobile" form regardless of how it
would look on a real page (the headline complaint of the 0.4.1 brief). Two
structural facts constrain the fix: window-level `@media` queries respond to
the browser viewport, never to a canvas width; and container components
(FeatureGrid, PricingTable, TwoColumn) laid out ALL children in one grid cell
inside the editor, because ProseMirror's contentDOM wrapper sat between the
component's grid/flex element and the child blocks.

**Decision.**
- **Canvas width presets, not an iframe.** The toolbar gets a
  mobile/tablet/desktop switch (390/768/1280 px, persisted to
  `localStorage("mdmx:viewport")`, default desktop). The canvas renders at
  the real device width and is scaled to fit the pane with CSS `zoom`
  (`--mdmx-canvas-w`, `--mdmx-canvas-zoom`); `zoom` affects layout, so no
  phantom scroll height, and prosemirror-view 1.40 handles caret math under
  it. Editing stays live in every mode. An iframe would make window media
  queries literally true but drags the whole editor across a frame boundary
  (style injection, portals, event plumbing) — rejected.
- **The canvas is a named inline-size container** (`mdmx-canvas`); author
  components respond to it with `@container` queries. The demo's `mk-*`
  styles migrated from `@media` to `@container`, and public pages wrap
  articles in the same kind of container (`.mdmx-page`), so the editor's
  desktop preview and the published page reflow identically.
- **The editable hole is layout-transparent.** `.mdmx-content` and the
  PM-managed `.mdmx-contentdom` inside it are `display: contents`, so a
  container component's grid/flex finally sees child NodeViews as direct
  items. This is the second half of "components don't render the way they're
  meant to" and benefits every viewport mode.

**Alternatives rejected.** `transform: scale` (visual-only — layout height
stays unscaled, producing dead scroll space); per-component editor CSS that
duplicates each grid onto the wrapper (unbounded duplication); read-only
device preview pane (doesn't fix editing).

## ADR-037 — Publishing modes: `draft | private | published` with a viewer-side session guard

**Context.** 0.4.1 adds a third publishing state: private entries render at
`/private/<collection>/<slug>` for authenticated viewers only. `status` was
already a plain collection frontmatter field (`draft | published`), and the
demo app had no public rendering at all — every route redirected into the
dashboard.

**Decision.**
- **`private` is just a status value**, not a new mechanism: collections add
  it to their `status` select options; readers filter on it
  (`getDocuments(dir, { status })` already existed). Semantics: drafts render
  nowhere, published renders publicly, private renders only behind the guard
  — each status has exactly one home, and anything else 404s.
- **"Authenticated" = the MDMX session.** `@mdmx/next` exports
  `getSession(cookieHeader, { sessionSecret | localMode })` — the sealed
  GitHub-OAuth cookie in GitHub mode, the synthetic session in localMode
  (private pages are always viewable in local dev). Web-standard inputs
  only, so it works in server components, route handlers, and middleware.
  `privateHref(collectionPath, slug)` builds the URL scheme. A separate
  visitor-auth system was rejected: private means "anyone who can use the
  CMS can view".
- **A real renderer ships as `@mdmx/next/render`** (react as an optional
  peer, its own subpath so the API/reader entry stays react-free):
  `MDMXContent` walks core's mdast straight to React — markdown + GFM nodes,
  component tags resolved through a ComponentMap with `evaluateAttributes`
  props, recursion into component children, unknown components degrade to a
  marked `<div>` instead of dropping content. The demo grew the public face
  that proves the three modes end-to-end (home list, `/posts/[slug]`,
  guarded `/private/[...path]`).

**Alternatives rejected.** A dedicated `visibility` frontmatter field
(duplicates `status`); MDX compilation for public pages (drags the MDX
toolchain into the app when core's parser + a tree walk suffice);
middleware-only guarding in the package (Next middleware is app-level; the
package supplies the primitive instead).

## ADR-038 — Component Studio: template-tree components in the content repo, Tailwind browser runtime, eject-to-TSX

**Context.** 0.4.1's studio lets authors build Tailwind-styled components in
the browser and use them immediately. MDMX components are TSX compiled into
a typed registry by `mdmx generate` — a browser can't produce those without
codegen plus a rebuild (and in GitHub mode, a redeploy). The repo also had no
Tailwind at all, and arbitrary user-typed classes defeat build-time JIT.

**Decision.**
- **A studio component is data, not code:** a restricted element tree
  (tag/attr allowlists — no script/style/iframe, no `on*`, no
  `javascript:`/`data:` URLs, node/prop caps) with typed props
  (string|number|boolean), `{props.x}` interpolation in text/attribute
  values, and explicit `{slot}` nodes. Stored as JSON at
  `<contentDir>/_components/<Name>.json` — committed through the provider
  like content, so it works identically in localMode and GitHub mode with
  path-safety and conflict checks for free. HTML is only an input format:
  the UI parses markup via DOMParser into the tree (dropping and reporting
  anything outside the allowlist); the server validates the JSON tree shape
  — no HTML parser dependency, and rendering never touches
  `dangerouslySetInnerHTML`.
- **Runtime registry merge, code wins.** The API merges stored defs into its
  registry for save-time validation; the dashboard fetches defs after auth
  and merges specs + a generic `studioComponent(def)` renderer into the
  registry/ComponentMap (rail "Studio" group, slash menu, prop panel, live
  canvas render — indistinguishable from code components). `mdmx check`
  merges them too. On a name clash the code component shadows the studio
  def everywhere. The first studio fetch gates dashboard rendering: a
  registry identity change re-creates the ProseMirror editor, which must
  not happen underneath someone typing.
- **Tailwind v4 browser runtime** (`@tailwindcss/browser`, URL configurable
  via dashboard `tailwindSrc`) loads on demand wherever studio components
  render — studio views, editor canvas, and public pages that use them. The
  injected stylesheet imports **theme + utilities only, no preflight**:
  preflight would reset the dashboard chrome and the author's own `mk-*`
  styles. Build-time Tailwind stays possible later; the runtime is what
  makes "type any class, see it now" true.
- **Eject graduates, never migrates.** `studioComponentToTSX` (core)
  generates a `defineMDMX` component file matching hand-written conventions;
  `POST /studio/components/:name/eject` writes it to `componentsDir`
  (default `components/mdmx/`, refusing to overwrite). The JSON definition
  intentionally stays active until `mdmx generate` + rebuild promote the
  code version — deleting it at eject time would break the component until
  the next deploy.

**Alternatives rejected.** Generating TSX directly from the studio (instant
use only in localMode; GitHub mode would need a redeploy before first use,
and editing means re-parsing generated code). Raw HTML strings as the stored
format (server-side sanitizing needs an HTML parser; rendering needs
`dangerouslySetInnerHTML`; eject needs a parser again). A fixed utility-class
subset shipped as static CSS (defeats "Tailwind-style" authoring).

## ADR-039 — Convention over configuration: three-tier config, env-detected mode, fail-closed production

**Context.** The honest Next.js onboarding footprint was ~8 files / 90–130
lines (S25 review §1B): `createMDMXHandlers` requires `repo`, `contentDir`,
`mediaDir`, `createProvider`, and a hand-loaded registry; guide 01 tells the
user to write `lib/mdmx-config.ts` (24 lines of `readFileSync`) themselves;
`contentDir` lives in three places that must agree by hand. The 0.5 session
objectives were: the most-used recipe quick, the API layered.

**Decision.** The standing principle for every MDMX API surface: **Layer 1 is
a zero/near-zero-argument convention path; Layer 2 keeps every explicit
option as an override.** Config placement is three-tier:

- `mdmx.config.json` — structural, committed, identical across environments:
  `contentDir`, `mediaDir`, `componentsDir`, collections, **`repo`**
  (owner/name/branch — facts, not secrets), `basePath`, `editorPath`,
  `validation`.
- Env vars — secrets and deploy-environment: `MDMX_GITHUB_CLIENT_ID`,
  `MDMX_GITHUB_CLIENT_SECRET`, `MDMX_SESSION_SECRET`.
- Options object — overrides only, plus test injection (`createProvider`,
  `now`).

Everything else derives: registry from `outDir`, `configPath` from the
project root, `insecureCookies` from `NODE_ENV`. **Mode is auto-detected**:
OAuth env vars present → GitHub mode; absent → local mode, but only when
`NODE_ENV !== "production"` — production with no auth configured **fails
closed** with an error naming the exact missing env vars. Explicit
`mode: "local" | "github"` remains as an override; local mode in production
additionally requires `allowLocalModeInProduction: true` (local mode means
unauthenticated writes).

**Alternatives rejected.** `repo` in env (not a secret, needed by the CLI,
identical everywhere). A committed `"mode"` field in config (ships the same
value to dev and prod; env overrides would reintroduce detection anyway).
Silent local fallback in production (fail-open on auth). Keeping explicit
`localMode` as the entry point (boilerplate paid by everyone forever; the
surprise of env-triggered OAuth is visible and recoverable, the boilerplate
is not).

**Status.** Planned — 0.5 M3 (`.dev-context/plans/2026-07-26-0.5-plan.md`
D1–D3).

## ADR-040 — Codegen owns the convention layer: generated component maps, bound server entry, committed deterministic `.mdmx/`

**Context.** One component appeared in three parallel lists (generated
`registry.ts` — which lacked `"use client"` and had zero consumers — plus
hand-maintained `lib/components.ts` and `lib/components-server.ts`, existing
only because the RSC boundary needs a `"use client"` re-export the server
pages must not share). Public pages hand-stitched studio rendering per route
(defs fetch + map merge + substring sniff + a copied Tailwind CDN runtime).
Package code cannot import userland paths — but generated code can import
everything. Guides said commit `.mdmx/`; `.gitignore` ignored it.

**Decision.** `mdmx generate` emits the whole convention layer into `.mdmx/`:

- `registry.json` — data (unchanged).
- `registry.ts` — server-safe: spec + `serverComponents` map.
- `components.ts` — the same map behind `"use client"`, for the dashboard
  mount.
- `server.ts` — bound Layer-1 helpers closing over config + maps:
  `getEntry`/`MDMXEntry` (collection addressed **by name** via
  `mdmx.config.json`, default status `published`, studio defs fetched and
  merged internally, missing entry → `notFound()`); imports `studio.css`
  (ADR-042).

`getDocumentBySlug` + `MDMXContent` + a caller-supplied map remain the
explicit Layer 2. **`.mdmx/` is committed**, which makes determinism a hard
requirement: `generatedAt` leaves the artifacts, writes are hash-gated (no
byte churn on no-op regenerates), and `mdmx check` fails when the committed
registry is stale relative to source.

**Alternatives rejected.** A registry↔map lint over hand-written maps (keeps
the triplication, only detects drift). Runtime map resolution inside the
packages (impossible across the userland import boundary). Ignoring `.mdmx/`
(loses reviewable registry diffs — the WYSIWYG contract — and
clone-then-browse; the CI-regeneration argument is moot since `predev`/
`prebuild` regenerate regardless).

**Status.** Planned — 0.5 M3 (plan D4/D6/D10).

## ADR-041 — `mdmx init nextjs`: scaffold the recipe, create-don't-mutate

**Context.** After ADR-039/040, the remaining onboarding steps are files
codegen cannot own: `mdmx.config.json`, the two mount files,
`transpilePackages`, and `package.json` scripts — all copy-from-guide today.

**Decision.** A CLI scaffolder, target-scoped as a subcommand
(`mdmx init nextjs`; bare `mdmx init` lists targets; future frameworks get
their own subcommand). It **creates** `mdmx.config.json`, the API route and
dashboard page mounts, a starter component, and a starter entry — skipping
any file that exists, never overwriting — then runs `mdmx generate` so
`next dev` works immediately. It may add scripts to `package.json` (safe
JSON). It does **not** edit `next.config.*`: it prints the
`transpilePackages` snippet, and `mdmx check` warns when it is missing.

**Alternatives rejected.** Codemodding `next.config` (comments/formatting/
ESM-CJS-TS variants are where scaffolders break trust). A framework-generic
`init` (extensibility comes from the layered API, not a speculative
multi-framework scaffolder). No scaffolder (leaves the README's pitch
untrue).

**Status.** Planned — 0.5 M3 (plan D5).

## ADR-042 — Studio component CSS is compiled at generate time (supersedes ADR-038's browser-runtime posture)

**Context.** ADR-038 shipped studio styling on public pages via the Tailwind
browser CDN runtime — a third-party script that compiles CSS after load:
FOUC, render-blocking, CDN dependency on production marketing pages, plus a
fragile per-route substring sniff deciding when to inject it.

**Decision.** `mdmx generate` scans `content/_components/*.json`, extracts
class lists (pure string work in `@mdmx/studio`), and compiles a static
`.mdmx/studio.css` via Tailwind's node API — a dependency of `@mdmx/cli`
only, never shipped to the app. The generated `server.ts` imports it, so it
rides the app's normal CSS pipeline with zero user steps. `mdmx dev` watches
`content/_components/`. For Tailwind-v4 hosts, delegation via an `@source`
line over an emitted class file is documented as an optimization. The CDN
runtime remains for the editor canvas (live editing genuinely needs
on-the-fly utilities) and as an explicit opt-in elsewhere. Staleness window:
in GitHub mode a just-created studio component's classes reach the deployed
CSS at the next deploy — the same window the definition itself already has
under ADR-035's request-time model; documented, not machinery.

**Alternatives rejected.** CDN-by-default with `tailwindSrc` pass-through
(the S25 §7-6 lean — honest but leaves the production defect in the default
path). Requiring the host to run Tailwind (breaks every non-Tailwind
consumer).

**Status.** Planned — 0.5 M3 (plan D7).

## ADR-043 — `@mdmx/project`: the project layer gets a package

**Context.** Project-config parsing existed twice and had already drifted:
`cli/config.ts` loads `mdmx.config.json` **or** `.mjs`; `next/api.ts`'s
private `ProjectConfigFile` reads JSON only — an `.mjs`-configured project
gets a working CLI and a runtime that silently ignores its collections.
ADR-039/040 add mode resolution, env handling, and registry-from-disk on top
of whichever home this logic gets. Core must stay platform-agnostic
(browser-consumed via the editor); the CLI must not depend on `@mdmx/next`.

**Decision.** A new package `@mdmx/project` — config schema + loader (json
and mjs), env/mode resolution, registry-from-disk — depending only on
`@mdmx/core` (types), consumed by cli, next, and dashboard. One schema, one
validator, one set of error messages. `@mdmx/next` re-exports the common
surface so most consumers never type the package name.

**Alternatives rejected.** A node-only subpath of core (changes core's
identity as the pure spec kernel). Living in `@mdmx/next` (the CLI would
depend on the framework runtime — inverted layering). Status quo (the drift
is the proof it needs an owner).

**Status.** Shipped — 0.5 M2b. `packages/project` (13 tests): `MDMXConfig`
schema + `loadConfig` (json **and** mjs), `mergeConfig`/`validateConfig`,
`parseProjectConfig` + `ProjectConfigFile` (the provider-read shape the
runtime uses, ADR-035), `resolveMode`/`insecureCookiesDefault` (ADR-039), and
`loadRegistry`/`loadRegistrySpec`. `@mdmx/cli` deleted its own `config.ts` and
`@mdmx/next` its private `ProjectConfigFile` — the json-vs-mjs drift that made
`.mjs` projects silently lose their collections at runtime is gone.

## ADR-044 — Provider contract v2: deletions in the change set, binary reads

**Context.** `ContentProvider.delete()` is a separate operation from
`commit()`, so any rename/move (slug change, cross-collection move, media
rename) is two commits and non-atomic — violating the invariant the
contract's own design notes name as the reason `commit` takes an array.
`read()` returns `string` while writes accept `Uint8Array` — asymmetric, and
provider-backed media reads have no typed path (the 1–100MB GitHub blob
truncation bug sits here). Phase 3 makes providers a public extension point;
contract changes are cheapest now, ecosystem breaks later.

**Decision.** Minimal revision in 0.5: `FileChange` becomes
`{ path, content } | { path, delete: true }` and standalone `delete()` is
removed — the contract shrinks to `list`/`read`/`commit` and gains atomic
rename/move for free. `read()` returns `content: Uint8Array | string`
(binary-capable); text call sites use a small helper. Nothing speculative
(no history, blame, branches, pagination) — features pull those in when
real. LocalProvider, GitHubProvider, and the in-memory fake update in
lockstep, per the existing invariant.

**Alternatives rejected.** Deferring until rename ships (by then GitLab/
third-party providers may exist; every change becomes an ecosystem break).
`readBinary()` sibling (keeps the asymmetry; pre-1.0 is when the honest
union is allowed). Adding capabilities speculatively (the contract's
smallness is its strength).

**Status.** Shipped — 0.5 M2a. `core/src/provider.ts`: `FileWrite | FileDelete`
union, `isFileDelete`, `read(path, {as})` plus typed `readText`/`readBytes`
helpers; standalone `delete()` removed. LocalProvider and GitHubProvider
updated in lockstep (+ the deferred §5-4 fix: GitHubProvider now falls back to
the Blob API when the Contents API answers `encoding: "none"` for 1–100MB
files, instead of silently returning empty content). Atomic rename is covered
by a test in both providers.

## ADR-045 — Component Studio becomes `@mdmx/studio` — model, renderer, and UI (supersedes ADR-038's placement and the S25 §7-1 lean)

**Context.** Studio landed without a seam: model + eject in core
(`studio.ts`, 462 lines, four jobs), untested routes in next, ~1,100
untested UI lines in dashboard; `{props.x}` interpolation defined three
times, the code-beats-studio merge rule twice, template→React twice — the
triplication exists precisely because core must stay React-free and so could
never host the one true renderer. The S25 lean was a core submodule,
"revisit if studio grows a real Tailwind build step" — which ADR-042 just
added.

**Decision.** A dedicated package, three entries:

- `@mdmx/studio` (deps: core only) — template model + path helpers, tag/attr
  allowlist validation, `studioComponentToSpec` + `mergeStudioSpecs`,
  `interpolate`, TSX eject codegen, class extraction.
- `@mdmx/studio/react` — the single template→React renderer;
  `@mdmx/next/render` and the dashboard preview both consume it.
- `@mdmx/studio/ui` — the builder screens (StudioEditorView split into
  PreviewTree/Inspector/PropRowEditor) shipping their own stylesheet chunk,
  wired through an injected **`StudioClient`** interface (load/save/eject/
  problems) that the dashboard's api-client implements — making the screens
  testable against a fake client.

Core never imports studio — the registry merge is performed by callers — so
the graph stays acyclic: `core ← studio ← cli, next, dashboard`. The
dashboard remains the composition point (`dashboard → studio/ui`, never the
reverse).

**Alternatives rejected.** `core/studio/` submodule (the S25 lean — cannot
host the React renderer, so the worst duplication survives; and the feature
is "mainly a component-builder thing" that will get messy without a hard
boundary). UI staying in dashboard (leaves the feature smeared across
packages; the `StudioClient` seam the move forces is exactly the missing
testability seam).

**Status.** Shipped (semantics) — 0.5 M2c. `packages/studio` (18 tests):
`model.ts` (types, path helper, `parseStudioComponent`), `validate.ts`
(allowlists + `validateStudioComponent`), `spec.ts` (`studioComponentToSpec`),
`merge.ts` (`mergeStudioSpecs` — the code-beats-studio rule, hoisted out of
`cli/check.ts` and `next/api.ts`), `eject.ts` (TSX codegen), `interpolate.ts`
(the one `{props.x}` implementation), and `@mdmx/studio/react` (the one
template→React renderer, now consumed by `@mdmx/next/render`). Core no longer
ships studio at all. The dashboard's private `interpolate` copy is gone; its
`PreviewTree` keeps its own traversal because click-to-select paths are a
genuinely different behaviour, not duplicated rendering. **Remaining:** the
builder screens move to `@mdmx/studio/ui` behind `StudioClient` (M4).

## ADR-046 — Auth is an injectable strategy beside the provider seam

**Context.** Storage is pluggable (`createProvider`); auth is not — the
GitHub OAuth flow, token verification, and push-permission check are
hard-called inside `api.ts`. A GitLab deployment reuses the provider seam
and hits this wall. `auth.ts`'s three functions are already the de-facto
interface.

**Decision.** Promote in 0.5: an `AuthStrategy` interface (begin-login →
callback-exchange → verify-access) with `GitHubOAuthStrategy` as the shipped
implementation, selected by ADR-039's mode detection; local mode's synthetic
session is the trivial second implementation. Ships with the api.ts route
split (routes/{entries,collections,studio,auth} + thin dispatcher) so the
restructuring happens once. Building an actual second OAuth strategy is
explicitly out of scope.

**Alternatives rejected.** Deferring to 0.6 (the interface freezes at
publish; a provider seam without an auth seam is half a plug for Phase 3's
GitLab goal).

**Status.** Planned — 0.5 M2 (plan D12).

## ADR-047 — Vocabulary: a *document* is any MDMX file; an *entry* is a document in a collection

**Context.** The dashboard UI and guides say "entry"; the HTTP route is
`GET /documents`; readers are `getDocuments`/`MDMXDocument`; neither term
was in the Glossary (S25 §3.6). The new Layer-1 helpers (ADR-040) were named
`getEntry`/`MDMXEntry`, forcing the collision.

**Decision.** Both words, as different concepts falling exactly on the
core/project layer boundary: **document** is the spec-level thing (core:
`parseDocument`, grammar, diagnostics); **entry** is a document belonging to
a collection — schema, status, slug (project, next, HTTP routes, dashboard,
guides). `GET /documents` → `GET /entries`; the Layer-2 readers rename to
entry vocabulary. Nothing is published yet, so the rename breaks nobody.
Glossary gains both terms with the relationship stated.

**Alternatives rejected.** "Document" in code / "entry" in UI (the S25 lean
— permanent split vocabulary, and it would rename the new Layer-1 surface
into the less accurate word). "Entry" everywhere (erases a real distinction
core legitimately needs).

**Status.** Planned — 0.5 M2 (plan D13).

## ADR-048 — Dashboard surface shrinks; the `export *` re-export is removed (amends ADR-034)

**Context.** `@mdmx/dashboard`'s root entry exports 15+ symbols with zero
consumers anywhere in the repo (and is incomplete for the composability it
implies); `@mdmx/dashboard/next` does `export * from "@mdmx/next"`, blanket
semver-coupling to a sibling's entire surface including internals slated for
deletion — while the flagship demo imports `@mdmx/next` directly,
contradicting the package's own headline.

**Decision.** Root entry shrinks to `DashboardApp` + config/types + theme
helpers; everything else internal (un-exporting after publish is breaking,
re-exporting later is free). The `export *` is deleted with no curated
replacement: ADR-034's "one package to import" onboarding motive is obsolete
now that `mdmx init nextjs` writes the mount files — users never type these
imports — so each scaffolded file imports from its honest home (`route.ts`
from `@mdmx/next`, `page.tsx` from `@mdmx/dashboard/next`).

**Alternatives rejected.** Finishing the composability surface (zero
demand; speculative API to maintain through the freeze). A curated re-export
(still couples release cadences for no consumer benefit post-scaffolder).

**Status.** Planned — 0.5 M2 (plan D14).
