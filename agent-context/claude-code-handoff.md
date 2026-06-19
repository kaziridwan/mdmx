# Claude Code Handoff

Start-here briefing for an agent taking over iMDX in Claude Code. Read this
first, then `AGENTS.md`, then `docs/wiki/Home.md`. Budget five minutes for
orientation before writing code.

## What you're inheriting

**iMDX** is a git-native CMS toolkit for Next.js. Core idea: a strict,
round-trippable subset of MDX ("iMDX") where the user's own React components
are first-class blocks in a Notion-style editor. Content is committed to the
user's GitHub repo; a codegen step turns their components into a typed registry
that drives validation, the editor palette, and prop panels.

It's a TypeScript, ESM, npm-workspaces monorepo with five packages. The entire
**headless pipeline is built and tested** (86 tests, all green). What remains is
chiefly the **React editor UI** and its wiring.

One-line framing of the product: *a typed, git-native block editor where your
own React components are first-class blocks.*

## Orient yourself (in this order)

1. `AGENTS.md` — operating guide: package map, build order, conventions, the
   nine invariants, sharp edges, and the **wiki-upkeep rule** you must follow.
2. `docs/wiki/Home.md` — the documentation hub; branch out from there.
3. `docs/DECISIONS.md` — the "why" behind every architectural choice
   (the ADR log). Read before proposing changes to settled designs.
4. `SPEC.md` — the normative iMDX grammar and registry schema.

## Get it running

```sh
pnpm install
pnpm test        # builds @imdx/core first, then all suites — expect 86 passing
pnpm build       # all packages
pnpm check       # typecheck all packages

# see the CLI pipeline end-to-end:
pnpm build
cd examples/demo
node ../../packages/cli/dist/bin.js generate   # → .imdx/registry.{json,ts}
node ../../packages/cli/dist/bin.js check       # lints content/ against it
```

Open `examples/editor-prototype.html` in a browser to use the editor UI
(registry palette, block editing, prop panel with live renders, live canonical
source pane, drag-and-drop, delete). This prototype is the **behavioral spec**
for the real editor — it is not production code.

## Where things stand

| Layer | State |
| --- | --- |
| `@imdx/core` (format) | ✅ done, 27 tests |
| `@imdx/cli` (codegen + lint) | ✅ done, 10 tests |
| `@imdx/editor` (schema + converters + commands) | ✅ headless done, 15 tests; **React UI pending** |
| `@imdx/next` (providers, sessions, OAuth, API) | ✅ server done, 27 tests; **mount page pending** |
| `@imdx/provider-github` | ✅ done, 7 tests |

Full breakdown: `docs/wiki/Roadmap.md`.

## The recommended next milestone

Port the prototype into `@imdx/editor` as **React NodeViews** (TipTap) over the
existing, already-tested schema and converters — then build **TwoColumn** as
the first nested component. The headless layers already handle nesting; the
remaining work is NodeViews with `contentDOM`-placed editable regions and
nested drop targets. The concrete plan is in `docs/wiki/TwoColumn.md`
(and the decision to build it in the real editor, not the prototype, is
ADR-021).

After that: the editor mount page in `@imdx/next` (a catch-all App Router route
wiring the editor to the API handlers), then turn `examples/demo` into a
runnable Next.js app to dogfood the full loop.

## Rules that will save you grief

These are non-negotiable; details and rationale in `AGENTS.md` /
`docs/wiki/Invariants.md`:

- **Don't change canonical serialization options or round-trip tests to make a
  change pass.** Those failures mean your change is wrong (or it's a deliberate
  semver-major decision needing a new ADR).
- **Props are JSON** — enforced on both the content and config sides; change
  them together.
- **Path safety is two layers** (`assertSafePath` + root containment); any new
  provider or route keeps both.
- **core stays dependency-light** (no React); dependents import core, never the
  reverse.
- **Build order**: after editing `@imdx/core`, rebuild it before running a
  single dependent package's tests (`pnpm --filter @imdx/core build`). The root
  scripts already do this for you.
- **`return await` in `next/src/api.ts`** is intentional — don't simplify it.
- ESM `.js` import suffixes even from `.ts`; the container shell is `dash`
  (no brace-expansion globs).

## Finish every session by updating the docs

Documentation is part of "done". Before you report work complete, run the
end-of-session checklist in `AGENTS.md` → "Wiki upkeep (required)":

1. Append an entry to `docs/wiki/SessionLog.md` (newest at top).
2. Add an `ADR-NNN` to `docs/DECISIONS.md` for any architectural decision.
3. Sync the affected wiki pages (test counts, roadmap status, module tables).
4. Update `SPEC.md` for any grammar/registry/diagnostic change.

State explicitly which wiki pages and ADRs you touched when you summarize. A
change that touches code but not the wiki is unfinished.

## Handy pointers

- Tests are the spec: `docs/wiki/Testing.md` lists the load-bearing ones.
- Glossary for unfamiliar terms: `docs/wiki/Glossary.md`.
- Editor aesthetic direction: `packages/editor/DESIGN_NOTES.txt`.
- The git history (12+ commits) narrates the build in order, with detailed
  commit messages — `git log` is a usable design document here.
