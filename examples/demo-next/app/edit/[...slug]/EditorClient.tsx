"use client";
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Registry, type CollectionSpec, type RegistrySpec } from "@imdx/core";
import { components } from "../../../lib/components";

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
    />
  );
}
