# demo-next

A complete, runnable Next.js app that dogfoods the drop-in MDMX CMS **locally**
— no GitHub, no database. It is exactly what a consumer builds: the two-file
dashboard mount, the author components, and the content. Everything else comes
from `@mdmx/dashboard`.

## The whole integration

**File 1 — the dashboard page** (`app/mdmx/[[...slug]]/page.tsx`):

```tsx
import { createDashboardPage } from "@mdmx/dashboard/next";
import { components } from "../../../lib/components";

export default createDashboardPage({ components });
export const dynamic = "force-dynamic";
```

**File 2 — the content API** (`app/api/mdmx/[...route]/route.ts`):

```tsx
import { createMDMXHandlers, LocalProvider } from "@mdmx/next";
// (also re-exported from @mdmx/dashboard/next)

export const { GET, POST, PUT, DELETE } = createMDMXHandlers({ ... });
export const dynamic = "force-dynamic";
```

That's the app. The dashboard at [/mdmx](http://localhost:3000/mdmx) gives you:

- collections overview + **create collections** (writes `mdmx.config.json`
  through the same commit pipeline as content — live without a regenerate)
- entry tables with status badges, filtering, and delete
- new-entry scaffolding (title → slug → valid canonical frontmatter)
- the full **block editor** with your components rendered live, prop panels,
  slash menu, media uploads, and conflict-safe saves
- a media library, settings (incl. light/dark pin), and ⌘K quick-open

What this app supplies:

- **`components/mdmx/*.tsx`** — the author components (`defineMDMX`), plus
  their styles in `app/globals.css` (`mk-*`)
- **`lib/components.ts`** — the client component map for live rendering
- **`lib/mdmx-config.ts`** — shared server config for the API route
- **`content/`** + **`mdmx.config.json`** — the content and its collections
- `predev`/`prebuild` run `mdmx generate` to bake `.mdmx/registry.*` from the
  components; add or change a component → it's in the palette on next start

## Run it

From the repo root:

```sh
pnpm install
pnpm dev:next        # builds deps, runs mdmx generate, starts next dev
```

Open http://localhost:3000 (redirects to `/mdmx`). Edits save as canonical
MDMX into `content/` — `git diff` shows the minimal, one-line-per-edit diffs.

> localMode: the API runs a synthetic "local" session (no OAuth) and
> `LocalProvider` writes to the working tree. Validation, path-safety,
> CSRF-origin, and conflict checks still apply.

## Going to production (GitHub mode)

Drop `localMode`, supply `auth` (GitHub OAuth app) + `sessionSecret`, and a
`createProvider` returning `GitHubProvider` — see
`docs/guides/next-js/06-production-github.md`. Collaborators with push access
log in with GitHub; every save becomes an atomic commit authored by them.
