# Invariants

Nine rules that must never break. Each maps to an ADR (the "why") and a
location (the "where"). If a change would violate one, it's the wrong change —
or it's a deliberate semver-major decision that needs a new ADR.

| # | Invariant | Where | ADR |
| --- | --- | --- | --- |
| 1 | **Canonical serialization is a versioned contract.** The pinned stringify/mdx options, `printPropValue`, and `CANONICAL_YAML_OPTIONS` (edited frontmatter) define byte-level output. Changing them dirties every user's repo → semver-major, never a refactor. remark/yaml deps pinned with `~`. | `core/serialize.ts`, `core/frontmatter.ts`, `editor/to-mdast.ts` | 003, 025 |
| 2 | **Props are JSON.** Only literals/arrays/plain-objects/unary-minus. Enforced on both the content side and the defineMDMX-config side; they change together. | `core/props.ts`, `cli/static-eval.ts` | 002 |
| 3 | **Round-trip guarantees hold.** `toMDX(parseMDX(x))` is a fixed point; text→mdast→PM→mdast→text is byte-identical for canonical input; editing one prop changes one line; raw nodes re-emit verbatim. If a test for these fails, fix the code, not the test. | `core/tests`, `editor/tests/convert.test.ts` | 003, 004 |
| 4 | **Diagnostic codes are stable API.** MDMX001–009 meanings are fixed (008/009 = frontmatter). Add codes; never repurpose. | `core/types.ts`, `core/validate.ts`, `core/frontmatter.ts` | 005, 025 |
| 5 | **Mark priority is fixed:** link → strong → em → strike → code. Links never split; code is innermost. | `editor/schema.ts` (`MARK_PRIORITY`) | 012 |
| 6 | **One `props` attr per component node.** A prop edit is a single transaction (undo/collab depend on it). | `editor/schema.ts` | 011 |
| 7 | **Path safety is two layers.** `assertSafePath` + resolved-root containment, plus prefix confinement in the API. Any new provider/route keeps both. | `core/provider.ts`, both providers, `next/api.ts` | 016 |
| 8 | **Conflict semantics match across providers.** `read()` returns git blob shas; `commit()` verifies `expectedShas` (`null`=must-not-exist) → `ConflictError`. Local mirrors GitHub exactly. | both providers | 015 |
| 9 | **core stays dependency-light.** No React, no Node-only runtime deps (provider types are type-only). Dependents import core, never the reverse; no sibling cross-deps. | `core/*` | 014 |

## Operational gotchas (not invariants, but bite)

- **Build order.** Dependents resolve `@mdmx/core` through its built `dist/`.
  Root `pnpm test`/`build`/`check` build core first, so a clean
  `pnpm install && pnpm test` works. Running a single dependent's vitest
  directly after editing core requires `pnpm --filter @mdmx/core build` first.
- **`return await` in api.ts.** Async sub-handlers are awaited inside the try
  block on purpose; `return promise` would skip the route-level error mapping.
  Don't "simplify" it.
- **ESM `.js` suffixes.** Relative imports use `.js` even from `.ts` files
  (`module: NodeNext`).
- **dash shell.** The container shell has no brace expansion; don't use
  `{a,b}` globs in scripts.
- **MDX whitespace in JSX children.** Indented markdown can parse as code
  blocks; rich-text children are modeled as `paragraph*` to handle this.
