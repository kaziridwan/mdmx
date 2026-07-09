"use client";
import { createElement, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  validateStudioComponent,
  type JsonValue,
  type StudioComponentDef,
  type StudioPropDef,
  type StudioPropType,
  type TemplateElement,
} from "@mdmx/core";
import { useDashboard } from "../context.js";
import { Link } from "../shell/link.js";
import { routeHref } from "../routes.js";
import { ensureTailwindRuntime } from "../tailwind-runtime.js";
import { htmlToTemplate, templateToHtml } from "./template-html.js";
import {
  appendChild,
  activeClassIn,
  CLASS_GROUPS,
  ELEMENT_SNIPPETS,
  isElement,
  nodeAtPath,
  removeAtPath,
  setClassIn,
  updateAtPath,
  type NodePath,
} from "./template-edit.js";
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
  const [ejecting, setEjecting] = useState(false);
  const [ejectNote, setEjectNote] = useState<string | null>(null);
  // Stage 2: element selected in the preview (child-index path; [] = root).
  const [selected, setSelected] = useState<NodePath | null>(null);

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

  const sampleProps = useMemo(
    () => (candidate ? samplePropsFor(candidate) : {}),
    [candidate],
  );

  const selectedNode =
    selected !== null && conversion.template ? nodeAtPath(conversion.template, selected) : null;

  /** Apply a tree edit; the HTML pane is the tree's serialized projection. */
  const mutateTree = (fn: (root: TemplateElement) => TemplateElement) => {
    if (!conversion.template) return;
    setHtml(templateToHtml(fn(conversion.template)));
  };

  const insertSnippet = (make: () => TemplateElement) => {
    if (!conversion.template) return;
    const target =
      selected !== null && selectedNode && selectedNode.tag !== "img" ? selected : [];
    const { root, childPath } = appendChild(conversion.template, target, make());
    setHtml(templateToHtml(root));
    setSelected(childPath);
  };

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
          {editing ? (
            <button
              type="button"
              className="mdmx-dash-button"
              disabled={ejecting}
              title="Write this definition as a real defineMDMX .tsx file"
              onClick={() => {
                setEjecting(true);
                setSaveError(null);
                api
                  .ejectStudioComponent(name!)
                  .then((r) => setEjectNote(`Wrote ${r.path}. ${r.note}`))
                  .catch((err: unknown) => setSaveError((err as Error).message))
                  .finally(() => setEjecting(false));
              }}
            >
              {ejecting ? "Ejecting…" : "Eject to TSX"}
            </button>
          ) : null}
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

      {ejectNote ? <p className="mdmx-studio-eject-note">{ejectNote}</p> : null}

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

      <div className={"mdmx-studio-split" + (selectedNode ? " has-inspector" : "")}>
        <section className="mdmx-studio-source">
          <h2>HTML + Tailwind classes</h2>
          <textarea
            value={html}
            spellCheck={false}
            aria-label="Component markup"
            onChange={(e) => {
              setHtml(e.target.value);
              setSelected(null); // manual edits may invalidate element paths
            }}
          />
          <p className="mdmx-studio-hint">
            Bind props with <code>{"{props.name}"}</code> in text or attribute values.
          </p>
        </section>
        <section className="mdmx-studio-preview">
          <h2>Preview — click an element to inspect</h2>
          <div className="mdmx-studio-palette" role="toolbar" aria-label="Insert element">
            {ELEMENT_SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                type="button"
                className="mdmx-dash-button"
                disabled={!conversion.template}
                title={
                  selectedNode
                    ? `Insert into the selected <${selectedNode.tag}>`
                    : "Insert into the root element"
                }
                onClick={() => insertSnippet(snippet.make)}
              >
                + {snippet.label}
              </button>
            ))}
          </div>
          <div className="mdmx-studio-preview-stage">
            {conversion.template && templateProblems.length === 0 ? (
              <PreviewTree
                el={conversion.template}
                path={[]}
                props={sampleProps}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <p className="mdmx-studio-preview-empty">Fix the problems below to preview.</p>
            )}
          </div>
        </section>
        {selectedNode && selected !== null ? (
          <Inspector
            node={selectedNode}
            path={selected}
            props={propRows}
            onChange={(updater) => mutateTree((root) => updateAtPath(root, selected, updater))}
            onDelete={() => {
              mutateTree((root) => removeAtPath(root, selected));
              setSelected(null);
            }}
            onClose={() => setSelected(null)}
          />
        ) : null}
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

const INTERPOLATION_RE = /\{props\.([A-Za-z0-9]+)\}/g;
const VOID_TAGS = new Set(["br", "hr", "img"]);

function interpolate(value: string, props: Record<string, JsonValue>): string {
  return value.replace(INTERPOLATION_RE, (_, name: string) => {
    const v = props[name];
    return v == null ? "" : String(v);
  });
}

function samePath(a: NodePath, b: NodePath | null): boolean {
  return b !== null && a.length === b.length && a.every((v, i) => v === b[i]);
}

