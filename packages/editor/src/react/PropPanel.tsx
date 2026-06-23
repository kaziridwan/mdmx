import { NodeSelection, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { JsonValue, PropSpec, Registry } from "@mdmx/core";
import { componentNameFromNode } from "../schema.js";
import { setPropValue } from "./prop-controls.js";
import { Control } from "./controls.js";

export interface PropPanelProps {
  view: EditorView | null;
  state: EditorState | null;
  registry: Registry;
}

/** Right sidebar: edit the selected component's props (one transaction each). */
export function PropPanel({ view, state, registry }: PropPanelProps) {
  const selected = selectedComponent(state, registry);

  if (!view || !selected) {
    return (
      <aside className="mdmx-props" aria-label="Properties">
        <div className="mdmx-props-label">Properties</div>
        <div className="mdmx-props-empty">Select a component to edit its props.</div>
      </aside>
    );
  }

  const { spec, props, pos, attrs } = selected;

  const update = (prop: PropSpec, raw: string) => {
    const next = setPropValue(props, prop, raw);
    // Invariant 6: one props attr → a prop edit is a single transaction.
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...attrs, props: next });
    view.dispatch(tr);
  };

  return (
    <aside className="mdmx-props" aria-label="Properties">
      <div className="mdmx-props-label">{spec.name}</div>
      <div className="mdmx-props-fields">
        {spec.props.map((prop) => (
          <label key={prop.name} className="mdmx-prop-field">
            <span className="mdmx-prop-name">
              {prop.name}
              {prop.required ? <span className="mdmx-prop-req"> *</span> : null}
            </span>
            <Control control={prop.control} value={props[prop.name]} onChange={(raw) => update(prop, raw)} />
            {prop.description ? <span className="mdmx-prop-desc">{prop.description}</span> : null}
          </label>
        ))}
      </div>
    </aside>
  );
}

interface Selected {
  spec: import("@mdmx/core").ComponentSpec;
  props: Record<string, JsonValue>;
  pos: number;
  attrs: Record<string, unknown>;
}

function selectedComponent(state: EditorState | null, registry: Registry): Selected | null {
  if (!state) return null;
  const sel = state.selection;
  if (!(sel instanceof NodeSelection)) return null;
  const name = componentNameFromNode(sel.node.type.name);
  const spec = name ? registry.get(name) : undefined;
  if (!spec) return null;
  return {
    spec,
    props: (sel.node.attrs.props as Record<string, JsonValue>) ?? {},
    pos: sel.from,
    attrs: sel.node.attrs,
  };
}

