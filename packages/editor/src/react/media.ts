import { insertPoint } from "prosemirror-transform";
import type { EditorView } from "prosemirror-view";

/** A media asset already stored in the repo (under the configured media dir). */
export interface MediaItem {
  /** Repo-relative path, e.g. `public/media/logo.png`. */
  path: string;
  /** URL the editor can render/insert (often the public path, e.g. `/media/logo.png`). */
  url: string;
  /** Byte size, if the source knows it. */
  size?: number;
}

/** An upload payload ready for the `POST /media` API. */
export interface MediaUpload {
  /** Repo-relative destination path under the media dir. */
  path: string;
  /** Base64-encoded file bytes (no data-URL prefix). */
  dataBase64: string;
}

/**
 * The editor's view of media storage. Kept deliberately API-agnostic (like
 * `onSave`): a host app implements it against `@imdx/next`'s `/files` (list)
 * and `/media` (upload) routes, a GitHub provider, or an in-memory fake.
 */
export interface MediaSource {
  /** List the media assets currently in the repo. */
  list(): Promise<MediaItem[]>;
  /** Upload one asset and resolve to the stored item. */
  upload(upload: MediaUpload): Promise<MediaItem>;
}

/** File extensions the picker treats as previewable images. */
export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
]);

/** True if a path looks like a previewable image (by extension). */
export function isImagePath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Sanitize a user-supplied filename into a safe, repo-friendly basename:
 * strip any directory portion, lowercase, collapse runs of unsafe characters
 * to single hyphens, and keep the extension. Never returns an empty string.
 */
export function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const ext = (dot > 0 ? base.slice(dot + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const safeStem = stem || "file";
  return ext ? `${safeStem}.${ext}` : safeStem;
}

/** Join a media directory and a (sanitized) filename into a repo-relative path. */
export function mediaPath(mediaDir: string, name: string): string {
  const dir = mediaDir.replace(/\/+$/, "");
  return `${dir}/${safeFilename(name)}`;
}

/** Encode raw bytes as base64 without a data-URL prefix (browser/Node portable). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000; // avoid String.fromCharCode arg-count limits
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // `btoa` exists in browsers, jsdom, and Node ≥16 (global).
  return btoa(binary);
}

/** The minimal shape `fileToUpload` needs — `File` satisfies it. */
export interface UploadableFile {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Turn a picked `File` into a `MediaUpload` destined for `mediaDir`. */
export async function fileToUpload(
  file: UploadableFile,
  mediaDir: string,
): Promise<MediaUpload> {
  const buf = await file.arrayBuffer();
  return {
    path: mediaPath(mediaDir, file.name),
    dataBase64: bytesToBase64(new Uint8Array(buf)),
  };
}

/**
 * Insert an inline `image` node at the current selection. If the cursor isn't
 * in inline content (e.g. a component node is selected), insert a new paragraph
 * holding the image after it. Returns false if the schema lacks the nodes.
 */
export function insertImage(
  view: EditorView,
  attrs: { src: string; alt?: string; title?: string | null },
): boolean {
  const { state } = view;
  const imageType = state.schema.nodes.image;
  if (!imageType) return false;
  const image = imageType.create({
    src: attrs.src,
    alt: attrs.alt ?? "",
    title: attrs.title ?? null,
  });

  if (state.selection.$from.parent.inlineContent) {
    view.dispatch(state.tr.replaceSelectionWith(image, false).scrollIntoView());
    return true;
  }

  const paragraphType = state.schema.nodes.paragraph;
  const paragraph = paragraphType?.createAndFill(null, image);
  if (!paragraph) return false;
  const at =
    insertPoint(state.doc, state.selection.to, paragraphType!) ?? state.selection.to;
  view.dispatch(state.tr.insert(at, paragraph).scrollIntoView());
  return true;
}
