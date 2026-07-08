"use client";
import { useDashboard } from "../context.js";
import { routeHref } from "../routes.js";
import { Link } from "../shell/link.js";

/** Dashboard home: the collections overview. */
export function HomeView() {
  const { config, collections } = useDashboard();
  return (
    <div className="mdmx-dash-view">
      <header className="mdmx-dash-view-head">
        <h1>Content</h1>
        <Link
          className="mdmx-dash-button mdmx-dash-button-primary"
          href={routeHref(config.mountPath, "collections", "new")}
        >
          New collection
        </Link>
      </header>

      {collections.length === 0 ? (
        <div className="mdmx-dash-empty">
          <p>No collections yet.</p>
          <p className="mdmx-dash-hint">
            A collection is a content directory with a typed frontmatter schema — posts,
            pages, changelog entries. Create one to start writing.
          </p>
        </div>
      ) : (
        <ul className="mdmx-dash-card-grid">
          {collections.map((c) => (
            <li key={c.name}>
              <Link
                className="mdmx-dash-card"
                href={routeHref(config.mountPath, "collections", c.name)}
              >
                <span className="mdmx-dash-card-title">{c.name}</span>
                <span className="mdmx-dash-card-meta">
                  {c.fields.length} field{c.fields.length === 1 ? "" : "s"}
                </span>
                <code className="mdmx-dash-card-dir">{c.dir}</code>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
