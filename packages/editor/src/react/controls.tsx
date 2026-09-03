import type { ControlSpec, JsonValue } from "@mdmx/core";
import { coerceControlValue, displayControlValue, emptyValueFor } from "./prop-controls.js";
import { isImagePath } from "./media.js";
import { useMediaPicker } from "./media-context.js";

export interface ControlProps {
  control: ControlSpec;
  value: JsonValue | undefined;
  /** Receives the typed value; `undefined` means "unset" (the key is dropped). */
  onChange: (value: JsonValue | undefined) => void;
  /** `select` only: offer the empty (`—`) option. Off when a default applies. */
  allowEmpty?: boolean;
}

type ListSpec = Extract<ControlSpec, { type: "list" }>;
type ObjectSpec = Extract<ControlSpec, { type: "object" }>;

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * A single typed input for a `ControlSpec`, shared by the component prop panel
 * and the document frontmatter panel. Value-typed (ADR-058): scalars coerce
 * through `coerceControlValue` here, `list`/`object` compose `Control`
 * recursively, so callers only ever see JSON values.
 */
export function Control({ control, value, onChange, allowEmpty = true }: ControlProps) {
  const v = displayControlValue(value, control);
  // Hook must run unconditionally (rules of hooks); only the image case uses it.
  const requestMedia = useMediaPicker();
  const emit = (raw: string) => onChange(coerceControlValue(control, raw));

  switch (control.type) {
    case "list":
      return <ListControl control={control} value={value} onChange={onChange} />;
    case "object":
      return <ObjectControl control={control} value={value} onChange={onChange} />;
    case "multiselect": {
      const selected = Array.isArray(value) ? value.map((x) => String(x)) : [];
      return (
        <select
          multiple
          className="mdmx-control mdmx-control-multiselect"
          value={selected}
          onChange={(e) => {
            const next = Array.from(e.target.selectedOptions, (o) => o.value);
            onChange(next.length > 0 ? next : undefined);
          }}
        >
          {control.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    case "image":
      return (
        <div className="mdmx-control-image">
          <input
            type="text"
            className="mdmx-control"
            value={v}
            placeholder="path or URL"
            onChange={(e) => emit(e.target.value)}
          />
          {requestMedia ? (
            <button
              type="button"
              className="mdmx-control-browse"
              onClick={() => requestMedia((item) => onChange(item.url))}
            >
              Browse…
            </button>
          ) : null}
          {v && isImagePath(v) ? (
            <img className="mdmx-control-preview" src={v} alt="" />
          ) : null}
        </div>
      );
    case "select":
      return (
        <select className="mdmx-control" value={v} onChange={(e) => emit(e.target.value)}>
          {allowEmpty ? <option value="">—</option> : null}
          {control.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <input
          type="checkbox"
          className="mdmx-control mdmx-control-checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          className="mdmx-control"
          value={v}
          min={control.min}
          max={control.max}
          step={control.step}
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "textarea":
    case "json":
      return (
        <textarea
          className="mdmx-control mdmx-control-textarea"
          value={v}
          rows={3}
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "color":
      return (
        <div className="mdmx-control-color">
          <input
            type="color"
            aria-label="Pick a color"
            value={HEX_RE.test(v) ? v : "#000000"}
            onChange={(e) => emit(e.target.value)}
          />
          <input
            type="text"
            className="mdmx-control"
            value={v}
            placeholder="#rrggbb or any CSS color"
            onChange={(e) => emit(e.target.value)}
          />
        </div>
      );
    case "date":
      return (
        <input
          type="date"
          className="mdmx-control"
          value={v}
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "link":
      return (
        <input
          type="text"
          inputMode="url"
          className="mdmx-control mdmx-control-link"
          value={v}
          placeholder={control.placeholder ?? "/path or https://…"}
          onChange={(e) => emit(e.target.value)}
        />
      );
    default:
      return (
        <input
          type="text"
          className="mdmx-control"
          value={v}
          placeholder={"placeholder" in control ? control.placeholder : undefined}
          onChange={(e) => emit(e.target.value)}
        />
      );
  }
}

/** Rows of the item control with add / remove / reorder. Empty list → unset. */
function ListControl({
  control,
  value,
  onChange,
}: {
  control: ListSpec;
  value: JsonValue | undefined;
  onChange: (value: JsonValue | undefined) => void;
}) {
  const items: JsonValue[] = Array.isArray(value) ? value : [];
  const commit = (next: JsonValue[]) => onChange(next.length > 0 ? next : undefined);
  const setAt = (i: number, item: JsonValue | undefined) =>
    commit(items.map((cur, j) => (j === i ? (item === undefined ? emptyValueFor(control.item) : item) : cur)));
  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    commit(next);
  };
  return (
    <div className="mdmx-control-list" role="group">
      {items.map((item, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="mdmx-control-list-row">
          <div className="mdmx-control-list-value">
            <Control control={control.item} value={item} onChange={(next) => setAt(i, next)} />
          </div>
          <div className="mdmx-control-list-actions">
            <button type="button" aria-label="Move item up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button
              type="button"
              aria-label="Move item down"
              title="Move down"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Remove item"
              title="Remove"
              onClick={() => commit(items.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="mdmx-control-list-add"
        onClick={() => commit([...items, emptyValueFor(control.item)])}
      >
        + Add item
      </button>
    </div>
  );
}

/** One control per declared field; a field emitting `undefined` drops its key. Empty object → unset. */
function ObjectControl({
  control,
  value,
  onChange,
}: {
  control: ObjectSpec;
  value: JsonValue | undefined;
  onChange: (value: JsonValue | undefined) => void;
}) {
  const obj: Record<string, JsonValue> =
    value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  const setField = (key: string, next: JsonValue | undefined) => {
    const out = { ...obj };
    if (next === undefined) delete out[key];
    else out[key] = next;
    onChange(Object.keys(out).length > 0 ? out : undefined);
  };
  return (
    <div className="mdmx-control-object" role="group">
      {Object.entries(control.fields).map(([key, field]) => {
        const composite = field.type === "list" || field.type === "object";
        const Tag = composite ? "div" : "label";
        return (
          <Tag key={key} className="mdmx-control-object-field">
            <span className="mdmx-control-object-key">{key}</span>
            <Control control={field} value={obj[key]} onChange={(next) => setField(key, next)} />
          </Tag>
        );
      })}
    </div>
  );
}
