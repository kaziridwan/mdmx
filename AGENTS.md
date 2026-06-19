# AGENTS.md — context for AI coding agents

This file is the source of truth for agents working in this repository.
`CLAUDE.md` points here. Read this fully before making changes.

## What this project is

**iMDX** is a git-native CMS for Next.js built around a strict, round-trippable
subset of MDX ("iMDX") where the user's own React components are first-class
editor blocks. Content lives as `.mdx` files in the user's repo; the editor is
a Notion-style block editor; a codegen step turns the user's components into a
typed registry that drives validation, the editor palette, and prop panels.

Full grammar/registry specification: **SPEC.md**. Architecture rationale is in
the package READMEs and commit messages.

## Package map (pnpm workspaces, all ESM)

| Package | Path | Status | Contents |
| --- | --- | --- | --- |
| `@imdx/core` | `packages/core` | done | Parser (`parseMDX`/`parseDocument`), validator (`validateTree`, codes IMDX001–009), canonical serializer (`toMDX`), `Registry`, `defineIMDX`, provider contract (`ContentProvider`, `ConflictError`, `assertSafePath`). Zero React/Next deps — keep it that way. |
| `@imdx/cli` | `packages/cli` | done | `imdx generate` (TS compiler API extraction → `.imdx/registry.json` + `.imdx/registry.ts`), `imdx check` (content lint), and `imdx dev` (watch components/config → debounced, hash-diffed regenerate; ADR-026). |
| `@imdx/editor` | `packages/editor` | done | `buildSchema(registry)` (registry → ProseMirror schema), `fromMdast`/`toMdast` converters, mark canonicalization, `imdx_raw` fallback, `printPropValue`. React editor under `@imdx/editor/react` — React NodeViews on **raw ProseMirror** (ADR-023, supersedes ADR-019's TipTap), rail/slash menu/prop panel/live-source pane, nested editing (TwoColumn, ADR-021), and a media library (`MediaSource` adapter + `MediaLibrary`, ADR-027). Main entry stays React-free. Drop-indicator polish pending. |
| `@imdx/next` | `packages/next` | done | `LocalProvider`, content readers, sealed sessions (`session.ts`), GitHub OAuth + push-permission authz (`auth.ts`), `createIMDXHandlers` content/media API (`api.ts`) with an opt-in `localMode` (no OAuth; ADR-024). The editor mount page + a runnable app are in `examples/demo-next`. |
| `@imdx/provider-github` | `packages/provider-github` | done | `GitHubProvider` over the Git Data API: atomic multi-file commits (blobs→tree→commit→ref), optimistic concurrency, fast-forward-only ref updates. Tested against `tests/fake-github.ts`. |

`examples/demo` is a miniature consumer project used for end-to-end CLI runs.

## Commands

```sh
pnpm install                # root; links workspaces
pnpm test                   # all packages (vitest)
pnpm build                  # all packages (tsc)
cd packages/<name> && pnpm exec vitest run   # one package

# convenience wrappers (scripts/, POSIX sh) — see scripts/README.md
pnpm dev:next               # build deps + run examples/demo-next (local CMS)
pnpm dev:playground         # build deps + run the Vite editor playground
pnpm generate               # regenerate .imdx/registry.* for example apps
pnpm verify                 # typecheck + test
pnpm clean                  # remove build artifacts (--all wipes node_modules)
```

**Build-order:** dependent packages resolve `@imdx/core` through its built
`dist/`. The root `pnpm test`, `pnpm build`, and `pnpm check` scripts all
build core first, so a clean `pnpm install && pnpm test` works. If you run a
single dependent package's vitest directly (`cd packages/editor && pnpm exec vitest`)
after editing core, rebuild core first (`pnpm --filter @imdx/core build`) or you'll
see phantom "has no exported member" errors.

## Conventions

- ESM throughout; `module: NodeNext`. Relative imports **must** use the `.js`
  suffix (`import x from "./types.js"`), even from `.ts` files.
- Internal `@imdx/*` deps use the **`workspace:*`** protocol, never a plain
  version. pnpm 10 won't reliably link plain-versioned siblings, so a plain
  `"@imdx/x": "0.1.0"` makes `pnpm install` try (and fail) to fetch it from npm.
- Strict TS, `noUncheckedIndexedAccess` is on — index access yields `T | undefined`.
- Tests live in `packages/*/tests`, fixtures under `tests/fixtures`.
- Generated artifacts go to `.imdx/` (gitignored).
- The container shell is `dash`: **no brace expansion** in scripts.

## Invariants — do not break these

1. **Canonical serialization is part of the public contract.** The pinned
   options in `packages/core/src/serialize.ts` (`CANONICAL_STRINGIFY_OPTIONS`,
   `CANONICAL_MDX_OPTIONS`) and `printPropValue` in
   `packages/editor/src/to-mdast.ts` define the byte-level output format.
   Changing any of them dirties every user's repo on next save → treat as
   **semver-major**, never as a refactor. The remark/mdast dependency versions
   are pinned with `~` for the same reason.
2. **Props are JSON.** Component props in content may only be string/number/
   boolean/null literals, arrays, plain objects, and unary minus. Enforced in
   `packages/core/src/props.ts` (content side) and
   `packages/cli/src/static-eval.ts` (config side). Do not loosen either
   without updating SPEC.md and both validators symmetrically.
3. **Round-trip guarantees.** These tests are the project's soul; if one fails,
   fix the code, not the test:
   - `toMDX(parseMDX(x))` is a fixed point (core `roundtrip.test.ts`)
   - text → mdast → ProseMirror → mdast → text is byte-identical for canonical
     input (editor `convert.test.ts`)
   - editing one prop changes exactly one output line (both suites)
   - `imdx_raw` regions serialize back **verbatim**
4. **Diagnostic codes are stable API.** IMDX001–009 meanings are fixed (008/009 = frontmatter) (see
   SPEC.md). Add new codes; never repurpose existing ones.
5. **Mark priority** (`MARK_PRIORITY` in `packages/editor/src/schema.ts`):
   link outermost (links must never split), `code` innermost (mdast
   `inlineCode` is a leaf). Changing the order breaks canonicalization.
6. **One `props` attr per component node** in the ProseMirror schema — a prop
   edit must be a single transaction (undo/collab semantics depend on it).
7. **Path safety.** Every provider path goes through `assertSafePath` AND a
   resolved-root containment check. A git-backed CMS is one
   `../.github/workflows/x.yml` away from owning someone's CI. Any new
   provider or API route must keep both layers.
8. **Conflict semantics.** `read()` returns git blob shas; `commit()` verifies
   `expectedShas` (with `null` = must-not-exist) and throws `ConflictError` on
   mismatch. `LocalProvider` intentionally mirrors `GitHubProvider` here — it
   is the reference implementation. Keep them in lockstep.
9. **`@imdx/core` stays dependency-light** (no React, no Node-only APIs except
   in provider *types*, which are type-only). The CLI/editor/next layers
   depend on core, never the reverse; no cross-dependencies between siblings
   except via core.

## When adding features

- New grammar surface → update `SPEC.md`, the validator whitelist, the
  serializer fixtures, and add a kitchen-sink fixture line in **both** core
  and editor test fixtures.
- New component capability → extend `ComponentSpec` in
  `packages/core/src/types.ts`, the CLI extraction/merge, the schema
  generation, and SPEC.md, in that order.
- New provider → implement `ContentProvider`, reuse the conflict/path tests as
  a checklist (`packages/next/tests` and `packages/provider-github/tests`).
- UI work (pending editor chrome) targets a Notion/Obsidian/Claude feel:
  slash menu, drag handles, markdown input rules, right-sidebar prop panel,
  error boundaries that downgrade live component renders to placeholder cards.

## Known sharp edges

- In `packages/next/src/api.ts`, async sub-handlers are `return await`-ed
  inside the try block **on purpose** — `return promise` would skip the
  route-level error mapping (409/400/401/404). Keep the `await`.

- MDX whitespace inside JSX children: indented markdown can parse as code
  blocks; rich-text children are modeled as `paragraph*` for this reason.
- Inline (text-level) JSX is deliberately **not** in iMDX v1 (IMDX003).
- `remark-stringify` minor bumps can change output bytes — see invariant 1.
- `strong` wrapping an entire `link` re-nests as link>strong once
  (canonicalization); idempotent thereafter. Covered by a test; don't "fix" it.

## Wiki upkeep (required)

The repository documents itself as it grows. Documentation is part of "done",
not an afterthought. Every work session — every meaningful prompt that changes
code, behavior, or decisions — finishes with a documentation pass **before**
reporting the work complete.

The living docs are:
- `docs/wiki/` — Home, Architecture, Packages, Invariants, Glossary, Roadmap,
  TwoColumn, Testing, **SessionLog**.
- `docs/DECISIONS.md` — the Architecture Decision Record (ADR-NNN).
- `SPEC.md` — normative format spec (update on any grammar/registry change).

### The end-of-session checklist (do this every time)

1. **Append a Session Log entry.** Add one entry to the top of
   `docs/wiki/SessionLog.md` (above the marker), using the template at the
   bottom of that file: summary, files/packages changed, ADRs added/updated,
   test count delta, wiki pages touched, follow-ups.
2. **Record decisions.** If you made an architectural choice (a trade-off, a
   new pattern, a rejected alternative), append an `ADR-NNN` to
   `docs/DECISIONS.md`. Never edit a past ADR's meaning — supersede it with a
   new entry that references the old one.
3. **Sync the affected wiki pages.** Update whichever pages your change
   touched: test counts and module tables in `Packages.md`; status in
   `Roadmap.md`; a new rule in `Invariants.md`; a new term in `Glossary.md`;
   the plan in `TwoColumn.md` if you advanced nested editing; pipeline/diagram
   in `Architecture.md` if seams moved.
4. **Update SPEC.md** if the grammar, canonical form, registry schema, or
   diagnostics changed. This is normative — keep it exact.
5. **Keep counts honest.** If you added/removed tests, update the numbers in
   `Packages.md`, `Testing.md`, `Roadmap.md`, and `wiki/Home.md`.

A change that touches code but not the wiki is an unfinished change. When
summarizing your work to the user, state explicitly which wiki pages and ADRs
you updated.

### Scope discipline

Keep doc edits proportional: a one-line bug fix gets a one-line Session Log
entry and nothing more; a new package or a format change ripples through
several pages plus an ADR plus SPEC.md. Don't pad — but don't skip.
