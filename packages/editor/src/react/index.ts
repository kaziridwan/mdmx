/**
 * `@mdmx/editor/react` — the embeddable editor.
 *
 * Pruned for 0.5 (ADR-048 rationale, repo-wide): this barrel published ~44
 * symbols of which consumers used five. Everything else was internal
 * machinery whose signatures would have frozen at publish. Internals are
 * still reachable by deep path for experiments — they just aren't a promise.
 */
export { MDMXEditor } from "./Editor.js";
export type { MDMXEditorProps, ComponentMap } from "./Editor.js";

/** Media integration: the host supplies a source, the editor drives it. */
export type { MediaItem, MediaUpload, MediaSource, UploadableFile } from "./media.js";

/**
 * Composition points a host genuinely needs: the media picker context lets an
 * embedder (the dashboard) answer "Browse…" from its own library UI, and
 * `createReactNodeView` is how a host renders its own components on the
 * canvas.
 */
export { MediaPickerContext, useMediaPicker } from "./media-context.js";
export type { RequestMedia } from "./media-context.js";
export { createReactNodeView, routeEvent, INTERACTIVE_SELECTOR } from "./react-node-view.js";
export { linkClickAction } from "./link-policy.js";
export type { LinkClick } from "./link-policy.js";
export type {
  NodeViewComponent,
  NodeViewComponentProps,
  CreateNodeViewOptions,
} from "./react-node-view.js";
