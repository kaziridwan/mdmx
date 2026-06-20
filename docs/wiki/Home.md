# iMDX Wiki

The living documentation hub for iMDX. **Agents must keep this current** — see
[Maintenance](#maintenance) below and the upkeep rule in `AGENTS.md`.

## What is iMDX

A git-native CMS toolkit for Next.js built around **iMDX** — a strict,
round-trippable subset of MDX where the user's own React components are
first-class blocks in a Notion-style editor. Content is committed to the
user's GitHub repo; a codegen step turns their components into a typed
registry that drives validation, the editor palette, and prop panels.

## Map of the docs

| Doc | What it covers |
| --- | --- |
| [Architecture](Architecture.md) | The five packages, the data-flow pipeline, how they fit |
| [Packages](Packages.md) | Per-package reference: exports, responsibilities, test counts |
| [Invariants](Invariants.md) | The nine rules that must never break, and why |
| [Glossary](Glossary.md) | Terms: iMDX, registry, control, children policy, raw node, … |
| [Roadmap](Roadmap.md) | Done / in-progress / next, by phase |
| [TwoColumn](TwoColumn.md) | The concrete plan for nested editing (next big feature) |
| [Testing](Testing.md) | How the suites are organized and the guarantees they lock |
| [Session Log](SessionLog.md) | Chronological record of what each work session changed |
| `../DECISIONS.md` | Architecture Decision Record — the "why" behind every choice |
| `../../SPEC.md` | Normative iMDX v1 grammar, canonical form, registry schema |
| `../../AGENTS.md` | Agent operating guide (commands, conventions, invariants) |

## Status at a glance

- **5 packages**, 185 tests, all green; strict TypeScript throughout.
- The **entire headless pipeline** is implemented and tested: define a
  component → generate a typed registry → edit as a validated block document
  → serialize to canonical iMDX → commit atomically with conflict safety →
  read back at build time.
- The **flat React editor UI** is built (`@imdx/editor/react`): React NodeViews
  over the existing schema/converters (raw ProseMirror, ADR-023), rail palette,
  slash menu, prop panel, the signature live-source pane, and a save toolbar.
- A **runnable local Next.js app** (`examples/demo-next`) dogfoods the full
  loop: list → edit → save canonical iMDX to disk, conflict-safe, no GitHub
  needed (`localMode`, ADR-024).
- **Collections & draft/publish** (ADR-025): typed frontmatter defined in config,
  validated (IMDX008/009), edited via the editor's frontmatter panel (canonical
  YAML). Next: nested editing (TwoColumn), media library UI.

See [Roadmap](Roadmap.md) for the detailed breakdown.

## Maintenance

This wiki is not write-once. After every work session, the agent updates the
affected pages and appends an entry to [Session Log](SessionLog.md). The
mechanism is specced in `AGENTS.md` → "Wiki upkeep (required)". If you changed
code and didn't touch the wiki, the session isn't done.
