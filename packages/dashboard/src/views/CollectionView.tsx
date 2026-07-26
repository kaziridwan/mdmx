"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EntryMeta } from "../api-client.js";
import { useDashboard } from "../context.js";
import { editorHref, routeHref } from "../routes.js";
import { Link } from "../shell/link.js";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; detail: string }
  | { phase: "ready"; entries: EntryMeta[] };

/** Entry list for one collection: table, status, filter, delete, new entry. */
export function CollectionView({ name }: { name: string }) {
  const { config, api, collections } = useDashboard();
  const collection = collections.find((c) => c.name === name);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!collection) return;
    try {
      setState({ phase: "ready", entries: await api.listEntries(collection.dir) });
    } catch (err) {
      setState({ phase: "error", detail: (err as Error).message });
    }
  }, [api, collection]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasStatus = useMemo(
    () => collection?.fields.some((f) => f.name === "status") ?? false,
    [collection],
  );

  if (!collection) {
    return (
      <div className="mdmx-dash-view">
        <div className="mdmx-dash-empty">
          <p>
            No collection named <code>{name}</code>.
          </p>
        </div>
      </div>
    );
  }

  const onDelete = async (entry: EntryMeta) => {
    const title = displayTitle(entry);
    if (!window.confirm(`Delete "${title}" (${entry.path})? This commits a deletion.`)) return;
    setError(null);
    try {
      await api.deleteFile({
        path: entry.path,
        expectedSha: entry.sha,
        message: `mdmx: delete ${entry.path}`,
      });
      await load();
    } catch (err) {
      setError(`Could not delete ${entry.path}: ${(err as Error).message}`);
    }
  };

  const entries = state.phase === "ready" ? state.entries : [];
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? entries.filter(
        (e) =>
          displayTitle(e).toLowerCase().includes(needle) ||
          e.path.toLowerCase().includes(needle),
      )
    : entries;

  return (
    <div className="mdmx-dash-view">
      <header className="mdmx-dash-view-head">
        <div>
          <h1>{collection.name}</h1>
          <p className="mdmx-dash-view-sub">
            <code>{collection.dir}/</code>
            {" · "}
            <Link href={routeHref(config.mountPath, "collections", collection.name, "edit")}>
              Edit fields
            </Link>
          </p>
        </div>
        <Link
          className="mdmx-dash-button mdmx-dash-button-primary"
          href={routeHref(config.mountPath, "collections", collection.name, "new")}
        >
          New entry
        </Link>
      </header>

      {error ? <p className="mdmx-dash-error">{error}</p> : null}

      {entries.length > 3 ? (
        <input
          className="mdmx-dash-input mdmx-dash-filter"
          placeholder="Filter entries…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter entries"
        />
      ) : null}

      {state.phase === "loading" ? (
        <div className="mdmx-dash-empty">
          <p>Loading entries…</p>
        </div>
      ) : state.phase === "error" ? (
        <div className="mdmx-dash-empty">
          <p className="mdmx-dash-error">Could not load entries: {state.detail}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="mdmx-dash-empty">
          <p>{needle ? "No entries match the filter." : "No entries yet."}</p>
        </div>
      ) : (
        <table className="mdmx-dash-table">
          <thead>
            <tr>
              <th>Title</th>
              {hasStatus ? <th className="mdmx-dash-table-narrow">Status</th> : null}
              <th>Path</th>
              <th className="mdmx-dash-table-narrow" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr key={entry.path}>
                <td>
                  <Link
                    className="mdmx-dash-table-title"
                    href={editorHref(config.mountPath, entry.path)}
                  >
                    {displayTitle(entry)}
                  </Link>
                </td>
                {hasStatus ? (
                  <td className="mdmx-dash-table-narrow">
                    <StatusBadge value={entry.frontmatter.status} />
                  </td>
                ) : null}
                <td>
                  <code className="mdmx-dash-table-path">{entry.path}</code>
                </td>
                <td className="mdmx-dash-table-narrow">
                  <button
                    type="button"
                    className="mdmx-dash-button mdmx-dash-button-ghost mdmx-dash-danger-hover"
                    onClick={() => void onDelete(entry)}
                    aria-label={`Delete ${displayTitle(entry)}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function displayTitle(entry: EntryMeta): string {
  const title = entry.frontmatter.title;
  if (typeof title === "string" && title.length > 0) return title;
  return entry.path.split("/").pop() ?? entry.path;
}

function StatusBadge({ value }: { value: unknown }) {
  if (typeof value !== "string" || value.length === 0) {
    return <span className="mdmx-dash-status">—</span>;
  }
  return <span className={`mdmx-dash-status is-${value}`}>{value}</span>;
}
