# Project status

This file is a pointer. The living status of the MDMX monorepo is kept in
the wiki, which every work session updates:

- **[docs/wiki/Home.md](docs/wiki/Home.md)** — status at a glance (version,
  packages, test count, what shipped last).
- **[docs/wiki/Roadmap.md](docs/wiki/Roadmap.md)** — done / in progress /
  next, by phase and release milestone.
- **[docs/wiki/Packages.md](docs/wiki/Packages.md)** — per-package reference
  and test counts.
- **[docs/wiki/SessionLog.md](docs/wiki/SessionLog.md)** — what each session
  changed, newest first.
- **[docs/releases/](docs/releases/)** — release notes; **RELEASING.md** —
  the publish checklist.

Run it: `pnpm install && pnpm dev:next` (the demo app on `:3000`, dashboard
at `/mdmx`); `pnpm verify` is the pre-push gate.
