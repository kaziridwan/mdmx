"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useDashboard } from "../context.js";
import { routeHref } from "../routes.js";
import {
  BUILDER_CONTROL_TYPES,
  draftsToFields,
  emptyDraft,
  fieldsToDrafts,
  type FieldDraft,
} from "./field-draft.js";

/**
 * Create a collection, or edit an existing one's field schema. Both write
 * `mdmx.config.json` through the API (config-as-code, ADR-035); the sidebar
 * refreshes from the response.
 */
export function CollectionFormView({ editName }: { editName?: string }) {
  const { config, api, collections, refreshCollections } = useDashboard();
  const editing = editName ? collections.find((c) => c.name === editName) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [dir, setDir] = useState(editing?.dir ?? "");
  const [drafts, setDrafts] = useState<FieldDraft[]>(() =>
    editing ? fieldsToDrafts(editing.fields) : [emptyDraft()],
  );
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const effectiveDir = useMemo(() => {
    if (editing) return editing.dir;
    return dir.trim() || (name.trim() ? `${config.contentDir}/${name.trim()}` : "");
  }, [editing, dir, name, config.contentDir]);

  if (editName && !editing) {
    return (
      <div className="mdmx-dash-view">
        <div className="mdmx-dash-empty">
          <p>
            No collection named <code>{editName}</code>.
          </p>
        </div>
      </div>
    );
  }

  const update = (id: number, patch: Partial<FieldDraft>) => {
    setDrafts((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const remove = (id: number) => setDrafts((all) => all.filter((d) => d.id !== id));
  const move = (id: number, delta: -1 | 1) => {
    setDrafts((all) => {
      const i = all.findIndex((d) => d.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= all.length) return all;
      const next = [...all];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const { fields, problems: fieldProblems } = draftsToFields(drafts);
    if (fieldProblems.length > 0) {
      setProblems(fieldProblems);
      return;
    }
    setBusy(true);
    setProblems([]);
    try {
      if (editing) {
        await api.updateCollection(editing.name, fields);
      } else {
        await api.createCollection({
          name: name.trim(),
          ...(dir.trim() ? { dir: dir.trim() } : {}),
          fields,
        });
      }
      await refreshCollections();
      window.location.assign(
        routeHref(config.mountPath, "collections", editing ? editing.name : name.trim()),
      );
    } catch (err) {
      setBusy(false);
      const body = err as Error & { problems?: string[] };
      setProblems(body.problems ?? [body.message]);
    }
  };

  return (
    <div className="mdmx-dash-view">
      <header className="mdmx-dash-view-head">
        <h1>{editing ? `Edit ${editing.name}` : "New collection"}</h1>
      </header>

      <form className="mdmx-dash-form" onSubmit={(e) => void onSubmit(e)}>
        <div className="mdmx-dash-form-row">
          <label className="mdmx-dash-field">
            <span>Name</span>
            <input
              className="mdmx-dash-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="posts"
              disabled={Boolean(editing)}
              required={!editing}
              pattern="[a-z0-9][a-z0-9_-]*"
              title="lowercase alphanumeric, - or _"
            />
          </label>
          <label className="mdmx-dash-field">
            <span>Directory</span>
            <input
              className="mdmx-dash-input"
              value={editing ? editing.dir : dir}
              onChange={(e) => setDir(e.target.value)}
              placeholder={effectiveDir || `${config.contentDir}/…`}
              disabled={Boolean(editing)}
            />
            <span className="mdmx-dash-field-hint">
              {editing
                ? "Renaming a directory moves committed files — edit content paths in git."
                : `Must live under ${config.contentDir}/`}
            </span>
          </label>
        </div>

        <fieldset className="mdmx-dash-fieldset">
          <legend>Frontmatter fields</legend>
          {drafts.length === 0 ? (
            <p className="mdmx-dash-hint">No fields — entries get free-form frontmatter.</p>
          ) : null}
          {drafts.map((draft, i) => (
            <FieldRow
              key={draft.id}
              draft={draft}
              first={i === 0}
              last={i === drafts.length - 1}
              onChange={(patch) => update(draft.id, patch)}
              onRemove={() => remove(draft.id)}
              onMove={(delta) => move(draft.id, delta)}
            />
          ))}
          <button
            type="button"
            className="mdmx-dash-button"
            onClick={() => setDrafts((all) => [...all, emptyDraft()])}
          >
            Add field
          </button>
        </fieldset>

        {problems.length > 0 ? (
          <ul className="mdmx-dash-problems">
            {problems.map((p) => (
              <li key={p} className="mdmx-dash-error">
                {p}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mdmx-dash-form-actions">
          <button
            type="submit"
            className="mdmx-dash-button mdmx-dash-button-primary"
            disabled={busy || (!editing && name.trim().length === 0)}
          >
            {busy ? "Saving…" : editing ? "Save fields" : "Create collection"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldRow({
  draft,
  first,
  last,
  onChange,
  onRemove,
  onMove,
}: {
  draft: FieldDraft;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<FieldDraft>) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const needsOptions = draft.type === "select" || draft.type === "multiselect";
  const hasDefault =
    draft.type !== "advanced" &&
    ["text", "textarea", "number", "boolean", "select", "json"].includes(draft.type);

  return (
    <div className="mdmx-dash-field-row">
      <input
        className="mdmx-dash-input"
        value={draft.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="field name"
        aria-label="Field name"
      />

      {draft.type === "advanced" ? (
        <span className="mdmx-dash-badge" title="Nested control (list/object) — edit in mdmx.config.json">
          {draft.advancedControl?.type ?? "advanced"}
        </span>
      ) : (
        <select
          className="mdmx-dash-input mdmx-dash-select"
          value={draft.type}
          onChange={(e) => onChange({ type: e.target.value as FieldDraft["type"] })}
          aria-label="Control type"
        >
          {BUILDER_CONTROL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      {needsOptions ? (
        <input
          className="mdmx-dash-input"
          value={draft.options}
          onChange={(e) => onChange({ options: e.target.value })}
          placeholder="option, option, …"
          aria-label="Options (comma-separated)"
        />
      ) : null}

      {hasDefault ? (
        <input
          className="mdmx-dash-input mdmx-dash-input-default"
          value={draft.defaultValue}
          onChange={(e) => onChange({ defaultValue: e.target.value })}
          placeholder="default"
          aria-label="Default value"
        />
      ) : null}

      <label className="mdmx-dash-check">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        <span>required</span>
      </label>

      <div className="mdmx-dash-field-row-actions">
        <button type="button" className="mdmx-dash-button mdmx-dash-button-ghost" onClick={() => onMove(-1)} disabled={first} aria-label="Move field up">
          ↑
        </button>
        <button type="button" className="mdmx-dash-button mdmx-dash-button-ghost" onClick={() => onMove(1)} disabled={last} aria-label="Move field down">
          ↓
        </button>
        <button type="button" className="mdmx-dash-button mdmx-dash-button-ghost mdmx-dash-danger-hover" onClick={onRemove} aria-label={`Remove field ${draft.name || ""}`}>
          ✕
        </button>
      </div>
    </div>
  );
}
