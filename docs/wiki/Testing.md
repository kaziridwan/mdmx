# Testing

166 tests across five packages, all green. The suites aren't just coverage —
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
| React editor mounts; `contentDOM` lands in the component's render; live source matches | `editor-mount.test.ts` (jsdom) | editor |
| Prop-control value coercion (number/json/multiselect/empty→drop) | `prop-controls.test.ts` | editor |
| Canonical frontmatter YAML is a fixed point; field ordering; IMDX008/009 | `frontmatter.test.ts` | core |
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
