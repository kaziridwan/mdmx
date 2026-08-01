"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamicImport from "next/dynamic.js";
import { collectionForPath } from "@mdmx/core";
import type { MediaItem, MediaSource, MediaUpload } from "@mdmx/editor/react";
import type { ApiClient } from "../api-client.js";
import { useDashboard } from "../context.js";
import { routeHref } from "../routes.js";

// next/dynamic ships CJS without an exports map (same interop story as
// next/link — see shell/link.ts).
type DynamicFn = typeof dynamicImport extends { default: infer D }
  ? D
  : typeof dynamicImport;
const dynamic = ((dynamicImport as unknown as { default?: unknown }).default ??
  dynamicImport) as DynamicFn;

// ProseMirror touches browser globals at import time → client-only chunk.
const MDMXEditor = dynamic(async () => (await import("@mdmx/editor/react")).MDMXEditor, {
  ssr: false,
  loading: () => <div className="mdmx-dash-gate">Loading editor…</div>,
});

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Map a repo path under `public/` to the URL Next serves it at. */
const publicUrl = (path: string) => "/" + path.replace(/^public\//, "");

function makeMediaSource(api: ApiClient, mediaDir: string): MediaSource {
  return {
    list: async () => {
      const files = await api.listFiles(mediaDir);
      return files
        .filter((f) => IMAGE_RE.test(f.path))
        .map((f) => ({ path: f.path, url: publicUrl(f.path) }));
    },
    upload: async (upload: MediaUpload): Promise<MediaItem> => {
      const { path } = await api.uploadMedia(upload);
      return { path, url: publicUrl(path) };
    },
  };
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; detail: string }
  | { phase: "ready"; source: string };

/** Full entry editor: loads the file, embeds MDMXEditor, conflict-safe saves. */
export function EditorView({ path: segments }: { path: string[] }) {
  const { config, api, registry, collections, components } = useDashboard();
  // Route segments carry the full repo-relative path (content/posts/x.mdx) —
  // see editorHref. The API enforces contentDir confinement.
  const path = segments.join("/");
  const collection = collectionForPath(collections, path);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const shaRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .readFile(path)
      .then((file) => {
        if (cancelled) return;
        shaRef.current = file.sha;
        setState({ phase: "ready", source: file.content });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ phase: "error", detail: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [api, path]);

  const media = useMemo(
    () => makeMediaSource(api, config.mediaDir),
    [api, config.mediaDir],
  );

  const onSave = useCallback(
    async (content: string) => {
      // The save response carries the new blob sha, so the next save stays
      // conflict-safe without a follow-up read (and without its race window).
      const { sha } = await api.saveFile({
        path,
        content,
        expectedSha: shaRef.current,
        message: `mdmx: edit ${path}`,
      });
      shaRef.current = sha;
    },
    [api, path],
  );

  const backHref = collection
    ? routeHref(config.mountPath, "collections", collection.name)
    : config.mountPath;

  if (state.phase === "loading") {
    return (
      <div className="mdmx-dash-gate" role="status" aria-label="Loading entry">
        <div className="mdmx-dash-spinner" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="mdmx-dash-view">
        <div className="mdmx-dash-empty">
          <p className="mdmx-dash-error">
            Could not read <code>{path}</code>: {state.detail}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mdmx-dash-editor">
      <MDMXEditor
        registry={registry}
        components={components}
        source={state.source}
        collection={collection}
        onSave={onSave}
        docTitle={path}
        backHref={backHref}
        backLabel={collection ? collection.name : "Dashboard"}
        media={media}
        mediaDir={config.mediaDir}
      />
    </div>
  );
}
