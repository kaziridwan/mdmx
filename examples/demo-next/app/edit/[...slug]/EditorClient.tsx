"use client";
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Registry, type CollectionSpec, type RegistrySpec } from "@imdx/core";
import type { MediaItem, MediaSource, MediaUpload } from "@imdx/editor/react";
import { components } from "../../../lib/components";

const MEDIA_DIR = "public/media";
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Map a repo path under `public/` to the URL Next serves it at. */
const publicUrl = (path: string) => "/" + path.replace(/^public\//, "");

/** Media adapter over the iMDX API: `/files` to list, `/media` to upload. */
const media: MediaSource = {
  list: async () => {
    const res = await fetch(`/api/imdx/files?dir=${encodeURIComponent(MEDIA_DIR)}`);
    if (res.status === 404) return []; // media dir not created yet
    if (!res.ok) throw new Error(`could not list media (${res.status})`);
    const { files } = (await res.json()) as { files: { path: string }[] };
    return files
      .filter((f) => IMAGE_RE.test(f.path))
      .map((f) => ({ path: f.path, url: publicUrl(f.path) }));
  },
  upload: async (upload: MediaUpload): Promise<MediaItem> => {
    const res = await fetch("/api/imdx/media", {
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
const IMDXEditor = dynamic(
  async () => (await import("@imdx/editor/react")).IMDXEditor,
  { ssr: false, loading: () => <div className="imdx-loading">Loading editor…</div> },
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
    const res = await fetch("/api/imdx/file", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path,
        content,
        expectedSha: shaRef.current,
        message: `imdx: edit ${path}`,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `save failed (${res.status})`);
    }
    // Refresh the blob sha so the next save stays conflict-safe.
    const fresh = await fetch(`/api/imdx/file?path=${encodeURIComponent(path)}`);
    if (fresh.ok) shaRef.current = ((await fresh.json()) as { sha: string }).sha;
  };

  return (
    <IMDXEditor
      registry={registry}
      components={components}
      source={initialSource}
      collection={collection}
      onSave={onSave}
      docTitle={path}
      media={media}
      mediaDir={MEDIA_DIR}
    />
  );
}
