"use client";
import { useState } from "react";
import type { JsonValue } from "@mdmx/core";
import { studioComponent } from "../react.js";
import type { StudioComponentDef } from "../model.js";
import type { StudioClient, StudioEntry, StudioHost } from "./client.js";

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
export function StudioView({ client, host }: { client: StudioClient; host: StudioHost }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const onDelete = async (entry: StudioEntry) => {
    if (!window.confirm(`Delete ${entry.def.name}? Documents using it will flag MDMX001.`)) {
      return;
    }
    setError(null);
    setBusy(entry.def.name);
    try {
      await client.remove(entry.def.name);
      await client.refresh();
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
            <code>{host.contentDir}/_components/</code>, usable in the editor immediately.
          </p>
        </div>
        <host.Link
          className="mdmx-dash-button mdmx-dash-button-primary"
          href={host.hrefFor("studio", "new")}
        >
          New component
        </host.Link>
      </header>

      {error ? <p className="mdmx-dash-error">{error}</p> : null}

      {client.entries.length === 0 ? (
        <div className="mdmx-dash-empty">
          <p>No studio components yet. Build the first one from HTML + Tailwind classes.</p>
        </div>
      ) : (
        <div className="mdmx-studio-grid">
          {client.entries.map((entry) => (
            <StudioCard
              Link={host.Link}
              key={entry.def.name}
              entry={entry}
              editHref={host.hrefFor("studio", entry.def.name)}
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
  Link,
}: {
  entry: StudioEntry;
  editHref: string;
  busy: boolean;
  onDelete: () => void;
  Link: StudioHost["Link"];
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
