# scripts/

Convenience wrappers for the common multi-step workflows. POSIX `sh` (no
bashisms); each resolves the repo root itself, so run them from anywhere. They
are also wired as root package scripts (`pnpm <name>`).

| Script | `pnpm` alias | What it does |
| --- | --- | --- |
| `dev-next.sh` | `pnpm dev:next` | Build core/cli/editor/next, then start the local Next.js CMS (`examples/demo-next`). Override the port with `PORT=4000 pnpm dev:next`. |
| `dev-playground.sh` | `pnpm dev:playground` | Build core/cli/editor, generate the demo registry, then start the Vite editor playground. |
| `build.sh` | `pnpm build` | Build all packages (core first). |
| `generate.sh` | `pnpm generate` | Regenerate `.mdmx/registry.*` for every example app. |
| `test.sh` | `pnpm test` | Run all package test suites. |
| `check.sh` | `pnpm verify` | Typecheck everything, then run all tests (pre-push gate). |
| `clean.sh` | `pnpm clean` | Remove build artifacts (`dist/`, `.next/`, generated `.mdmx/`, tsbuildinfo). `--all` also wipes `node_modules`. |

## Quick start

```sh
pnpm install
pnpm dev:next        # → http://localhost:3000  (edit content, hit Save, git diff)
```
