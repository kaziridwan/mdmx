# demo-next

A complete, runnable Next.js app that dogfoods the full MDMX loop **locally** —
no GitHub, no database. Your React components are first-class editor blocks, and
edits save as canonical MDMX straight into `content/` in this repo.

## What's wired

- **`app/api/mdmx/[...route]/route.ts`** — the content API from `@mdmx/next`
  (`createMDMXHandlers`) mounted at `/api/mdmx/*`, in **`localMode`** (synthetic
  session, no OAuth) backed by `LocalProvider` (writes to the working tree).
  Validation, path-safety, CSRF-origin, and conflict checks still apply.
- **`app/page.tsx`** — document list (server component; reads `content/` via
  `getDocuments`).
- **`app/edit/[...slug]/page.tsx`** — editor mount. The server reads the file
  (content + blob sha); the client `EditorClient` renders `@mdmx/editor/react`'s
  `MDMXEditor` and saves via `PUT /api/mdmx/file` with `expectedSha` for
  conflict safety, refreshing the sha after each save.
- **`lib/mdmx-config.ts`** — shared content/registry config. **`lib/components.ts`**
  — the author component map for live rendering.

## Run it

From the repo root, build the packages the app depends on, then start it:

```sh
pnpm install
pnpm --filter @mdmx/core build
pnpm --filter @mdmx/cli build
pnpm --filter @mdmx/editor build
pnpm --filter @mdmx/next build

pnpm --filter demo-next dev      # runs `mdmx generate` then `next dev`
```

Open http://localhost:3000, click a document, edit it (type, `/` for the slash
menu, drag components from the rail, edit props in the right panel, watch the
canonical MDMX update live on the right), and hit **Save**. The change is written
to `content/posts/*.mdx` — `git diff` to see the minimal, canonical diff.

> `predev`/`prebuild` run `mdmx generate` to (re)build `.mdmx/registry.json` from
> `components/mdmx/**`. Add or change a component → it appears in the palette on
> the next start.

## Going to production (GitHub mode)

`localMode` is for local authoring. For a deployed CMS, drop `localMode`, supply
`auth` (GitHub OAuth app) + `sessionSecret`, and a `createProvider` that returns
`GitHubProvider` — see `@mdmx/next` and `docs/wiki/Architecture.md`.
