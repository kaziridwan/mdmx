"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDashboard } from "../context.js";
import {
  entryItems,
  filterItems,
  navigationItems,
  type QuickOpenItem,
} from "./quick-open.js";

/**
 * Cmd/Ctrl+K palette: entries across all collections plus navigation and
 * "new …" actions. Entries load fresh each time the palette opens.
 */
export function QuickOpen() {
  const { config, api, me, collections } = useDashboard();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [entries, setEntries] = useState<QuickOpenItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setSelected(0);
    api
      .listEntries(me.contentDir)
      .then((docs) => setEntries(entryItems(config.mountPath, docs)))
      .catch(() => setEntries([]));
  }, [api, me.contentDir, config.mountPath]);

  // Global shortcut: Cmd/Ctrl+K toggles, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openPalette]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const items = useMemo(
    () =>
      filterItems(
        [...entries, ...navigationItems(config.mountPath, collections)],
        query,
      ),
    [entries, config.mountPath, collections, query],
  );

  const go = (item: QuickOpenItem | undefined) => {
    if (!item) return;
    setOpen(false);
    window.location.assign(item.href);
  };

  return (
    <>
      <button
        type="button"
        className="mdmx-dash-search-trigger"
        onClick={openPalette}
        aria-label="Search (Cmd+K)"
      >
        <span>Search…</span>
        <kbd>⌘K</kbd>
      </button>

      {open ? (
        <div
          className="mdmx-dash-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="mdmx-dash-palette" role="dialog" aria-label="Quick open">
            <input
              ref={inputRef}
              className="mdmx-dash-palette-input"
              placeholder="Search entries, collections, actions…"
              aria-label="Quick open search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((s) => Math.min(s + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((s) => Math.max(s - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(items[selected]);
                }
              }}
            />
            <ul className="mdmx-dash-palette-list" role="listbox" aria-label="Results">
              {items.length === 0 ? (
                <li className="mdmx-dash-palette-empty">No matches.</li>
              ) : (
                items.map((item, i) => (
                  <li
                    key={`${item.kind}:${item.href}:${item.label}`}
                    role="option"
                    aria-selected={i === selected}
                    className={
                      "mdmx-dash-palette-item" + (i === selected ? " is-selected" : "")
                    }
                    onMouseEnter={() => setSelected(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(item);
                    }}
                  >
                    <span className="mdmx-dash-palette-kind">{kindLabel(item.kind)}</span>
                    <span className="mdmx-dash-palette-label">{item.label}</span>
                    {item.detail ? (
                      <code className="mdmx-dash-palette-detail">{item.detail}</code>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}

function kindLabel(kind: QuickOpenItem["kind"]): string {
  switch (kind) {
    case "entry":
      return "doc";
    case "collection":
      return "coll";
    case "page":
      return "page";
    case "action":
      return "new";
  }
}
