import type { ControlSpec, JsonValue } from "@imdx/core";
import { displayControlValue } from "./prop-controls.js";
import { isImagePath } from "./media.js";
import { useMediaPicker } from "./media-context.js";

/**
 * A single typed input for a `ControlSpec`, shared by the component prop panel
 * and the document frontmatter panel. `onChange` receives the raw input string;
 * callers coerce it via `coerceControlValue`.
 */
export function Control({
  control,
  value,
  onChange,
}: {
  control: ControlSpec;
  value: JsonValue | undefined;
  onChange: (raw: string) => void;
}) {
  const v = displayControlValue(value);
  // Hook must run unconditionally (rules of hooks); only the image case uses it.
  const requestMedia = useMediaPicker();
  switch (control.type) {
    case "image":
      return (
        <div className="imdx-control-image">
          <input
            type="text"
            className="imdx-control"
            value={v}
            placeholder="path or URL"
            onChange={(e) => onChange(e.target.value)}
          />
          {requestMedia ? (
            <button
              type="button"
              className="imdx-control-browse"
              onClick={() => requestMedia((item) => onChange(item.url))}
            >
              Browse…
            </button>
          ) : null}
          {v && isImagePath(v) ? (
            <img className="imdx-control-preview" src={v} alt="" />
          ) : null}
        </div>
      );
    case "select":
      return (
        <select className="imdx-control" value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
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
          className="imdx-control imdx-control-checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
      );
    case "number":
      return (
        <input
          type="number"
          className="imdx-control"
          value={v}
          min={control.min}
          max={control.max}
          step={control.step}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
    case "json":
      return (
        <textarea
          className="imdx-control imdx-control-textarea"
          value={v}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          type="text"
          className="imdx-control"
          value={v}
          placeholder={"placeholder" in control ? control.placeholder : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
