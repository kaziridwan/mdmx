# 5 · Rendering content on your site

Content lives **in the same repo as the site**, so the published site never
calls GitHub (or any API) at runtime: pages read the local filesystem at build
time. That makes MDMX naturally SSG/ISR-friendly.

## The short version

`mdmx generate` writes `.mdmx/server.ts` — helpers already bound to your
config and your components. A public page is a component call:

```tsx
// app/posts/[slug]/page.tsx
import { MDMXEntry } from "../../../.mdmx/server";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <article className="prose">
      <MDMXEntry collection="posts" slug={slug} />
    </article>
  );
}
```

`MDMXEntry` resolves the collection by **name** (from `mdmx.config.json`),
defaults to `status: "published"`, calls `notFound()` when there's no matching
entry, and renders with your components — including any built in the Component
Studio. Studio CSS is imported for you.

An index page uses the same module:

```tsx
import Link from "next/link";
import { listEntries } from "../.mdmx/server";

export default async function PostsPage() {
  const posts = await listEntries("posts"); // published only
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug}>
          <Link href={`/posts/${post.slug}`}>{String(post.frontmatter.title)}</Link>
        </li>
      ))}
    </ul>
  );
}
```

`listEntries("posts", { status: null })` returns every entry regardless of
status; pass a string or array to filter differently.

## What the generated module exports

| Export | Use |
| --- | --- |
| `MDMXEntry` | Render one entry (`collection`, `slug`, optional `status`, optional extra `components`) |
| `getEntry(collection, slug, query?)` | The entry, or `null` — when you need the frontmatter before rendering |
| `listEntries(collection, query?)` | Entries of a collection, sorted by slug |
| `renderComponents()` | Author components + studio components, for your own `<MDMXContent>` calls |
| `collections` | The name → directory map, typed |

Reading frontmatter before rendering (metadata, say) looks like this:

```tsx
import type { Metadata } from "next";
import { getEntry, MDMXEntry } from "../../../.mdmx/server";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getEntry("posts", slug);
  return { title: entry ? String(entry.frontmatter.title) : "Not found" };
}
```

## Layer 2: doing it yourself

The bound helpers are a convenience over a plain API, and you can drop to it
whenever your page doesn't fit the shape — a collection chosen at runtime, a
session guard, a custom component map:

```tsx
import { getEntryBySlug } from "@mdmx/next";
import { MDMXContent } from "@mdmx/next/render";
import { renderComponents } from "../../.mdmx/server";

const entry = await getEntryBySlug(someDirComputedAtRuntime, slug, {
  status: "private",
});
if (!entry) notFound();

<MDMXContent source={entry.source} components={await renderComponents()} />;
```

`MDMXContent` is a pure function of the source text: it parses with core's
canonical parser, walks the mdast tree, and resolves component tags through
the map. No hooks, no client JavaScript — it works directly in a server
component. An unknown component renders its children inside a
`<div data-mdmx-missing="Name">` rather than throwing, so a half-deployed
rename degrades instead of white-screening.

### Reader options

`getEntries(dir, options)` / `getEntryBySlug(dir, slug, options)` take:

- **`status`** — filter by frontmatter `status` (string or array). This is the
  draft/publish mechanism: model `status` as a collection field
  ([guide 2](02-components-and-registry.md)), edit it in the frontmatter panel,
  filter here. Drafts stay committed but never render.
- **`registry`** — validate each entry and attach `diagnostics`. Useful for an
  authoring view; for CI-gating prefer `mdmx check`, which already exits
  non-zero on errors.

Both return `MDMXEntry` objects:

| Field | Meaning |
| --- | --- |
| `slug` | Filename without extension, unless `frontmatter.slug` overrides it |
| `path` | Path relative to the collection directory |
| `frontmatter` | Parsed YAML frontmatter |
| `source` | The raw MDMX source, frontmatter included |
| `diagnostics` | Present only when you pass `registry` |

## Why not `next-mdx-remote`?

You can use it — MDMX is a strict subset of MDX, so any MDX renderer works
(enable `remark-gfm`, and strip the frontmatter first). But `@mdmx/next/render`
is smaller and matches what the editor showed the author: same registry, same
components, no MDX compiler in your bundle, and no client JavaScript for
content that has none.

## Styling

Your components carry their own styles — MDMX renders *your* React, so nothing
is imposed. Two things worth knowing:

- Components built in the **Component Studio** use Tailwind-style classes that
  your CSS build never sees (they live in JSON). If your app runs Tailwind,
  `mdmx generate` writes their classes to `.mdmx/studio-classes.txt` and you
  add one line to the stylesheet that imports Tailwind —
  `@source "../.mdmx/studio-classes.txt";` — so they compile against *your*
  theme; `mdmx check` reminds you if the line is missing. If your app doesn't
  run Tailwind, `mdmx generate` compiles exactly those utilities into
  `.mdmx/studio.css`, which the generated `server.ts` imports (preflight
  excluded: studio components are guests on your page, not a design system).
- The prose around them (headings, lists, tables from the Markdown side) is
  unstyled HTML. Wrap it in whatever your site uses.

Next: [production with GitHub →](06-production-github.md)
