# Glossary

**MDMX** — "interactive MDX". A strict, round-trippable subset of MDX:
CommonMark + a GFM slice, block-level JSX for registered components only,
props-as-JSON, no imports/expressions/raw-HTML/inline-JSX. Defined normatively
in `SPEC.md`.

**Document** — any MDMX file: frontmatter plus a body in the MDMX subset.
Documents are `@mdmx/core`'s concern — parsing, the grammar, diagnostics — and
a document need not belong to a collection.

**Entry** — a document that belongs to a collection, so it has a slug, a
frontmatter schema, and (usually) a status. Everything above the collection
line speaks in entries: `@mdmx/project`, `@mdmx/next`'s readers
(`getEntries`/`getEntryBySlug`), the `GET /entries` route, the dashboard, and
the guides. Every entry is a document; not every document is an entry
(ADR-047).

**Registry** — the generated catalog of editable components. Two artifacts:
`registry.json` (pure data) and `registry.ts` (binds real components).
Produced by `mdmx generate`. Drives validation, the editor palette, prop
panels, and the production render.

**defineMDMX** — the authoring wrapper: `defineMDMX(Component, config)`. Tags
a component with MDMX metadata; the CLI reads it statically.

**ComponentSpec** — one component's entry in the registry: name, category,
icon, children policy, props (each with a control), constraints, render mode.

**Control** — how a prop is edited in the panel. The taxonomy: text, textarea,
number, boolean, select, multiselect, color, date, image, link, json, list,
object. Inferred from TS types, overridable in config.

**Children policy** — what a component may contain: `none` (atom/self-closing),
`rich-text` (paragraphs of phrasing only), `blocks` (any MDMX flow,
recursively).

**Slot constraints** — `allowedParents` / `allowedChildren` on a ComponentSpec.
Compile to ProseMirror content expressions so illegal nesting is impossible by
construction (e.g. `Column` only inside `TwoColumn`).

**Canonical form** — the single, byte-stable serialization every tree has.
Editors always emit it; hand-written files normalize on first save. Changing
it is semver-major.

**Raw node (`mdmx_raw`)** — the escape hatch. Out-of-subset content becomes an
opaque read-only block storing the exact source slice, re-emitted verbatim.

**Diagnostic** — `{code, severity, message, span}`. Codes MDMX001–010 (see
SPEC.md §4) are stable API.

**mdast** — the markdown AST (from remark). The interchange hub: text and
ProseMirror both convert to/from mdast, never to each other directly.

**ProseMirror doc** — the editor's in-memory document. The schema is generated
from the registry. Component props live in a single `props` node attribute.

**ContentProvider** — the storage interface (`list/read/commit/delete`).
`commit` is atomic over multiple files. Implementations: `GitHubProvider`,
`LocalProvider`.

**expectedShas** — optimistic-concurrency tokens: git blob shas a caller
loaded, verified at commit time. `null` means "must not exist yet". Mismatch →
`ConflictError`.

**Render mode** — how the editor renders a component: `live` (call the real
component), `placeholder` (labeled card; for server-only/heavy components),
`static` (render once, freeze).

**Collection** — a content grouping with typed frontmatter (e.g. `posts`,
`pages`), authored in `mdmx.config.json` and emitted into the registry. Drives
frontmatter validation (MDMX008/009) and the editor's document panel. A path
resolves to a collection by longest `dir` prefix. (ADR-025)

**Canonical frontmatter** — when frontmatter is edited through the panel it is
re-emitted as canonical YAML (`stringifyFrontmatter`, pinned
`CANONICAL_YAML_OPTIONS`): known collection fields first, then the rest;
untouched frontmatter still round-trips verbatim.

**Draft/publish** — modeled as a `status` frontmatter field (`select` over
`draft`/`published`). Readers filter by it; the demo groups its list by it.
