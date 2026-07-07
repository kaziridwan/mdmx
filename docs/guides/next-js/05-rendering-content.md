# 5 · Rendering content on your site

Content lives **in the same repo as the site**, so the published site never
calls GitHub (or any API) at runtime: pages read the local filesystem at build
time. That makes MDMX naturally SSG/ISR-friendly.

## Reading documents

`@mdmx/next` ships two read-side helpers:

```ts
import { join } from "node:path";
import { getDocuments, getDocumentBySlug } from "@mdmx/next";

const dir = join(process.cwd(), "content/posts");

const published = await getDocuments(dir, { status: "published" });
const doc = await getDocumentBySlug(dir, "welcome");
```

Both scan a collection directory recursively for `.mdx`/`.md` files (dotfiles
skipped) and return `MDMXDocument`s sorted by slug:

| Field | Meaning |
| --- | --- |
| `slug` | Filename without extension, unless `frontmatter.slug` overrides it |
| `path` | Path relative to the collection directory |
| `frontmatter` | Parsed YAML frontmatter |
| `source` | The raw MDMX source, frontmatter included |
| `diagnostics` | Present only when you pass `registry` in the options |

Options:

- **`status`** — filter by frontmatter `status` (a string or an array, e.g.
  `["draft", "published"]`). This is the draft/publish mechanism: model
  `status` as a collection field ([guide 2](02-components-and-registry.md)),
  edit it in the frontmatter panel, filter here. Drafts stay committed but
  never render.
- **`registry`** — validate each document and attach `diagnostics`. Useful for
  an authoring dashboard; for CI-gating, prefer `mdmx check`, which already
  exits non-zero on errors.

## Rendering MDMX

MDMX is a **strict subset of MDX**, so any standard MDX renderer renders it —
there's no bespoke runtime to adopt. The subset actually makes rendering
simpler than general MDX:

- No `import`/`export` and no expressions in content — documents are inert
  data, safe to compile from a string.
- Every JSX tag is a registered component — the component map you already
  built for the editor ([guide 4](04-editor.md)) is exactly the map the
  renderer needs. Same registry, same components: what authors saw in the
  editor is what ships.

The recipe below uses `next-mdx-remote` (install it yourself — it's not an
MDMX dependency). Two requirements: enable **`remark-gfm`** (MDMX includes
GFM tables and task lists) and **parse the frontmatter off** (`source`
includes it).

```tsx
// app/blog/[slug]/page.tsx
import { join } from "node:path";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getDocuments, getDocumentBySlug } from "@mdmx/next";
import { components } from "../../../lib/components";

const POSTS_DIR = join(process.cwd(), "content/posts");

export async function generateStaticParams() {
  const docs = await getDocuments(POSTS_DIR, { status: "published" });
  return docs.map((d) => ({ slug: d.slug }));
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const doc = await getDocumentBySlug(POSTS_DIR, params.slug, { status: "published" });
  if (!doc) notFound();

  return (
    <article>
      <h1>{String(doc.frontmatter.title ?? doc.slug)}</h1>
      <MDXRemote
        source={doc.source}
        components={components}
        options={{
          parseFrontmatter: true,
          mdxOptions: { remarkPlugins: [remarkGfm] },
        }}
      />
    </article>
  );
}
```

Any other MDX pipeline (`@mdx-js/mdx` `compile`/`run`, contentlayer-style
prebuild, …) works the same way: feed it `doc.source`, the component map, and
remark-gfm.

### Lower-level access

For custom pipelines (search indexing, feeds, excerpt extraction), skip the
MDX compiler entirely: `@mdmx/core`'s `parseDocument(source)` returns
`{ tree, frontmatter }` where `tree` is a standard **mdast** AST you can walk
with the unified ecosystem.

## Keeping the site fresh after edits

- **Local mode**: saves write to the working tree; `next dev` picks them up on
  the next request. For CMS-owned listing pages, use
  `export const dynamic = "force-dynamic"` so lists reflect saves immediately.
- **GitHub mode**: saves are commits on your branch. Let your host's git
  integration (e.g. Vercel/Netlify auto-deploy) rebuild on push — content
  changes flow through the exact same pipeline as code changes, previews and
  rollbacks included. With ISR, pair a webhook with `revalidatePath` if you
  want updates without a full rebuild.

Next: [go to production with GitHub mode →](06-production-github.md)
