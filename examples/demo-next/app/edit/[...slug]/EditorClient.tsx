"use client";
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Registry, type CollectionSpec, type RegistrySpec } from "@mdmx/core";
import type { MediaItem, MediaSource, MediaUpload } from "@mdmx/editor/react";
import { components } from "../../../lib/components";

const MEDIA_DIR = "public/media";
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Map a repo path under `public/` to the URL Next serves it at. */
const publicUrl = (path: string) => "/" + path.replace(/^public\//, "");

/** Media adapter over the MDMX API: `/files` to list, `/media` to upload. */
const media: MediaSource = {
  list: async () => {
    const res = await fetch(`/api/mdmx/files?dir=${encodeURIComponent(MEDIA_DIR)}`);
    if (res.status === 404) return []; // media dir not created yet
    if (!res.ok) throw new Error(`could not list media (${res.status})`);
    const { files } = (await res.json()) as { files: { path: string }[] };
    return files
      .filter((f) => IMAGE_RE.test(f.path))
      .map((f) => ({ path: f.path, url: publicUrl(f.path) }));
  },
  upload: async (upload: MediaUpload): Promise<MediaItem> => {
    const res = await fetch("/api/mdmx/media", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(upload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `upload failed (${res.status})`);
    }
    const { path } = (await res.json()) as { path: string };
    return { path, url: publicUrl(path) };
  },
};

// ProseMirror touches browser globals at import time → load client-only.
const MDMXEditor = dynamic(
  async () => (await import("@mdmx/editor/react")).MDMXEditor,
  { ssr: false, loading: () => <div className="mdmx-loading">Loading editor…</div> },
);

export function EditorClient({
  path,
  initialSource,
  initialSha,
  registrySpec,
  collection,
  backHref,
  backLabel,
}: {
  path: string;
  initialSource: string;
  initialSha: string;
  registrySpec: RegistrySpec;
  collection?: CollectionSpec;
  backHref?: string;
  backLabel?: string;
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
      backHref={backHref}
      backLabel={backLabel}
      media={media}
      mediaDir={MEDIA_DIR}
    />
  );
}
