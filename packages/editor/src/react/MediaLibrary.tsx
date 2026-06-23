import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fileToUpload,
  isImagePath,
  type MediaItem,
  type MediaSource,
} from "./media.js";

export interface MediaLibraryProps {
  /** Storage adapter (list + upload). */
  media: MediaSource;
  /** Media directory uploads are written under (e.g. `public/media`). */
  mediaDir: string;
  /** Called with the chosen asset; the host inserts/uses it and closes. */
  onPick: (item: MediaItem) => void;
  /** Dismiss without picking. */
  onClose: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: MediaItem[] }
  | { status: "error"; message: string };

/**
 * Modal media browser: lists existing assets, filters by name, uploads new
 * ones, and yields the picked asset to the host. Storage is abstracted behind
 * `MediaSource`, so this component never touches the network directly.
 */
export function MediaLibrary({ media, mediaDir, onPick, onClose }: MediaLibraryProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const items = await media.list();
      setLoad({ status: "ready", items });
    } catch (err) {
      setLoad({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [media]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = load.status === "ready" ? load.items : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.path.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-picking the same file
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      try {
        const created = await media.upload(await fileToUpload(file, mediaDir));
        await refresh();
        onPick(created);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [media, mediaDir, refresh, onPick],
  );

  return (
    <div className="mdmx-media-overlay" role="dialog" aria-label="Media library">
      <div className="mdmx-media-modal">
        <div className="mdmx-media-header">
          <input
            className="mdmx-media-search"
            type="search"
            placeholder="Search media…"
            aria-label="Search media"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="mdmx-media-upload"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label="Upload media"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
          <button type="button" className="mdmx-media-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {uploadError ? <div className="mdmx-media-error">{uploadError}</div> : null}

        <div className="mdmx-media-body">
          {load.status === "loading" ? (
            <div className="mdmx-media-empty">Loading…</div>
          ) : load.status === "error" ? (
            <div className="mdmx-media-error">{load.message}</div>
          ) : filtered.length === 0 ? (
            <div className="mdmx-media-empty">
              {items.length === 0 ? "No media yet — upload one." : "No matches."}
            </div>
          ) : (
            <ul className="mdmx-media-grid">
              {filtered.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    className="mdmx-media-item"
                    title={item.path}
                    onClick={() => onPick(item)}
                  >
                    {isImagePath(item.path) ? (
                      <img className="mdmx-media-thumb" src={item.url} alt="" />
                    ) : (
                      <span className="mdmx-media-fileicon" aria-hidden="true">
                        ▦
                      </span>
                    )}
                    <span className="mdmx-media-name">{item.path.split("/").pop()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
