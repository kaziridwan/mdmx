# demo-next

A complete, runnable Next 16 app that dogfoods the drop-in MDMX CMS
**locally** — no GitHub, no database — and doubles as a real Tailwind v4 +
shadcn app. It is exactly what a consumer builds after `mdmx init nextjs`:
the two mount files, the author components, the content, and a site.

## The whole integration

**The dashboard page** (`app/mdmx/[[...slug]]/page.tsx`):

```tsx
import { createDashboardPage } from "@mdmx/dashboard/next";
import { components } from "../../../.mdmx/components";

export default createDashboardPage({ components });
export const dynamic = "force-dynamic";
```

**The content API** (`app/api/mdmx/[...route]/route.ts`):

```tsx
import { createMDMXHandlers } from "@mdmx/next";

export const { GET, POST, PUT, DELETE } = createMDMXHandlers();
export const dynamic = "force-dynamic";
```

Everything — content dir, media dir, repo, validation, the registry, the
mode — resolves from `mdmx.config.json` and the environment (ADR-039).
`predev`/`prebuild` run `mdmx generate`, which writes `.mdmx/` (registry
JSON, the client component map, the bound server helpers the public pages
import).

## What this app supplies

- **`components/mdmx/`** — 39 author components, each a `defineMDMX` wrapper:
  - 17 marketing components (Hero, CallToAction, FeatureGrid/Feature,
    StatsBand/Stat, PricingTable/PricingTier, Testimonial, LogoCloud,
    FAQ/FAQItem, Newsletter, TwoColumn/Column, Callout, Html) built on shadcn
    primitives and Tailwind utilities;
  - 22 shadcn components registered as blocks (Accordion, Alert, Avatar,
    Badge, Button, Card, Collapsible, Empty, HoverCard, Item, Kbd, Progress,
    Separator, Skeleton, Spinner, Table, Tabs/Tab, Toggle, Tooltip, …) —
    the rules that decide what can be a block are in ADR-053.
- **`components/ui/`** — the full shadcn set (`shadcn add --all`), Base UI
  flavor; the blocks wrap these, the rest is there for app chrome.
- **`app/globals.css`** — Tailwind + the shadcn theme (primary is the demo's
  indigo) and `.mdmx-page`, the **content class**: the public `<article>`
  and the editor canvas share it, so what you see while editing is the page
  (ADR-050). Fonts come from `next/font` as `--font-sans/serif/mono`.
- **`content/`** + **`mdmx.config.json`** — the `posts` collection
  (`marketing`, `blocks`, `layout`, `welcome`, a private and a draft entry)
  and a studio component in `content/_components/`.
- **`app/`** — the public site: `/` lists entries, `/posts/[slug]` renders
  published ones through the generated `MDMXEntry`, `/private/[...path]`
  renders private ones behind the session guard.

## Run it

From the repo root:

```sh
pnpm install
pnpm dev:next        # builds deps, runs mdmx generate, starts next dev
```

Open http://localhost:3000 — the site — or http://localhost:3000/mdmx — the
dashboard. Edits save as canonical MDMX into `content/`; `git diff` shows the
minimal, one-line-per-edit diffs. Blocks are live in the editor: click a tab,
type into the newsletter form, expand an accordion item.

> Local mode: the API runs a synthetic "local" session (no OAuth) and
> `LocalProvider` writes to the working tree. Validation, path-safety,
> CSRF-origin, and conflict checks still apply.

## Going to production (GitHub mode)

Set the three `MDMX_GITHUB_*` variables and the same two files run GitHub
mode — see `docs/guides/next-js/06-production-github.md`. Collaborators with
push access log in with GitHub; every save becomes an atomic commit authored
by them.
