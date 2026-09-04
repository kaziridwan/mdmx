# MDMX Wiki

The living documentation hub for MDMX. **Agents must keep this current** — see
[Maintenance](#maintenance) below and the upkeep rule in `AGENTS.md`.

## What is MDMX

A git-native CMS toolkit for Next.js built around **MDMX** — a strict,
round-trippable subset of MDX where the user's own React components are
first-class blocks in a Notion-style editor. Content is committed to the
user's GitHub repo; a codegen step turns their components into a typed
registry that drives validation, the editor palette, and prop panels.

## Map of the docs

| Doc | What it covers |
| --- | --- |
| [Next.js integration guides](../guides/next-js/README.md) | Consumer-facing, step-by-step: install → components/registry → content API → editor → rendering → GitHub mode → troubleshooting |
| [Architecture](Architecture.md) | The eight packages, the data-flow pipeline, how they fit |
| [Packages](Packages.md) | Per-package reference: exports, responsibilities, test counts |
| [Invariants](Invariants.md) | The rules that must never break, and why |
| [Glossary](Glossary.md) | Terms: MDMX, registry, control, children policy, raw node, … |
| [Roadmap](Roadmap.md) | Done / in-progress / next, by phase |
| [TwoColumn](TwoColumn.md) | The nested-editing implementation (shipped in 0.4) |
| [Testing](Testing.md) | How the suites are organized and the guarantees they lock |
| [Session Log](SessionLog.md) | Chronological record of what each work session changed |
| `../DECISIONS.md` | Architecture Decision Record — the "why" behind every choice |
| `../../SPEC.md` | Normative MDMX v1 grammar, canonical form, registry schema |
| `../../AGENTS.md` | Agent operating guide (commands, conventions, invariants) |

## Status at a glance

- **8 packages** at **v0.7.0** on `release/0.7.0`, MIT, prepared for the
  first npm publish (RELEASING.md; 0.6.0 was prepared but never published —
  its work ships in 0.7.0; see
  [Roadmap](Roadmap.md#phase-29--070-editing-ux--two-way-source-component-editing-blocks-that-insert-usable)).
  489 tests, all green; strict TypeScript throughout; Next 16 (Turbopack) +
  React 19.2; demo-next is a Tailwind v4 + shadcn app with 39 author blocks,
  22 of them shadcn components, all inserting usable (0.7 M5), and the
  dashboard stylesheet is host-independent (ADR-049).
- **The editor edits both ways (0.7)**: the source pane is a CodeMirror 6
  editor whose text applies to the canvas live through the load path
  (ADR-059); the prop panel follows the caret into nested blocks with real
  `list`/`object` controls, effective defaults, and `showIf` (ADR-058);
  blocks move, duplicate, and delete from a toolbar or the keyboard;
  registry v3 seeds every insert from `preview` (ADR-057); the dashboard
  nav collapses (ADR-056). Canvas interaction does not write props back —
  ADR-060 records the 0.8 candidate.
- **Setup is convention-first (0.5)**: `mdmx init nextjs` scaffolds the app,
  `createMDMXHandlers()` takes no arguments, and `mdmx generate` writes the
  component maps and bound server helpers into a committed `.mdmx/`. Mode is
  detected from the environment and fails closed in production (ADR-039–042).
- The **entire pipeline** is implemented and tested: define a component →
  generate a typed registry → edit as a validated block document → serialize
  to canonical MDMX → commit atomically with conflict safety → render at build
  time.
- **Two seams make it extensible**: `ContentProvider` (v2 — deletions in the
  change set, binary reads, atomic rename) and `AuthStrategy` (begin/complete/
  verify), so another git host plugs in without touching the routes.
- **The drop-in dashboard** (`@mdmx/dashboard`, ADR-034): two mount files give
  the full CMS at `/mdmx` — auth gate, collections + entry tables, new-entry
  scaffolding, the embedded block editor, collection field editing, media
  library, settings, ⌘K quick-open, and the Component Studio.
- **Component Studio** lives in its own package (`@mdmx/studio`, ADR-045):
  build template components in the browser, render them through one shared
  renderer, eject to real `defineMDMX` TSX when they settle. Their CSS is
  compiled at build time (ADR-042) — no browser Tailwind runtime on public
  pages.

See [Roadmap](Roadmap.md) for the detailed breakdown.

## Maintenance

This wiki is not write-once. After every work session, the agent updates the
affected pages and appends an entry to [Session Log](SessionLog.md). The
mechanism is specced in `AGENTS.md` → "Wiki upkeep (required)". If you changed
code and didn't touch the wiki, the session isn't done.
