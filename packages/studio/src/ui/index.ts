/**
 * `@mdmx/studio/ui` — the Component Studio builder screens.
 *
 * These render inside a host CMS (the dashboard today), which supplies a
 * `StudioClient` for I/O and a `StudioHost` for navigation and chrome. The
 * host composes; the studio owns its own feature end to end (ADR-045).
 */
export { StudioView, samplePropsFor } from "./StudioView.js";
export { StudioEditorView } from "./StudioEditorView.js";
export type { StudioClient, StudioEntry, StudioHost } from "./client.js";
export { ensureTailwindRuntime, DEFAULT_TAILWIND_SRC } from "./tailwind-runtime.js";
export { htmlToTemplate, templateToHtml } from "./template-html.js";
export {
  appendChild,
  activeClassIn,
  CLASS_GROUPS,
  ELEMENT_SNIPPETS,
  isElement,
  nodeAtPath,
  removeAtPath,
  setClassIn,
  updateAtPath,
  type NodePath,
} from "./template-edit.js";
