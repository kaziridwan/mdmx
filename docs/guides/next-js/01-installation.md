# 1 · Installation & project setup

## Install the packages

Inside this monorepo, apps consume the packages via the workspace protocol:

```jsonc
// package.json (dependencies)
{
  "dependencies": {
    "@mdmx/core": "workspace:*",
    "@mdmx/editor": "workspace:*",
    "@mdmx/next": "workspace:*"
  },
  "devDependencies": {
    "@mdmx/cli": "workspace:*"
  }
}
```

Outside the monorepo, install the same set from your registry once published
(`@mdmx/core`, `@mdmx/editor`, `@mdmx/next`, and `@mdmx/cli` as a dev
dependency). `@mdmx/provider-github` is only needed for
[GitHub mode](06-production-github.md).

The editor declares `react >= 18` / `react-dom >= 18` as peer dependencies;
your Next.js app already satisfies them.

## `next.config.mjs`

The packages ship built ESM. Add them to `transpilePackages` so Next's bundler
handles them (required for symlinked monorepo deps, harmless otherwise):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mdmx/core", "@mdmx/editor", "@mdmx/next"],
};

export default nextConfig;
```

## Directory layout

A typical integrated app looks like this (the demo app follows it exactly):

```
your-app/
├── mdmx.config.json           # components glob, content dir, collections
├── .mdmx/                     # GENERATED registry — commit it
│   ├── registry.json          #   data: component specs, collections
│   └── registry.ts            #   bindings: imports your real components
├── components/mdmx/           # your MDMX block components (defineMDMX)
│   ├── Callout.tsx
│   └── …
├── content/                   # MDMX documents, committed to git
│   └── posts/
│       └── welcome.mdx
├── public/media/              # uploaded images (served by Next as /media/*)
├── lib/
│   ├── mdmx-config.ts         # shared server-side config (dirs, registry)
│   └── components.ts          # client component map for live rendering
└── app/
    ├── api/mdmx/[...route]/route.ts   # the content/media API (guide 3)
    ├── edit/[...slug]/                # the editor mount (guide 4)
    └── …                              # your public site (guide 5)
```

None of the paths are hardcoded — `mdmx.config.json` and the handler options
let you move any of them — but the guides assume this layout.

## Wire `mdmx generate` into your scripts

The registry must exist before `next dev` or `next build` runs, because both
the API route and the editor load `.mdmx/registry.json` at startup. Use `pre`
scripts:

```jsonc
// package.json (scripts)
{
  "scripts": {
    "generate": "mdmx generate",
    "predev": "mdmx generate",
    "dev": "next dev",
    "prebuild": "mdmx generate",
    "build": "next build",
    "start": "next start"
  }
}
```

Add or change a component and it appears in the editor palette on the next
start. During active component development, `mdmx dev` watches
`components/` + `mdmx.config.json` and regenerates on change (debounced,
hash-diffed — no-op edits don't rewrite the registry).

## Shared server-side config

Both the API route and the editor mount page need the same handful of values.
Centralize them once:

```ts
// lib/mdmx-config.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Registry, type RegistrySpec } from "@mdmx/core";

export const CONTENT_DIR = "content";
export const MEDIA_DIR = "public/media";
export const REPO = { owner: "your-org", name: "your-repo", branch: "main" } as const;

/** The app runs from the project directory; content lives under it. */
export function projectRoot(): string {
  return process.cwd();
}

export function registrySpec(): RegistrySpec {
  const path = join(projectRoot(), ".mdmx", "registry.json");
  return JSON.parse(readFileSync(path, "utf8")) as RegistrySpec;
}

export function registry(): Registry {
  return new Registry(registrySpec());
}
```

This module uses `node:fs`, so import it only from server code (route
handlers, server components). The client gets the registry as a serialized
`RegistrySpec` prop instead — see [guide 4](04-editor.md).

Next: [define components and generate the registry →](02-components-and-registry.md)
