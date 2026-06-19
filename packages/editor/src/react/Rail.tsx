import { useMemo } from "react";
import type { EditorView } from "prosemirror-view";
import type { Schema } from "prosemirror-model";
import type { ComponentSpec, Registry } from "@imdx/core";
import { insertComponent } from "../commands.js";

export const IMDX_DRAG_MIME = "application/x-imdx-component";

function groupByCategory(components: readonly ComponentSpec[]): [string, ComponentSpec[]][] {
  const groups = new Map<string, ComponentSpec[]>();
  for (const spec of components) {
    const key = spec.category ?? "Components";
    const list = groups.get(key) ?? [];
    list.push(spec);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export interface RailProps {
  registry: Registry;
  schema: Schema;
  view: EditorView | null;
}

/** Left rail: the component palette, grouped by category. */
export function Rail({ registry, schema, view }: RailProps) {
  const groups = useMemo(() => groupByCategory(registry.components), [registry]);

  const insert = (name: string) => {
    if (!view) return;
    insertComponent(registry, schema, name)(view.state, view.dispatch);
    view.focus();
  };

  return (
    <nav className="imdx-rail" aria-label="Component palette">
      <div className="imdx-rail-title">Components</div>
      {groups.map(([category, specs]) => (
        <div key={category} className="imdx-rail-group">
          <div className="imdx-rail-group-label">{category}</div>
          {specs.map((spec) => (
            <button
              key={spec.name}
              type="button"
              className="imdx-rail-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(IMDX_DRAG_MIME, spec.name);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => insert(spec.name)}
              title={spec.description}
            >
              <span className="imdx-rail-icon" data-icon={spec.icon} aria-hidden />
              <span className="imdx-rail-name">{spec.name}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
