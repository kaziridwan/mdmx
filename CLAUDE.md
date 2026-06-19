# CLAUDE.md

Read **AGENTS.md** (same directory) — it is the source of truth for working in
this repo: package map, build-order, conventions, the nine invariants, the
known sharp edges, and the **required wiki-upkeep checklist**.

## Documentation is part of "done" (do not skip)

After every session that changes code, behavior, or decisions, complete the
end-of-session checklist in `AGENTS.md` → "Wiki upkeep (required)" **before
reporting the work finished**:

1. Append a `docs/wiki/SessionLog.md` entry (newest at top).
2. Add an `ADR-NNN` to `docs/DECISIONS.md` for any architectural decision.
3. Sync the affected `docs/wiki/` pages (counts, status, modules, plans).
4. Update `SPEC.md` for any grammar/registry/diagnostic change.

A change that touches code but not the wiki is unfinished. State which pages
and ADRs you updated when you summarize your work.

## Quick reference

```sh
pnpm install && pnpm test      # builds @imdx/core first, then all suites
pnpm build                     # all packages
pnpm check                     # typecheck all packages
# single package after editing core: pnpm --filter @imdx/core build first
```

- Grammar/registry/provider spec: **SPEC.md**.
- Architecture, packages, invariants, roadmap, glossary, session history:
  **docs/wiki/** (start at `docs/wiki/Home.md`).
- The "why" behind every decision: **docs/DECISIONS.md**.
- Never alter canonical serialization options or round-trip tests to make a
  change pass — those failures mean the change is wrong.
