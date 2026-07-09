/**
 * Responsive preview modes for the editor canvas (ADR: road-to-0.4.1).
 *
 * The canvas renders at a fixed device width per mode and is zoomed down when
 * the surrounding pane is narrower, so authors see desktop/tablet layouts even
 * inside a ~800px editor column. `zoom` (not `transform: scale`) so layout
 * height tracks the visual height. Author components should respond to the
 * canvas width via container queries — the canvas is a named `inline-size`
 * container (`mdmx-canvas`); window media queries cannot see the canvas.
 */

export const VIEWPORT_WIDTHS = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
} as const;

export type ViewportMode = keyof typeof VIEWPORT_WIDTHS;

export const VIEWPORT_MODES = Object.keys(VIEWPORT_WIDTHS) as ViewportMode[];

export const DEFAULT_VIEWPORT: ViewportMode = "desktop";

const STORAGE_KEY = "mdmx:viewport";

export function isViewportMode(value: unknown): value is ViewportMode {
  return typeof value === "string" && value in VIEWPORT_WIDTHS;
}

/** Read the persisted viewport mode, or null if unset/invalid/unavailable. */
export function readStoredViewport(): ViewportMode | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isViewportMode(raw) ? raw : null;
  } catch {
    return null; // localStorage can throw (privacy mode, SSR)
  }
}

/** Persist the viewport mode (best-effort; swallows storage errors). */
export function storeViewport(mode: ViewportMode): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

/** Breathing room kept between the zoomed canvas and the pane edges (px). */
export const CANVAS_GUTTER = 32;

/**
 * Zoom factor that fits a `mode`-wide canvas into a pane `paneWidth` px wide.
 * Never zooms in (max 1); rounded to 3 decimals so styles stay stable across
 * sub-pixel ResizeObserver jitter. Pure; unit-tested.
 */
export function canvasZoom(mode: ViewportMode, paneWidth: number): number {
  if (!Number.isFinite(paneWidth) || paneWidth <= 0) return 1;
  const available = paneWidth - CANVAS_GUTTER;
  const width = VIEWPORT_WIDTHS[mode];
  if (available >= width) return 1;
  return Math.max(0.2, Math.round((available / width) * 1000) / 1000);
}
