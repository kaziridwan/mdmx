import { useMemo, useState } from "react";
import type { EditorView } from "prosemirror-view";
import type { Schema } from "prosemirror-model";
import type { Registry } from "@imdx/core";
import { insertComponent } from "../commands.js";
import { filterComponents, groupByCategory } from "./rail-groups.js";

export const IMDX_DRAG_MIME = "application/x-imdx-component";

export interface RailProps {
  registry: Registry;
  schema: Schema;
  view: EditorView | null;
  /** Called after a successful insert (e.g. to close the mobile palette sheet). */
  onAfterInsert?: () => void;
}

/** Left rail: the component palette — filterable, grouped by category, collapsible. */
export function Rail({ registry, schema, view, onAfterInsert }: RailProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo(
    () => groupByCategory(filterComponents(registry.components, query)),
    [registry, query],
  );

  const insert = (name: string) => {
    if (!view) return;
    insertComponent(registry, schema, name)(view.state, view.dispatch);
    view.focus();
    onAfterInsert?.();
  };

  const toggle = (category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <nav className="imdx-rail" aria-label="Component palette">
      <div className="imdx-rail-title">Components</div>
      <input
        className="imdx-rail-filter"
        type="search"
        placeholder="Filter components…"
        aria-label="Filter components"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 ? (
        <div className="imdx-rail-empty">No matches.</div>
      ) : (
        groups.map(([category, specs]) => {
          // A filter query auto-expands all groups so matches are visible.
          const isCollapsed = query.trim() === "" && collapsed.has(category);
          return (
            <div key={category} className="imdx-rail-group">
              <button
                type="button"
                className="imdx-rail-group-label"
                aria-expanded={!isCollapsed}
                onClick={() => toggle(category)}
              >
                <span className="imdx-rail-group-chevron" aria-hidden>
                  {isCollapsed ? "▸" : "▾"}
                </span>
                {category}
              </button>
              {isCollapsed
                ? null
                : specs.map((spec) => (
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
          );
        })
      )}
    </nav>
  );
}
