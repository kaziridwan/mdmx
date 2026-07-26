# 1 · Installation & project setup

## The short version

```sh
pnpm add @mdmx/core @mdmx/project @mdmx/studio @mdmx/next @mdmx/editor @mdmx/dashboard
pnpm add -D @mdmx/cli

pnpm mdmx init nextjs
# paste the printed transpilePackages snippet into next.config.mjs
pnpm dev
```

Open `http://localhost:3000/mdmx`. The rest of this page explains what those
three commands did, so you can change any of it.

Inside this monorepo, apps consume the packages via the workspace protocol
(`"@mdmx/core": "workspace:*"`, and so on). `@mdmx/provider-github` is only
needed for [GitHub mode](06-production-github.md) — and even then it's an
optional peer that the runtime imports for you.

## What `mdmx init nextjs` writes

The command creates files and never overwrites them, so it is safe to re-run:

```
your-app/
├── mdmx.config.json                  # components glob, dirs, collections, repo
├── components/mdmx/Callout.tsx       # a starter block component
├── content/posts/hello.mdx           # a starter entry
└── app/
    ├── api/mdmx/[...route]/route.ts  # the content/media API
    └── mdmx/[[...slug]]/page.tsx     # the dashboard
```

It also adds `generate`, `predev`, and `prebuild` scripts to `package.json`
(all `mdmx generate`), then runs `generate` once so `next dev` works
immediately.

It does **not** touch `next.config.*`. Rewriting config-as-code loses comments
and formatting, so the snippet is printed for you to paste:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@mdmx/core",
    "@mdmx/project",
    "@mdmx/studio",
    "@mdmx/editor",
    "@mdmx/next",
    "@mdmx/dashboard",
  ],
};

export default nextConfig;
```

If you forget, `mdmx check` warns about it — the failure it prevents (Next's
bundler choking on symlinked workspace deps) is otherwise cryptic.

## The two mount files

```ts
// app/api/mdmx/[...route]/route.ts
import { createMDMXHandlers } from "@mdmx/next";
export const { GET, POST, PUT, DELETE } = createMDMXHandlers();
export const dynamic = "force-dynamic";
```

```tsx
// app/mdmx/[[...slug]]/page.tsx
import { createDashboardPage } from "@mdmx/dashboard/next";
import { components } from "../../../.mdmx/components";

export default createDashboardPage({ components });
export const dynamic = "force-dynamic";
```

`createMDMXHandlers()` takes no arguments because everything it needs is
already written down: structural values in `mdmx.config.json`, secrets in the
environment, the registry in `.mdmx/`. Every one of them is still an explicit
option when your layout differs — see [guide 3](03-content-api.md).

The dashboard's three generated import lines are the floor: package code can't
import your components, so *something* in your app has to. That something is
generated, not maintained by hand.

## `mdmx.config.json`

```jsonc
{
  "components": "components/mdmx/**/*.{ts,tsx}",
  "contentDir": "content",
  "mediaDir": "public/media",
  "outDir": ".mdmx",
  "repo": { "owner": "your-org", "name": "your-repo", "branch": "main" },
  "collections": {
    "posts": {
      "dir": "content/posts",
      "fields": {
        "title": { "control": { "type": "text" }, "required": true },
        "status": {
          "control": { "type": "select", "options": ["draft", "private", "published"] },
          "required": true,
          "default": "draft"
        }
      }
    }
  }
}
```

This file is the single source of truth for the CLI, the API handlers, and the
dashboard. `repo` lives here rather than in the environment because it isn't a
secret — it's a fact about where content lives, identical in every deployment.

Secrets are the environment's job, and only three exist:

| Variable | Needed for |
| --- | --- |
| `MDMX_GITHUB_CLIENT_ID` | GitHub mode |
| `MDMX_GITHUB_CLIENT_SECRET` | GitHub mode |
| `MDMX_SESSION_SECRET` | GitHub mode (seals the session cookie) |

**Mode is detected, not configured.** All three set → GitHub mode. None set →
local mode, where saves write to your working tree and there's no login. In
production with none set, MDMX refuses to start and names the missing
variables rather than quietly serving unauthenticated writes.

## `.mdmx/` — generated, and committed

`mdmx generate` writes:

| File | What it is |
| --- | --- |
| `registry.json` | The component/collection data. Read by the CLI and the API |
| `registry.ts` | The spec plus `serverComponents` — server-safe, for public pages |
| `components.ts` | The same map behind `"use client"`, for the dashboard |
| `server.ts` | Bound helpers: `MDMXEntry`, `getEntry`, `listEntries`, `renderComponents` |
| `studio.css` | Utilities for components built in the Studio (only when you have some) |

**Commit this directory.** The registry is the contract your editor palette and
your validation rules are built from, so a reviewer should see it change in the
same PR as the component that changed it. The artifacts are byte-stable (no
timestamps) and a no-op regenerate rewrites nothing, so committing them doesn't
churn your diffs — and `mdmx check` fails if a committed registry has fallen
behind its components.

Next: [define components and generate the registry →](02-components-and-registry.md)
