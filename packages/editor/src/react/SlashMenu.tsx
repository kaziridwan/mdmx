import { useCallback, useEffect, useMemo, useState } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Schema } from "prosemirror-model";
import type { Registry } from "@imdx/core";
import { slashItemsFor, groupSlashItems, type SlashItem } from "../commands.js";
import { getSlashState } from "./slash-plugin.js";

export interface SlashMenuProps {
  view: EditorView;
  state: EditorState;
  registry: Registry;
  schema: Schema;
}

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape"]);

/** `/`-triggered command palette, positioned at the trigger and keyboard-driven. */
export function SlashMenu({ view, state, registry, schema }: SlashMenuProps) {
  const slash = getSlashState(state);
  // Context-aware: recompute insertable items as the selection moves.
  const items = useMemo(
    () => slashItemsFor(registry, schema, state),
    [registry, schema, state],
  );
  const groups = useMemo(() => {
    const q = slash.query.toLowerCase();
    const matched = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    return groupSlashItems(matched);
  }, [items, slash.query]);
  // Flat order = concatenation of group buckets; keyboard nav indexes into this.
  const filtered = useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [slash.query, slash.active]);

  const dismiss = useCallback(() => {
    const to = view.state.selection.from;
    view.dispatch(view.state.tr.delete(slash.from, to));
    view.focus();
  }, [view, slash.from]);

  const run = useCallback(
    (item: SlashItem | undefined) => {
      if (!item) return;
      const to = view.state.selection.from;
      view.dispatch(view.state.tr.delete(slash.from, to));
      item.run(view.state, view.dispatch);
      view.focus();
    },
    [view, slash.from],
  );

  useEffect(() => {
    if (!slash.active) return;
    const handler = (e: KeyboardEvent) => {
      if (!NAV_KEYS.has(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "ArrowDown") setIndex((i) => Math.min(i + 1, filtered.length - 1));
      else if (e.key === "ArrowUp") setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === "Enter") run(filtered[index]);
      else if (e.key === "Escape") dismiss();
    };
    view.dom.addEventListener("keydown", handler, true);
    return () => view.dom.removeEventListener("keydown", handler, true);
  }, [slash.active, filtered, index, run, dismiss, view]);

  if (!slash.active || filtered.length === 0) return null;

  let style: { top: number; left: number };
  try {
    const coords = view.coordsAtPos(slash.from);
    const rect = view.dom.getBoundingClientRect();
    style = { top: coords.bottom - rect.top, left: coords.left - rect.left };
  } catch {
    return null;
  }

  let flatIndex = -1;
  return (
    <div className="imdx-slash" style={style} role="listbox">
      {groups.map(([label, list]) => (
        <div key={label} className="imdx-slash-group">
          <div className="imdx-slash-group-label">{label}</div>
          {list.map((item) => {
            const i = (flatIndex += 1);
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={i === index}
                className={"imdx-slash-item" + (i === index ? " is-active" : "")}
                onMouseEnter={() => setIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  run(item);
                }}
              >
                <span className="imdx-slash-item-label">{item.label}</span>
                {item.description ? (
                  <span className="imdx-slash-item-desc">{item.description}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
