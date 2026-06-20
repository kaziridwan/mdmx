import { createContext, useContext } from "react";
import type { MediaItem } from "./media.js";

/**
 * Open the media library and resolve to the picked asset via `onPick`. Provided
 * by `IMDXEditor` when a `media` source is configured; null otherwise (so an
 * `image` control can hide its "Browse…" button gracefully).
 */
export type RequestMedia = (onPick: (item: MediaItem) => void) => void;

export const MediaPickerContext = createContext<RequestMedia | null>(null);

/** Access the media-picker opener, or null when no media source is wired. */
export function useMediaPicker(): RequestMedia | null {
  return useContext(MediaPickerContext);
}
