/** Default sidebar width (px); matches the CSS `--mdmx-sidebar-width` fallback. */
export const DEFAULT_SIDEBAR_WIDTH = 380;
export const MIN_SIDEBAR_WIDTH = 260;
export const MAX_SIDEBAR_WIDTH = 640;

const STORAGE_KEY = "mdmx:sidebar-width";

/** Clamp a desired width into the allowed range. Pure; unit-tested. */
export function clampSidebarWidth(
  px: number,
  min = MIN_SIDEBAR_WIDTH,
  max = MAX_SIDEBAR_WIDTH,
): number {
  if (!Number.isFinite(px)) return min;
  return Math.round(Math.min(max, Math.max(min, px)));
}

/** Read the persisted sidebar width, or null if unset/invalid/unavailable. */
export function readStoredWidth(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? clampSidebarWidth(n) : null;
  } catch {
    return null; // localStorage can throw (privacy mode, SSR)
  }
}

/** Persist the sidebar width (best-effort; swallows storage errors). */
export function storeSidebarWidth(px: number): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(clampSidebarWidth(px)));
  } catch {
    // ignore
  }
}
