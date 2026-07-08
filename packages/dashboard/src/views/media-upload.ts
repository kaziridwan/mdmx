/**
 * Small upload helpers local to the dashboard. (The editor ships equivalents
 * in @mdmx/editor/react, but importing that module statically would drag
 * ProseMirror — which touches browser globals at import time — into the SSR
 * graph; the editor entry is only ever loaded via next/dynamic ssr:false.)
 */

export const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Uploadable subset (the API whitelist excludes svg for uploads). */
export const UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.avif";

export function safeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return `${stem || "file"}${ext ? `.${ext}` : ""}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export interface PreparedUpload {
  path: string;
  dataBase64: string;
}

export async function prepareUpload(file: File, mediaDir: string): Promise<PreparedUpload> {
  return {
    path: `${mediaDir}/${safeFilename(file.name)}`,
    dataBase64: bytesToBase64(await fileBytes(file)),
  };
}

/** Blob.arrayBuffer with a FileReader fallback (older Safari, jsdom). */
async function fileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("could not read file"));
    reader.readAsArrayBuffer(file);
  });
}

/** Map a repo path under `public/` to the URL Next serves it at. */
export function publicUrl(path: string): string {
  return "/" + path.replace(/^public\//, "");
}
