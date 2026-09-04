/**
 * Responsive preview modes for the editor canvas (ADR-036, amended by
 * ADR-051).
 *
 * `fit` — the default — lays the canvas out at the pane's own width at zoom
 * 1: real-size text, a precise caret, buttons at click size. The device modes
 * render at a fixed width (390 / 768 / 1280) and are zoomed down to fit the
 * pane, so an author can check a desktop layout from inside a narrow editor
 * column. `zoom` (not `transform: scale`) so layout height tracks the visual
 * height. Author components should respond to the canvas width via container
 * queries — the canvas is a named `inline-size` container (`mdmx-canvas`) and
 * the content root carries the host's content class (ADR-050); window media
 * queries cannot see either.
 */

export const DEVICE_WIDTHS = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
} as const;

export type DeviceMode = keyof typeof DEVICE_WIDTHS;
export type ViewportMode = "fit" | DeviceMode;

export const VIEWPORT_MODES: readonly ViewportMode[] = ["fit", "mobile", "tablet", "desktop"];

export const DEFAULT_VIEWPORT: ViewportMode = "fit";

const STORAGE_KEY = "mdmx:viewport";

export function isViewportMode(value: unknown): value is ViewportMode {
  return typeof value === "string" && (VIEWPORT_MODES as readonly string[]).includes(value);
}

/** Device width of a mode in px, or null for `fit` (the pane decides). */
export function canvasWidth(mode: ViewportMode): number | null {
  return mode === "fit" ? null : DEVICE_WIDTHS[mode];
}

/** The `--mdmx-canvas-w` value for a mode. */
export function canvasWidthCss(mode: ViewportMode): string {
  const width = canvasWidth(mode);
  return width == null ? "100%" : `${width}px`;
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

/** Breathing room kept between a zoomed device canvas and the pane edges (px). */
export const CANVAS_GUTTER = 32;

/**
 * Zoom factor that fits a `mode`-wide canvas into a pane `paneWidth` px wide.
 * `fit` is never zoomed. Never zooms in (max 1); rounded to 3 decimals so
 * styles stay stable across sub-pixel ResizeObserver jitter. Pure; unit-tested.
 */
export function canvasZoom(mode: ViewportMode, paneWidth: number): number {
  const width = canvasWidth(mode);
  if (width == null) return 1;
  if (!Number.isFinite(paneWidth) || paneWidth <= 0) return 1;
  const available = paneWidth - CANVAS_GUTTER;
  if (available >= width) return 1;
  return Math.max(0.2, Math.round((available / width) * 1000) / 1000);
}
