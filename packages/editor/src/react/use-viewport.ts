import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from "react";
import {
  DEFAULT_VIEWPORT,
  canvasWidth,
  canvasWidthCss,
  canvasZoom,
  readStoredViewport,
  storeViewport,
  type ViewportMode,
} from "./viewport.js";

export interface ViewportHandle {
  viewport: ViewportMode;
  selectViewport: (mode: ViewportMode) => void;
  /** Zoom applied to the canvas (1 in `fit`). */
  zoom: number;
  /** `--mdmx-canvas-w` / `--mdmx-canvas-zoom` for the canvas element. */
  canvasStyle: CSSProperties;
}

/**
 * The preview viewport: the persisted mode plus the pane width (observed) that
 * a device mode is zoomed into. See `viewport.ts`.
 */
export function useViewport(paneRef: RefObject<HTMLElement | null>): ViewportHandle {
  const [viewport, setViewport] = useState<ViewportMode>(
    () => readStoredViewport() ?? DEFAULT_VIEWPORT,
  );
  const [paneWidth, setPaneWidth] = useState<number | null>(null);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setPaneWidth(w);
    });
    observer.observe(pane);
    return () => observer.disconnect();
  }, [paneRef]);

  const selectViewport = useCallback((mode: ViewportMode) => {
    setViewport(mode);
    storeViewport(mode);
  }, []);

  const zoom = canvasZoom(viewport, paneWidth ?? canvasWidth(viewport) ?? 0);
  const canvasStyle = {
    ["--mdmx-canvas-w"]: canvasWidthCss(viewport),
    ["--mdmx-canvas-zoom"]: zoom,
  } as CSSProperties;

  return { viewport, selectViewport, zoom, canvasStyle };
}
