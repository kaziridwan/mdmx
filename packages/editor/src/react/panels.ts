/**
 * Collapsible side panels (ADR-051). On desktop the rail and the sidebar can
 * be folded away so a device preview has more room; the choice is persisted
 * per browser. Mobile ignores this — there the panels are off-canvas sheets
 * (see `MobileFabs`).
 */

export type PanelSide = "rail" | "sidebar";

const storageKey = (side: PanelSide) => `mdmx:${side}-collapsed`;

/** Read the persisted collapsed state, or null if unset/invalid/unavailable. */
export function readStoredCollapsed(side: PanelSide): boolean | null {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(side));
    return raw === "true" ? true : raw === "false" ? false : null;
  } catch {
    return null; // localStorage can throw (privacy mode, SSR)
  }
}

/** Persist the collapsed state (best-effort; swallows storage errors). */
export function storeCollapsed(side: PanelSide, collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(storageKey(side), String(collapsed));
  } catch {
    // ignore
  }
}
