/**
 * The left navigation collapses from a navbar toggle (ADR-056), persisted per
 * browser the same way the editor's rail and sidebar are (ADR-051). Pure
 * helpers so the shell stays thin and the rules are unit-testable.
 */

export const NAV_STORAGE_KEY = "mdmx:dash-nav-collapsed";

/** Read the persisted collapsed state, or null if unset/invalid/unavailable. */
export function readStoredNavCollapsed(): boolean | null {
  try {
    const raw = globalThis.localStorage?.getItem(NAV_STORAGE_KEY);
    return raw === "true" ? true : raw === "false" ? false : null;
  } catch {
    return null; // localStorage can throw (privacy mode, SSR)
  }
}

/** Persist the collapsed state (best-effort; swallows storage errors). */
export function storeNavCollapsed(collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(NAV_STORAGE_KEY, String(collapsed));
  } catch {
    // ignore
  }
}

/** The subset of KeyboardEvent the shortcut rule reads. */
export interface ShortcutKey {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

/** `Mod-\` (⌘-\ on macOS, Ctrl-\ elsewhere) toggles the navigation. */
export function isNavToggleShortcut(e: ShortcutKey): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  return e.key === "\\" || e.code === "Backslash";
}

/**
 * Whether a keyboard event started inside something that edits text: form
 * fields, contenteditable regions (ProseMirror), or a CodeMirror editor. The
 * navigation shortcut yields to those so it never eats a keystroke.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return (
    (target as Element).closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], .cm-editor, .ProseMirror',
    ) != null
  );
}