/** The live preview: the template tree rendered with click-to-select paths. */
function PreviewTree({
  el,
  path,
  props,
  selected,
  onSelect,
}: {
  el: TemplateElement;
  path: NodePath;
  props: Record<string, JsonValue>;
  selected: NodePath | null;
  onSelect: (path: NodePath) => void;
}) {
  const attrs: Record<string, unknown> = {
    onClick: (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(path);
    },
  };
  if (samePath(path, selected)) attrs["data-studio-selected"] = "true";
  if (el.classes) attrs.className = el.classes;
  for (const [name, value] of Object.entries(el.attrs ?? {})) {
    attrs[name] = interpolate(value, props);
  }
  if (VOID_TAGS.has(el.tag)) return createElement(el.tag, attrs);
  const children = (el.children ?? []).map((child, i) => {
    if (isElement(child)) {
      return (
        <PreviewTree
          key={i}
          el={child}
          path={[...path, i]}
          props={props}
          selected={selected}
          onSelect={onSelect}
        />
      );
    }
    if ("text" in child) return interpolate(child.text, props);
    const v = props[child.slot];
    return v == null ? null : String(v);
  });
  return createElement(el.tag, attrs, ...children);
}

/** Right-hand inspector for the selected element: classes, quick controls,
    text/prop binding, link/image attributes. Everything writes classes or
    tree edits — the HTML pane re-serializes from the same tree. */
function Inspector({
  node,
  path,
  props,
  onChange,
  onDelete,
  onClose,
}: {
  node: TemplateElement;
  path: NodePath;
  props: readonly StudioPropDef[];
  onChange: (updater: (el: TemplateElement) => TemplateElement) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const children = node.children ?? [];
  const onlyChild = children.length === 1 ? children[0] : undefined;
  const editableText =
    children.length === 0 || (onlyChild !== undefined && !isElement(onlyChild));
  const textValue =
    onlyChild !== undefined && "text" in onlyChild ? onlyChild.text : "";
  const boundSlot = onlyChild !== undefined && "slot" in onlyChild ? onlyChild.slot : "";

  const setAttr = (name: string, value: string) =>
    onChange((el) => {
      const attrs = { ...el.attrs };
      if (value === "") delete attrs[name];
      else attrs[name] = value;
      return { ...el, ...(Object.keys(attrs).length ? { attrs } : { attrs: undefined }) };
    });

  return (
    <aside className="mdmx-studio-inspector" aria-label="Element inspector">
      <div className="mdmx-studio-inspector-head">
        <code>&lt;{node.tag}&gt;</code>
        <div className="mdmx-studio-inspector-actions">
          {path.length > 0 ? (
            <button type="button" className="mdmx-dash-button mdmx-dash-button-ghost" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <button type="button" className="mdmx-dash-button mdmx-dash-button-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <label className="mdmx-studio-field">
        <span>Classes</span>
        <textarea
          rows={3}
          value={node.classes ?? ""}
          spellCheck={false}
          onChange={(e) =>
            onChange((el) => ({
              ...el,
              classes: e.target.value.trim() === "" ? undefined : e.target.value,
            }))
          }
        />
      </label>

      <div className="mdmx-studio-quick">
        {CLASS_GROUPS.map((group) => (
          <label key={group.label} className="mdmx-studio-field">
            <span>{group.label}</span>
            <select
              value={activeClassIn(node.classes, group) ?? ""}
              onChange={(e) =>
                onChange((el) => {
                  const next = setClassIn(el.classes, group, e.target.value);
                  return { ...el, classes: next === "" ? undefined : next };
                })
              }
            >
              <option value="">—</option>
              {group.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {editableText ? (
        <>
          <label className="mdmx-studio-field">
            <span>Bind text to prop</span>
            <select
              value={boundSlot}
              onChange={(e) =>
                onChange((el) => ({
                  ...el,
                  children: e.target.value
                    ? [{ slot: e.target.value }]
                    : textValue
                      ? [{ text: textValue }]
                      : undefined,
                }))
              }
            >
              <option value="">plain text</option>
              {props
                .filter((p) => p.name)
                .map((p) => (
                  <option key={p.name} value={p.name}>
                    {`{props.${p.name}}`}
                  </option>
                ))}
            </select>
          </label>
          {boundSlot === "" ? (
            <label className="mdmx-studio-field">
              <span>Text</span>
              <textarea
                rows={2}
                value={textValue}
                onChange={(e) =>
                  onChange((el) => ({
                    ...el,
                    children: e.target.value === "" ? undefined : [{ text: e.target.value }],
                  }))
                }
              />
            </label>
          ) : null}
        </>
      ) : null}

      {node.tag === "a" ? (
        <label className="mdmx-studio-field">
          <span>href</span>
          <input
            type="text"
            value={node.attrs?.href ?? ""}
            onChange={(e) => setAttr("href", e.target.value)}
          />
        </label>
      ) : null}
      {node.tag === "img" ? (
        <>
          <label className="mdmx-studio-field">
            <span>src</span>
            <input
              type="text"
              value={node.attrs?.src ?? ""}
              onChange={(e) => setAttr("src", e.target.value)}
            />
          </label>
          <label className="mdmx-studio-field">
            <span>alt</span>
            <input
              type="text"
              value={node.attrs?.alt ?? ""}
              onChange={(e) => setAttr("alt", e.target.value)}
            />
          </label>
        </>
      ) : null}
    </aside>
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
