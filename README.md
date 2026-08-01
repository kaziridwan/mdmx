# MDMX

A git-native CMS for Next.js, built around **MDMX** — a strict, round-trippable
subset of MDX where your own React components are first-class editor blocks.

Think Outstatic's model (CMS mounted inside your Next.js app, content committed
to your GitHub repo) with a Notion-style block editor that renders *your*
components live, driven by a generated component registry.

## Quick start

```sh
pnpm add @mdmx/core @mdmx/project @mdmx/studio @mdmx/next @mdmx/editor @mdmx/dashboard
pnpm add -D @mdmx/cli

pnpm mdmx init nextjs     # config, both mount files, a starter component, generate
# paste the printed transpilePackages snippet into next.config.mjs
pnpm dev                  # → http://localhost:3000/mdmx
```

That's the whole local setup. For production, set three environment variables
(`MDMX_GITHUB_CLIENT_ID`, `MDMX_GITHUB_CLIENT_SECRET`, `MDMX_SESSION_SECRET`)
and the same code runs GitHub mode — saves become commits to your repo.

**The two mount files `init` writes:**

```ts
// app/api/mdmx/[...route]/route.ts
import { createMDMXHandlers } from "@mdmx/next";
export const { GET, POST, PUT, DELETE } = createMDMXHandlers();
```

```tsx
// app/mdmx/[[...slug]]/page.tsx
import { createDashboardPage } from "@mdmx/dashboard/next";
import { components } from "../../../.mdmx/components";
export default createDashboardPage({ components });
```

**Rendering an entry on your public site:**

```tsx
// app/posts/[slug]/page.tsx
import { MDMXEntry } from "../../../.mdmx/server";

export default async function PostPage({ params }) {
  const { slug } = await params;
  return <MDMXEntry collection="posts" slug={slug} />;
}
```

Nothing above is hand-wired: `mdmx generate` writes `.mdmx/` (registry, both
component maps, the bound server helpers, and studio CSS), and everything else
resolves from `mdmx.config.json` plus the environment. Every value stays
overridable when you need something non-standard — see the
[guides](docs/guides/next-js/).

## Packages

| Package | Purpose |
| --- | --- |
| `@mdmx/core` | The MDMX spec: parser, validator (`MDMX001`–`MDMX010`), canonical serializer, registry types, provider contract, `defineMDMX()` |
| `@mdmx/project` | What a project on disk looks like: `mdmx.config.*` schema and loading, environment/mode resolution, registry loading |
| `@mdmx/studio` | Component Studio: the template-component model, validation, registry integration, TSX eject, and (`/react`) the template→React renderer |
| `@mdmx/cli` | `mdmx init` (scaffold), `mdmx generate` (registry + bindings + studio CSS), `mdmx check` (content lint, CI-ready), `mdmx dev` (watch) |
| `@mdmx/editor` | Registry→ProseMirror schema, mdast converters with byte-level round-trip tests, and the React editor (`/react`) |
| `@mdmx/next` | Route handlers, content providers, entry readers, sessions, and the `AuthStrategy` seam |
| `@mdmx/dashboard` | The drop-in CMS at `/mdmx`: auth gate, collections, entries, media, settings, embedded editor |
| `@mdmx/provider-github` | Git Data API provider: atomic multi-file commits, optimistic concurrency, path-safety guards |

Dependency direction, enforced: `core ← project, studio, cli, editor, next,
provider-github`, and `dashboard` composes them. Nothing depends on the
dashboard.

## The MDMX subset (v1)

MDMX is validated as a whitelist over the standard MDX AST:

- CommonMark + GFM slice: headings, emphasis, lists, blockquotes, code,
  tables, task lists, thematic breaks
- Block-level JSX for **registered components only**
- **Props are JSON**: string/number/boolean/null literals, arrays, plain
  objects, unary minus — no identifiers, calls, templates, or spreads
- No `import`/`export`, no `{expressions}`, no raw HTML, no inline JSX,
  no reference-style links, no footnotes
- Children policies per component: `none` | `rich-text` | `blocks`, plus
  `allowedParents` / `allowedChildren` slot constraints
- YAML frontmatter for metadata

The serializer emits one **canonical form** (pinned remark-stringify +
mdx-jsx options) so saves produce minimal git diffs. Changing canonical
formatting is treated as a semver-major change.

## Vocabulary

A **document** is any MDMX file — that's the spec's concern. An **entry** is a
document that belongs to a collection, so it has a slug, a status, and a
frontmatter schema. Everything above the collection line (the project layer,
the HTTP API, the dashboard) speaks in entries.

## Repo guides

- **docs/guides/next-js/** — step-by-step integration, from install to
  GitHub-mode production
- **SPEC.md** — the MDMX v1 grammar, canonical form, registry schema,
  diagnostics, provider contract
- **AGENTS.md** / **CLAUDE.md** — context for AI coding agents (invariants,
  build gotchas)
- **docs/DECISIONS.md** — the "why" behind every architectural decision
- **examples/demo-next** — a complete runnable app using exactly the recipe
  above (`pnpm dev:next`)
- **examples/editor-playground** — Vite harness for editor UI work

## Development

```sh
pnpm install
pnpm test          # builds all packages, then runs all 389 tests
pnpm build         # build all packages
pnpm check         # typecheck all packages
pnpm verify        # typecheck + test (pre-push gate)
```

Key guarantees under test in `@mdmx/core`:

- `toMDX(parseMDX(x))` is a fixed point (idempotent canonicalization)
- ASTs survive serialize → parse cycles structurally
- Editing one prop changes exactly one line of output
- Every diagnostic code fires on its violation and only then

## Roadmap

1. **Phase 1 (spine)** ✅ — core, registry codegen, editor, GitHub provider,
   Next.js mount with OAuth
2. **Phase 2** ✅ — collections, draft/publish/private, container components
   with nested editing, media library, `mdmx check` in CI
3. **Phase 2.5 (0.4.x)** ✅ — the drop-in dashboard, collections managed from
   the UI, Component Studio
4. **Phase 3 (0.5)** ✅ — convention-over-configuration API, the `project` and
   `studio` packages, provider contract v2, the auth seam, `mdmx init`
5. **Next** — segment composer, GitLab / generic git providers, collab (Yjs)
