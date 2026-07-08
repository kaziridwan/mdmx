# 4 · Mounting the dashboard

`@mdmx/dashboard` is the drop-in CMS. You already mounted the API route in
[guide 3](03-content-api.md); one more file gives you the entire authoring
surface at `/mdmx`.

## The mount

```tsx
// app/mdmx/[[...slug]]/page.tsx
import { createDashboardPage } from "@mdmx/dashboard/next";
import { components } from "../../../lib/components";

export default createDashboardPage({ components });
export const dynamic = "force-dynamic";
```

That's it. `@mdmx/dashboard/next` also re-exports the whole `@mdmx/next`
surface, so both mount files can import from one package if you prefer.

What you get at `/mdmx`:

- an **auth gate** — GitHub login screen in production, straight in (with a
  "local" badge) under `localMode`
- **collections**: overview cards, per-collection entry tables (title, status
  badge, filter, conflict-safe delete), *create collection* and *edit fields*
  forms that write `mdmx.config.json` through the commit pipeline
- **new-entry scaffolding**: title → slug → a valid starter document from the
  collection's field schema, then straight into the editor
- the **embedded block editor**: your components rendered live, prop panels,
  slash menu, the live canonical-source pane, media uploads, sha-checked
  conflict-safe saves
- a **media library**, a **settings page** (session, repo, validation mode,
  light/dark pin), and **⌘K quick-open** across entries and actions

The page factory's server side stays thin: it reads `.mdmx/registry.json` per
request and hands everything to the client app, which talks to the content
API — so the same UI works in localMode and GitHub mode with no changes.

### The component map

The registry JSON describes components; the **component map** provides the
real implementations so blocks render live in the editor exactly as they will
on the site. It's a client module keyed by registry name:

```ts
// lib/components.ts
"use client";
import type { ComponentMap } from "@mdmx/editor/react";
import Callout from "../components/mdmx/Callout";
import TwoColumn from "../components/mdmx/TwoColumn";
import Column from "../components/mdmx/Column";

export const components: ComponentMap = { Callout, TwoColumn, Column };
```

Because it's a `"use client"` module, the components cross the server→client
boundary as references. A registry component missing from the map still works
— it renders as a labeled placeholder block.

### `DashboardPageOptions` reference

Everything is optional; the defaults match the canonical mount and the
standard layout from [guide 1](01-installation.md).

| Option | Default | Meaning |
| --- | --- | --- |
| `components` | — | Author components (client references) for live rendering |
| `basePath` | `"/api/mdmx"` | Where the API handlers are mounted |
| `mountPath` | `"/mdmx"` | Where this page is mounted (used to build links) |
| `contentDir` | `"content"` | Content directory, repo-relative |
| `mediaDir` | `"public/media"` | Media directory, repo-relative |
| `registryPath` | `".mdmx/registry.json"` | Registry JSON, project-root-relative |
| `title` | `"MDMX"` | Product name in the navbar |

## Theming

The dashboard ships its stylesheet automatically (the package imports it; no
CSS import needed in your app). It follows `prefers-color-scheme` and
supports a pinned theme via `data-mdmx-theme="light" | "dark"` on any
ancestor — the settings page exposes exactly that as a per-browser toggle.

Every color, radius, and font routes through `--mdmx-*` custom properties, so
restyling is a token override:

```css
/* your globals.css */
.mdmx-dash,
.mdmx-dash-gate {
  --mdmx-accent: #0d9488;
  --mdmx-font: "Inter", system-ui, sans-serif;
}
```

The embedded editor is themed by the same stylesheet, **scoped under
`.mdmx-dash-editor`** — an editor you mount yourself elsewhere (below) stays
headless, as `@mdmx/editor` always has been.

Your own block components are yours to style: global CSS (like the demo's
`mk-*` classes) applies inside the editor canvas and on your public pages
alike — that's what makes the editing experience WYSIWYG.

## Advanced: mounting the editor manually

The dashboard is a composition of public APIs — if you need the block editor
inside your own UI (a bespoke admin, a different shell), mount `MDMXEditor`
directly. Two rules:

1. **Load it client-only.** ProseMirror touches browser globals at import
   time, so import via `next/dynamic` with `ssr: false`.
2. **Track the blob sha across saves** (`expectedSha` + refresh after each
   save) so concurrent edits surface as 409s instead of clobbering.

```tsx
"use client";
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Registry, type CollectionSpec, type RegistrySpec } from "@mdmx/core";
import { components } from "../lib/components";

const MDMXEditor = dynamic(
  async () => (await import("@mdmx/editor/react")).MDMXEditor,
  { ssr: false, loading: () => <div>Loading editor…</div> },
);

export function MyEditor({
  path,
  initialSource,
  initialSha,
  registrySpec,
  collection,
}: {
  path: string;
  initialSource: string;
  initialSha: string;
  registrySpec: RegistrySpec;
  collection?: CollectionSpec;
}) {
  const registry = useMemo(() => new Registry(registrySpec), [registrySpec]);
  const shaRef = useRef(initialSha);

  const onSave = async (content: string) => {
    const res = await fetch("/api/mdmx/file", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, content, expectedSha: shaRef.current }),
    });
    if (!res.ok) throw new Error(`save failed (${res.status})`);
    const fresh = await fetch(`/api/mdmx/file?path=${encodeURIComponent(path)}`);
    if (fresh.ok) shaRef.current = ((await fresh.json()) as { sha: string }).sha;
  };

  return (
    <MDMXEditor
      registry={registry}
      components={components}
      source={initialSource}
      collection={collection}
      onSave={onSave}
      docTitle={path}
    />
  );
}
```

Rejecting the `onSave` promise surfaces the error in the editor's save
toolbar. Note that a manual mount is **unstyled** — the editor renders
class-named markup (`.mdmx-editor`, `.mdmx-rail`, …) and leaves appearance to
you; the dashboard's scoped chrome deliberately doesn't apply outside it.

### `MDMXEditorProps` reference

| Prop | Type | Meaning |
| --- | --- | --- |
| `registry` | `Registry` (required) | Drives the schema, palette, prop panels, validation |
| `components` | `ComponentMap` | Live implementations; missing entries render placeholders |
| `source` | `string` | Initial document as MDMX source (frontmatter included) |
| `collection` | `CollectionSpec` | Enables the frontmatter panel for this document |
| `onSave` | `(source: string) => void \| Promise<void>` | Receives canonical MDMX; presence adds the save toolbar; reject to show an error |
| `docTitle` | `string` | Toolbar label (e.g. the file path) |
| `backHref` / `backLabel` | `string` | Optional back link at the start of the toolbar |
| `media` | `MediaSource` | Media adapter (`{ list, upload }`); presence enables the image button + library |
| `mediaDir` | `string` | Where uploads land (default `public/media`) |

A `MediaSource` backed by the MDMX API is ~20 lines — list via
`GET /files?dir=<mediaDir>`, upload via `POST /media`, map repo paths under
`public/` to the URLs Next serves. The dashboard's built-in editor view does
exactly this.

Next: [render content on your site →](05-rendering-content.md)
