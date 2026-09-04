import { NodeSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { isPropVisible, type JsonValue, type PropSpec, type Registry } from "@mdmx/core";
import type { ComponentContext, ComponentContextEntry } from "../component-context.js";
import { effectiveProps, setPropValue } from "./prop-controls.js";
import { Control } from "./controls.js";

export interface PropPanelProps {
  view: EditorView | null;
  registry: Registry;
  /** The component being edited (selected, else the deepest around the caret). */
  context: ComponentContext | null;
}

/**
 * Right sidebar: edit the contextual component's props — one transaction each
 * (invariant 6). Follows the caret into nested blocks with a breadcrumb
 * (`Card › Tabs › Tab`), shows effective defaults, and hides props whose
 * `showIf` rule is off (ADR-058).
 */
export function PropPanel({ view, context }: PropPanelProps) {
  if (!view || !context) {
    return (
      <aside className="mdmx-props" aria-label="Properties">
        <div className="mdmx-props-label">Properties</div>
        <div className="mdmx-props-empty">Select a component to edit its props.</div>
      </aside>
    );
  }

  const { spec, node, pos } = context.target;
  const props = (node.attrs.props as Record<string, JsonValue> | undefined) ?? {};
  const effective = effectiveProps(spec, props);

  const update = (prop: PropSpec, value: JsonValue | undefined) => {
    const next = setPropValue(props, prop, value);
    // Invariant 6: one props attr → a prop edit is a single transaction.
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: next });
    // Replacing a node's markup maps a NodeSelection on it to a caret inside
    // its first child, which would hand the context to a nested block after
    // one edit. Keep the block selected; a caret inside it maps unchanged.
    const sel = view.state.selection;
    if (sel instanceof NodeSelection && sel.from === pos) {
      tr.setSelection(NodeSelection.create(tr.doc, pos));
    }
    view.dispatch(tr);
  };

  const select = (entry: ComponentContextEntry) => {
    const { doc, tr } = view.state;
    view.dispatch(tr.setSelection(NodeSelection.create(doc, entry.pos)).scrollIntoView());
    view.focus();
  };

  const visible = spec.props.filter((prop) => isPropVisible(prop, effective));

  return (
    <aside className="mdmx-props" aria-label="Properties">
      <nav className="mdmx-props-label mdmx-props-crumbs" aria-label="Component path">
        {context.ancestors.map((entry) => (
          <span key={entry.pos} className="mdmx-props-crumb-item">
            <button type="button" className="mdmx-props-crumb" onClick={() => select(entry)}>
              {entry.spec.name}
            </button>
            <span className="mdmx-props-crumb-sep" aria-hidden>
              ›
            </span>
          </span>
        ))}
        <span className="mdmx-props-crumb is-current" aria-current="true">
          {spec.name}
        </span>
      </nav>
      <div className="mdmx-props-fields">
        {visible.length === 0 ? (
          <div className="mdmx-props-empty">No editable props.</div>
        ) : null}
        {visible.map((prop) => {
          const isSet = Object.hasOwn(props, prop.name);
          const composite = prop.control.type === "list" || prop.control.type === "object";
          const Tag = composite ? "div" : "label";
          return (
            <Tag
              key={prop.name}
              className={"mdmx-prop-field" + (isSet ? "" : " is-default")}
              data-prop={prop.name}
            >
              <span className="mdmx-prop-name">
                {prop.name}
                {prop.required ? <span className="mdmx-prop-req"> *</span> : null}
                {isSet && prop.default !== undefined ? (
                  <button
                    type="button"
                    className="mdmx-prop-reset"
                    aria-label={`Reset ${prop.name} to its default`}
                    title="Reset to default"
                    onClick={(e) => {
                      e.preventDefault();
                      update(prop, undefined);
                    }}
                  >
                    ↺
                  </button>
                ) : null}
              </span>
              <Control
                control={prop.control}
                value={effective[prop.name]}
                allowEmpty={!prop.required && prop.default === undefined}
                onChange={(value) => update(prop, value)}
              />
              {prop.description ? <span className="mdmx-prop-desc">{prop.description}</span> : null}
            </Tag>
          );
        })}
      </div>
    </aside>
  );
}
