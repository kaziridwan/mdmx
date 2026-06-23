import { useMemo, useState } from "react";
import type { EditorView } from "prosemirror-view";
import type { Schema } from "prosemirror-model";
import type { Registry } from "@mdmx/core";
import { insertComponent } from "../commands.js";
import { filterComponents, groupByCategory } from "./rail-groups.js";
import type { Snippet } from "../snippets.js";

export const MDMX_DRAG_MIME = "application/x-mdmx-component";

export interface RailProps {
  registry: Registry;
  schema: Schema;
  view: EditorView | null;
  /** Called after a successful insert (e.g. to close the mobile palette sheet). */
  onAfterInsert?: () => void;
  /** Saved HTML snippets, shown as an extra "Snippets" group. */
  snippets?: Snippet[];
  /** Insert a saved snippet (as an `<Html>` block). */
  onInsertSnippet?: (snippet: Snippet) => void;
}

/** Left rail: the component palette — filterable, grouped by category, collapsible. */
export function Rail({
  registry,
  schema,
  view,
  onAfterInsert,
  snippets = [],
  onInsertSnippet,
}: RailProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo(
    () => groupByCategory(filterComponents(registry.components, query)),
    [registry, query],
  );

  const matchedSnippets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? snippets.filter((s) => s.name.toLowerCase().includes(q)) : snippets;
  }, [snippets, query]);

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
    <nav className="mdmx-rail" aria-label="Component palette">
      <div className="mdmx-rail-title">Components</div>
      <input
        className="mdmx-rail-filter"
        type="search"
        placeholder="Filter components…"
        aria-label="Filter components"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 ? (
        <div className="mdmx-rail-empty">No matches.</div>
      ) : (
        groups.map(([category, specs]) => {
          // A filter query auto-expands all groups so matches are visible.
          const isCollapsed = query.trim() === "" && collapsed.has(category);
          return (
            <div key={category} className="mdmx-rail-group">
              <button
                type="button"
                className="mdmx-rail-group-label"
                aria-expanded={!isCollapsed}
                onClick={() => toggle(category)}
              >
                <span className="mdmx-rail-group-chevron" aria-hidden>
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
                      className="mdmx-rail-item"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(MDMX_DRAG_MIME, spec.name);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => insert(spec.name)}
                      title={spec.description}
                    >
                      <span className="mdmx-rail-icon" data-icon={spec.icon} aria-hidden />
                      <span className="mdmx-rail-name">{spec.name}</span>
                    </button>
                  ))}
            </div>
          );
        })
      )}
      {onInsertSnippet && matchedSnippets.length > 0 ? (
        <div className="mdmx-rail-group">
          <div className="mdmx-rail-group-label mdmx-rail-group-static">Snippets</div>
          {matchedSnippets.map((snippet) => (
            <button
              key={snippet.name}
              type="button"
              className="mdmx-rail-item mdmx-rail-snippet"
              onClick={() => {
                onInsertSnippet(snippet);
                onAfterInsert?.();
              }}
              title="Insert saved HTML snippet"
            >
              <span className="mdmx-rail-icon" data-icon="code" aria-hidden />
              <span className="mdmx-rail-name">{snippet.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
