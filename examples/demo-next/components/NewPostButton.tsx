"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionSpec } from "@mdmx/core";
import { scaffoldDocument, slugify } from "../lib/scaffold";

/** Strip the leading content dir so the path becomes an `/edit/[...slug]` arg. */
function editSlug(collectionDir: string, contentDir: string, file: string): string {
  const rel = collectionDir.replace(new RegExp(`^${contentDir}/?`), "");
  return rel ? `${rel}/${file}` : file;
}

/**
 * Creates a new entry in `collection`: prompts for a title, writes a scaffolded
 * `.mdx` (conflict-safe — `expectedSha: null` refuses to clobber), then opens it
 * in the editor. Lives client-side so it can navigate after the write.
 */
export function NewPostButton({
  collection,
  contentDir,
}: {
  collection: CollectionSpec;
  contentDir: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const title = window.prompt(`New entry in “${collection.name}” — title?`, "Untitled");
    if (title == null) return; // cancelled
    const trimmed = title.trim() || "Untitled";
    const slug = slugify(trimmed);
    const file = `${slug}.mdx`;
    const path = `${collection.dir}/${file}`;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mdmx/file", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path,
          content: scaffoldDocument(collection, trimmed, slug),
          expectedSha: null, // must-not-exist: never overwrite an existing post
          message: `mdmx: create ${path}`,
        }),
      });
      if (res.status === 409) {
        throw new Error(`A post with the slug “${slug}” already exists.`);
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Could not create post (${res.status}).`);
      }
      router.push(`/edit/${editSlug(collection.dir, contentDir, file)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <span className="mdmx-newpost">
      <button
        type="button"
        className="mdmx-newpost-btn"
        onClick={create}
        disabled={busy}
      >
        {busy ? "Creating…" : "+ New post"}
      </button>
      {error ? <span className="mdmx-newpost-error">{error}</span> : null}
    </span>
  );
}
