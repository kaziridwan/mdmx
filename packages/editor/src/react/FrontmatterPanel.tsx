import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import {
  parseFrontmatter,
  stringifyFrontmatter,
  type CollectionSpec,
  type FrontmatterField,
  type JsonValue,
} from "@mdmx/core";
import { coerceControlValue } from "./prop-controls.js";
import { Control } from "./controls.js";

export interface FrontmatterPanelProps {
  view: EditorView | null;
  state: EditorState | null;
  /** The collection schema for the current document, if any. */
  collection?: CollectionSpec;
}

/**
 * Document-level panel: edit the collection's typed frontmatter fields. Each
 * edit re-serializes the whole frontmatter object to canonical YAML and writes
 * it to the doc node's `frontmatter` attr in one transaction (setDocAttribute),
 * so the live source updates and the change is a minimal diff.
 */
export function FrontmatterPanel({ view, state, collection }: FrontmatterPanelProps) {
  if (!view || !state || !collection) {
    return (
      <aside className="mdmx-props" aria-label="Document">
        <div className="mdmx-props-label">Document</div>
        <div className="mdmx-props-empty">No collection schema for this document.</div>
      </aside>
    );
  }

  const raw = (state.doc.attrs.frontmatter as string | null) ?? "";
  const frontmatter = parseFrontmatter(raw);
  const fieldOrder = collection.fields.map((f) => f.name);

  const update = (field: FrontmatterField, rawValue: string) => {
    const value = coerceControlValue(field.control, rawValue);
    const next: Record<string, JsonValue> = { ...frontmatter };
    if (value === undefined) delete next[field.name];
    else next[field.name] = value;
    const yaml = stringifyFrontmatter(next, fieldOrder);
    view.dispatch(view.state.tr.setDocAttribute("frontmatter", yaml === "" ? null : yaml));
  };

  return (
    <aside className="mdmx-props" aria-label="Document">
      <div className="mdmx-props-label">Document · {collection.name}</div>
      <div className="mdmx-props-fields">
        {collection.fields.map((field) => (
          <label key={field.name} className="mdmx-prop-field">
            <span className="mdmx-prop-name">
              {field.name}
              {field.required ? <span className="mdmx-prop-req"> *</span> : null}
            </span>
            <Control
              control={field.control}
              value={frontmatter[field.name]}
              onChange={(rawValue) => update(field, rawValue)}
            />
            {field.description ? (
              <span className="mdmx-prop-desc">{field.description}</span>
            ) : null}
          </label>
        ))}
      </div>
    </aside>
  );
}
