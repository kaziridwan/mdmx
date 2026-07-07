# 4 · Mounting the editor

The editor is a React component — `MDMXEditor` from `@mdmx/editor/react` —
that you mount on a page of your app. The pattern is a **server component**
that reads the file (content + blob sha) and a **client component** that
renders the editor and saves through the API from [guide 3](03-content-api.md).

## The client component

Two things are non-negotiable here:

1. **Load the editor client-only.** ProseMirror touches browser globals at
   import time, so import `MDMXEditor` via `next/dynamic` with `ssr: false`.
2. **Track the blob sha across saves.** Send `expectedSha` with every `PUT`
   and refresh it after each save, so concurrent edits surface as a 409
   instead of silently clobbering each other.

```tsx
// app/edit/[...slug]/EditorClient.tsx
"use client";
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Registry, type CollectionSpec, type RegistrySpec } from "@mdmx/core";
import { components } from "../../../lib/components";

// ProseMirror touches browser globals at import time → load client-only.
const MDMXEditor = dynamic(
  async () => (await import("@mdmx/editor/react")).MDMXEditor,
  { ssr: false, loading: () => <div>Loading editor…</div> },
);

export function EditorClient({
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
      body: JSON.stringify({
        path,
        content,
        expectedSha: shaRef.current,
        message: `mdmx: edit ${path}`,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `save failed (${res.status})`);
    }
    // Refresh the blob sha so the next save stays conflict-safe.
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

Rejecting the `onSave` promise (as above on a non-OK response) surfaces the
error in the editor's save toolbar — no extra error UI needed.

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

A registry component missing from the map still works — it renders as a
labeled placeholder block instead of live output.

## The server page

```tsx
// app/edit/[...slug]/page.tsx
import { LocalProvider } from "@mdmx/next";
import { CONTENT_DIR, projectRoot, registry, registrySpec } from "../../../lib/mdmx-config";
import { EditorClient } from "./EditorClient";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: { slug: string[] } }) {
  const path = `${CONTENT_DIR}/${params.slug.join("/")}`;
  const provider = new LocalProvider(projectRoot());
  const collection = registry().collectionForPath(path);

  const file = await provider.read(path); // { content, sha }

  return (
    <EditorClient
      path={path}
      initialSource={file.content}
      initialSha={file.sha}
      registrySpec={registrySpec()}
      collection={collection}
    />
  );
}
```

Notes:

- The **server** reads the file directly through the provider (no HTTP hop)
  and passes content + sha down. `force-dynamic` keeps the page reading fresh
  content after saves.
- `registrySpec()` (plain JSON) crosses the server→client boundary;
  the client rebuilds `new Registry(spec)`. Don't try to pass the `Registry`
  class instance — it isn't serializable.
- `collectionForPath` resolves which collection owns the file; passing the
  resulting `CollectionSpec` enables the editor's typed **frontmatter panel**.
- `/edit/posts/welcome.mdx` edits `content/posts/welcome.mdx`. In GitHub mode,
  gate this page on the session, or simply let every API call 401 and redirect
  to `/api/mdmx/auth/login`.

## `MDMXEditorProps` reference

| Prop | Type | Meaning |
| --- | --- | --- |
| `registry` | `Registry` (required) | Drives the schema, palette, prop panels, validation |
| `components` | `ComponentMap` | Live implementations; missing entries render placeholders |
| `source` | `string` | Initial document as MDMX source (frontmatter included) |
| `collection` | `CollectionSpec` | Enables the frontmatter panel for this document |
| `onSave` | `(source: string) => void \| Promise<void>` | Receives canonical MDMX; presence adds the save toolbar; reject to show an error |
| `docTitle` | `string` | Toolbar label (e.g. the file path) |
| `backHref` / `backLabel` | `string` | Optional back link at the start of the toolbar |
| `media` | `MediaSource` | Media adapter; presence enables the image button + library (below) |
| `mediaDir` | `string` | Where uploads land (default `public/media`) |

What you get out of the box: the block canvas with your components rendered
live, a rail palette with drag-and-drop, a `/` slash menu, a prop panel with
typed controls, nested editing for `blocks` components, and a live source pane
showing the canonical MDMX as you type.

## The media library

`MediaSource` is a two-method adapter — the editor doesn't know where images
live. Back it with the MDMX API and images upload into `public/media/` (and,
in GitHub mode, commit atomically like any other save):

```ts
import type { MediaItem, MediaSource, MediaUpload } from "@mdmx/editor/react";

const MEDIA_DIR = "public/media";
/** Map a repo path under `public/` to the URL Next serves it at. */
const publicUrl = (path: string) => "/" + path.replace(/^public\//, "");

export const media: MediaSource = {
  list: async () => {
    const res = await fetch(`/api/mdmx/files?dir=${encodeURIComponent(MEDIA_DIR)}`);
    if (res.status === 404) return []; // media dir not created yet
    if (!res.ok) throw new Error(`could not list media (${res.status})`);
    const { files } = (await res.json()) as { files: { path: string }[] };
    return files.map((f) => ({ path: f.path, url: publicUrl(f.path) }));
  },
  upload: async (upload: MediaUpload): Promise<MediaItem> => {
    const res = await fetch("/api/mdmx/media", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(upload),
    });
    if (!res.ok) throw new Error(`upload failed (${res.status})`);
    const { path } = (await res.json()) as { path: string };
    return { path, url: publicUrl(path) };
  },
};
```

Pass it as `<MDMXEditor media={media} mediaDir={MEDIA_DIR} …/>`. Pasting an
image from the clipboard also routes through this adapter.

## Styling

The editor ships **no stylesheet**. It renders semantic, class-named markup
(`.mdmx-editor`, `.mdmx-rail`, `.mdmx-sidebar`, `.mdmx-toolbar`, …) and leaves
appearance to you, so the CMS inherits your app's look. The fastest start is
to copy the editor sections of the demo's
[`app/globals.css`](../../../examples/demo-next/app/globals.css) and adjust
tokens from there.

Next: [render content on your site →](05-rendering-content.md)
