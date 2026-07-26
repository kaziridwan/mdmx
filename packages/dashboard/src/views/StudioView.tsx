"use client";
import { useState } from "react";
import { studioComponent } from "@mdmx/next/render";
import type { JsonValue } from "@mdmx/core";
import type { StudioComponentDef } from "@mdmx/studio";
import type { StudioComponentEntry } from "../api-client.js";
import { useDashboard } from "../context.js";
import { Link } from "../shell/link.js";
import { routeHref } from "../routes.js";

/** Sample props for a preview: defaults first, then type-shaped filler. */
export function samplePropsFor(def: StudioComponentDef): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const prop of def.props) {
    if (prop.default !== undefined) out[prop.name] = prop.default;
    else if (prop.type === "number") out[prop.name] = 42;
    else if (prop.type === "boolean") out[prop.name] = true;
    else out[prop.name] = prop.name.charAt(0).toUpperCase() + prop.name.slice(1);
  }
  return out;
}

/** Component studio home: every stored definition as a live preview card. */
export function StudioView() {
  const { config, api, studio } = useDashboard();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const onDelete = async (entry: StudioComponentEntry) => {
    if (!window.confirm(`Delete ${entry.def.name}? Documents using it will flag MDMX001.`)) {
      return;
    }
    setError(null);
    setBusy(entry.def.name);
    try {
      await api.deleteStudioComponent(entry.def.name);
      await studio.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mdmx-dash-view">
      <header className="mdmx-dash-view-head">
        <div>
          <h1>Component Studio</h1>
          <p className="mdmx-dash-view-sub">
            Tailwind-styled components built in the browser — stored in{" "}
            <code>{config.contentDir}/_components/</code>, usable in the editor immediately.
          </p>
        </div>
        <Link
          className="mdmx-dash-button mdmx-dash-button-primary"
          href={routeHref(config.mountPath, "studio", "new")}
        >
          New component
        </Link>
      </header>

      {error ? <p className="mdmx-dash-error">{error}</p> : null}

      {studio.entries.length === 0 ? (
        <div className="mdmx-dash-empty">
          <p>No studio components yet. Build the first one from HTML + Tailwind classes.</p>
        </div>
      ) : (
        <div className="mdmx-studio-grid">
          {studio.entries.map((entry) => (
            <StudioCard
              key={entry.def.name}
              entry={entry}
              editHref={routeHref(config.mountPath, "studio", entry.def.name)}
              busy={busy === entry.def.name}
              onDelete={() => void onDelete(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StudioCard({
  entry,
  editHref,
  busy,
  onDelete,
}: {
  entry: StudioComponentEntry;
  editHref: string;
  busy: boolean;
  onDelete: () => void;
}) {
  const Component = studioComponent(entry.def);
  return (
    <div className="mdmx-studio-card">
      <div className="mdmx-studio-card-preview">
        <Component {...samplePropsFor(entry.def)} />
      </div>
      <div className="mdmx-studio-card-meta">
        <div>
          <Link className="mdmx-studio-card-name" href={editHref}>
            {entry.def.name}
          </Link>
          {entry.def.description ? (
            <p className="mdmx-studio-card-desc">{entry.def.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="mdmx-dash-button mdmx-dash-button-ghost"
          disabled={busy}
          onClick={onDelete}
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
