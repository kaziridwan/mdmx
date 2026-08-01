"use client";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api-client.js";
import { useDashboard } from "../context.js";
import { editorHref } from "../routes.js";
import { scaffoldDocument, slugify } from "../scaffold.js";

/**
 * Scaffold a new entry: title → slug → a valid starter document (canonical
 * frontmatter from the collection's fields), committed with
 * `expectedSha: null` so an existing file is never clobbered, then straight
 * into the editor.
 */
export function EntryNewView({ collectionName }: { collectionName: string }) {
  const { config, api, collections } = useDashboard();
  const collection = collections.find((c) => c.name === collectionName);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!collection) {
    return (
      <div className="mdmx-dash-view">
        <div className="mdmx-dash-empty">
          <p>
            No collection named <code>{collectionName}</code>.
          </p>
        </div>
      </div>
    );
  }

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const path = `${collection.dir}/${effectiveSlug || "untitled"}.mdx`;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.saveFile({
        path,
        content: scaffoldDocument(collection, title.trim() || "Untitled", effectiveSlug),
        expectedSha: null,
        message: `mdmx: create ${path}`,
      });
      window.location.assign(editorHref(config.mountPath, path));
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof ApiError && err.status === 409
          ? `"${path}" already exists — pick a different slug.`
          : (err as Error).message,
      );
    }
  };

  return (
    <div className="mdmx-dash-view mdmx-dash-view-narrow">
      <header className="mdmx-dash-view-head">
        <h1>New {collection.name} entry</h1>
      </header>

      <form className="mdmx-dash-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="mdmx-dash-field">
          <span>Title</span>
          <input
            className="mdmx-dash-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My new entry"
            autoFocus
            required
          />
        </label>

        <label className="mdmx-dash-field">
          <span>Slug</span>
          <input
            className="mdmx-dash-input"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="my-new-entry"
          />
          <span className="mdmx-dash-field-hint">
            Saves as <code>{path}</code>
          </span>
        </label>

        {error ? <p className="mdmx-dash-error">{error}</p> : null}

        <div className="mdmx-dash-form-actions">
          <button
            type="submit"
            className="mdmx-dash-button mdmx-dash-button-primary"
            disabled={busy || title.trim().length === 0}
          >
            {busy ? "Creating…" : "Create and open editor"}
          </button>
        </div>
      </form>
    </div>
  );
}
