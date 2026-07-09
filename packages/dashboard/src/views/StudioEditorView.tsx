"use client";
import { useEffect, useMemo, useState } from "react";
import {
  validateStudioComponent,
  type StudioComponentDef,
  type StudioPropDef,
  type StudioPropType,
} from "@mdmx/core";
import { studioComponent } from "@mdmx/next/render";
import { useDashboard } from "../context.js";
import { Link } from "../shell/link.js";
import { routeHref } from "../routes.js";
import { ensureTailwindRuntime } from "../tailwind-runtime.js";
import { htmlToTemplate, templateToHtml } from "./template-html.js";
import { samplePropsFor } from "./StudioView.js";

const STARTER_HTML = `<section class="p-8 rounded-2xl bg-slate-900 text-white flex flex-col gap-3">
  <h2 class="text-2xl font-semibold tracking-tight">{props.title}</h2>
  <p class="text-slate-300">{props.body}</p>
</section>`;

const STARTER_PROPS: StudioPropDef[] = [
  { name: "title", type: "string", required: true },
  { name: "body", type: "string" },
];

interface PropRow extends StudioPropDef {
  /** Stable key for React while the name is being typed. */
  key: number;
}

/**
 * Stage-1 studio editor (ADR road-to-0.4.1): HTML source + Tailwind classes
 * on the left, live preview on the right, prop schema below. The stored
 * definition is the sanitized template tree — the HTML pane is just its
 * editable projection, so everything the parser drops is reported next to
 * the preview.
 */
export function StudioEditorView({ name }: { name?: string }) {
  const { config, api, studio } = useDashboard();
  const editing = name !== undefined;
  const entry = editing ? studio.entries.find((e) => e.def.name === name) : undefined;

  const [componentName, setComponentName] = useState(name ?? "");
  const [description, setDescription] = useState("");
  const [html, setHtml] = useState(STARTER_HTML);
  const [propRows, setPropRows] = useState<PropRow[]>(() =>
    STARTER_PROPS.map((p, i) => ({ ...p, key: i })),
  );
  const [nextKey, setNextKey] = useState(STARTER_PROPS.length);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Populate the form once the stored definition is available.
  useEffect(() => {
    if (!entry || loadedFrom === entry.sha) return;
    setComponentName(entry.def.name);
    setDescription(entry.def.description ?? "");
    setHtml(templateToHtml(entry.def.template));
    setPropRows(entry.def.props.map((p, i) => ({ ...p, key: i })));
    setNextKey(entry.def.props.length);
    setLoadedFrom(entry.sha);
  }, [entry, loadedFrom]);

  // Tailwind runtime for the live preview (idempotent).
  useEffect(() => {
    ensureTailwindRuntime(config.tailwindSrc);
  }, [config.tailwindSrc]);

  const conversion = useMemo(() => htmlToTemplate(html), [html]);

  const candidate = useMemo<StudioComponentDef | null>(() => {
    if (!conversion.template) return null;
    const props: StudioPropDef[] = propRows.map((r) => ({
      name: r.name,
      type: r.type,
      ...(r.required ? { required: true } : {}),
      ...(r.default !== undefined ? { default: r.default } : {}),
      ...(r.description ? { description: r.description } : {}),
    }));
    return {
      mdmxStudioVersion: 1,
      name: componentName,
      ...(description.trim() ? { description: description.trim() } : {}),
      props,
      template: conversion.template,
    };
  }, [conversion.template, componentName, description, propRows]);

  const validation = useMemo(() => {
    if (!candidate) return ["markup needs at least one element"];
    const taken = new Set(
      studio.entries.map((e) => e.def.name).filter((n) => n !== (editing ? name : undefined)),
    );
    return validateStudioComponent(candidate, taken);
  }, [candidate, studio.entries, editing, name]);

  // The preview only needs a sound template + props — an unnamed component
  // still previews while you're sketching it.
  const templateProblems = useMemo(() => {
    if (!candidate) return ["markup needs at least one element"];
    return validateStudioComponent({ ...candidate, name: "PreviewComponent" });
  }, [candidate]);

  const Preview = useMemo(
    () => (candidate && templateProblems.length === 0 ? studioComponent(candidate) : null),
    [candidate, templateProblems],
  );

  const onSave = async () => {
    if (!candidate || validation.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.saveStudioComponent({
        def: candidate,
        expectedSha: editing ? (entry?.sha ?? null) : null,
      });
      await studio.refresh();
      window.location.assign(routeHref(config.mountPath, "studio"));
    } catch (err) {
      setSaveError((err as Error).message);
      setSaving(false);
    }
  };

  if (editing && !entry) {
    return (
      <div className="mdmx-dash-view">
        <div className="mdmx-dash-empty">
          <p>
            No studio component named <code>{name}</code> (still loading, or deleted).
          </p>
          <Link className="mdmx-dash-button" href={routeHref(config.mountPath, "studio")}>
            Back to studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mdmx-dash-view mdmx-studio-editor">
      <header className="mdmx-dash-view-head">
        <div>
          <Link className="mdmx-toolbar-back" href={routeHref(config.mountPath, "studio")}>
            ← Studio
          </Link>
          <h1>{editing ? `Edit ${name}` : "New component"}</h1>
        </div>
        <div className="mdmx-studio-savebar">
          {saveError ? <span className="mdmx-dash-error">{saveError}</span> : null}
          <button
            type="button"
            className="mdmx-dash-button mdmx-dash-button-primary"
            disabled={saving || validation.length > 0}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : "Save component"}
          </button>
        </div>
      </header>

      <div className="mdmx-studio-form-row">
        <label className="mdmx-studio-field">
          <span>Name</span>
          <input
            type="text"
            value={componentName}
            placeholder="PromoCard"
            disabled={editing}
            onChange={(e) => setComponentName(e.target.value)}
          />
        </label>
        <label className="mdmx-studio-field mdmx-studio-field-grow">
          <span>Description</span>
          <input
            type="text"
            value={description}
            placeholder="What this component is for"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      <div className="mdmx-studio-split">
        <section className="mdmx-studio-source">
          <h2>HTML + Tailwind classes</h2>
          <textarea
            value={html}
            spellCheck={false}
            aria-label="Component markup"
            onChange={(e) => setHtml(e.target.value)}
          />
          <p className="mdmx-studio-hint">
            Bind props with <code>{"{props.name}"}</code> in text or attribute values.
          </p>
        </section>
        <section className="mdmx-studio-preview">
          <h2>Preview</h2>
          <div className="mdmx-studio-preview-stage">
            {Preview && candidate ? (
              <Preview {...samplePropsFor(candidate)} />
            ) : (
              <p className="mdmx-studio-preview-empty">Fix the problems below to preview.</p>
            )}
          </div>
        </section>
      </div>

      {conversion.problems.length > 0 || validation.length > 0 ? (
        <div className="mdmx-studio-problems">
          {validation.map((p, i) => (
            <p key={`v${i}`} className="mdmx-dash-error">
              {p}
            </p>
          ))}
          {conversion.problems.map((p, i) => (
            <p key={`c${i}`} className="mdmx-studio-warning">
              {p}
            </p>
          ))}
        </div>
      ) : null}

      <section className="mdmx-studio-props">
        <div className="mdmx-studio-props-head">
          <h2>Props</h2>
          <button
            type="button"
            className="mdmx-dash-button"
            onClick={() => {
              setPropRows((rows) => [...rows, { key: nextKey, name: "", type: "string" }]);
              setNextKey((k) => k + 1);
            }}
          >
            Add prop
          </button>
        </div>
        {propRows.map((row) => (
          <PropRowEditor
            key={row.key}
            row={row}
            onChange={(patch) =>
              setPropRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, ...patch } : r)))
            }
            onRemove={() => setPropRows((rows) => rows.filter((r) => r.key !== row.key))}
          />
        ))}
      </section>
    </div>
  );
}

function PropRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: PropRow;
  onChange: (patch: Partial<StudioPropDef>) => void;
  onRemove: () => void;
}) {
  const setDefault = (raw: string) => {
    if (raw === "") return onChange({ default: undefined });
    if (row.type === "number") {
      const n = Number(raw);
      return onChange({ default: Number.isFinite(n) ? n : undefined });
    }
    if (row.type === "boolean") return onChange({ default: raw === "true" });
    onChange({ default: raw });
  };

  return (
    <div className="mdmx-studio-prop-row">
      <input
        type="text"
        value={row.name}
        placeholder="propName"
        aria-label="Prop name"
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <select
        value={row.type}
        aria-label="Prop type"
        onChange={(e) => onChange({ type: e.target.value as StudioPropType, default: undefined })}
      >
        <option value="string">string</option>
        <option value="number">number</option>
        <option value="boolean">boolean</option>
      </select>
      <label className="mdmx-studio-prop-required">
        <input
          type="checkbox"
          checked={row.required === true}
          onChange={(e) => onChange({ required: e.target.checked || undefined })}
        />
        required
      </label>
      {row.type === "boolean" ? (
        <select
          value={row.default === undefined ? "" : String(row.default)}
          aria-label="Default value"
          onChange={(e) => setDefault(e.target.value)}
        >
          <option value="">no default</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type={row.type === "number" ? "number" : "text"}
          value={row.default === undefined ? "" : String(row.default)}
          placeholder="default"
          aria-label="Default value"
          onChange={(e) => setDefault(e.target.value)}
        />
      )}
      <button type="button" className="mdmx-dash-button mdmx-dash-button-ghost" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
