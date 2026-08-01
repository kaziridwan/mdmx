"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FileEntry } from "../api-client.js";
import { useDashboard } from "../context.js";
import { IMAGE_RE, prepareUpload, publicUrl, UPLOAD_ACCEPT } from "./media-upload.js";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; detail: string }
  | { phase: "ready"; files: FileEntry[] };

/** Media library: browse, upload, copy paths, delete. */
export function MediaView() {
  const { api, me } = useDashboard();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const files = (await api.listFiles(me.mediaDir)).filter((f) =>
        IMAGE_RE.test(f.path),
      );
      setState({ phase: "ready", files });
    } catch (err) {
      setState({ phase: "error", detail: (err as Error).message });
    }
  }, [api, me.mediaDir]);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const upload = await prepareUpload(file, me.mediaDir);
      await api.uploadMedia(upload);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onDelete = async (file: FileEntry) => {
    if (!window.confirm(`Delete ${file.path}? Documents referencing it will 404.`)) return;
    setError(null);
    try {
      await api.deleteFile({
        path: file.path,
        expectedSha: file.sha,
        message: `mdmx: delete media ${file.path}`,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onCopy = async (file: FileEntry) => {
    await navigator.clipboard.writeText(publicUrl(file.path));
    setCopied(file.path);
    window.setTimeout(() => setCopied((c) => (c === file.path ? null : c)), 1500);
  };

  return (
    <div className="mdmx-dash-view">
      <header className="mdmx-dash-view-head">
        <div>
          <h1>Media</h1>
          <p className="mdmx-dash-view-sub">
            <code>{me.mediaDir}/</code> — images used by your content.
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="mdmx-dash-hidden-input"
            aria-label="Upload image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          <button
            type="button"
            className="mdmx-dash-button mdmx-dash-button-primary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? "Uploading…" : "Upload image"}
          </button>
        </div>
      </header>

      {error ? <p className="mdmx-dash-error">{error}</p> : null}

      {state.phase === "loading" ? (
        <div className="mdmx-dash-empty">
          <p>Loading media…</p>
        </div>
      ) : state.phase === "error" ? (
        <div className="mdmx-dash-empty">
          <p className="mdmx-dash-error">Could not load media: {state.detail}</p>
        </div>
      ) : state.files.length === 0 ? (
        <div className="mdmx-dash-empty">
          <p>No images yet.</p>
          <p className="mdmx-dash-hint">
            Uploads land in <code>{me.mediaDir}/</code> and commit like content. Pasting
            an image into the editor uploads it here too.
          </p>
        </div>
      ) : (
        <ul className="mdmx-dash-media-grid">
          {state.files.map((file) => (
            <li key={file.path} className="mdmx-dash-media-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicUrl(file.path)} alt={file.path} loading="lazy" />
              <div className="mdmx-dash-media-meta">
                <code title={file.path}>{file.path.split("/").pop()}</code>
                <div className="mdmx-dash-media-actions">
                  <button
                    type="button"
                    className="mdmx-dash-button mdmx-dash-button-ghost"
                    onClick={() => void onCopy(file)}
                  >
                    {copied === file.path ? "Copied!" : "Copy URL"}
                  </button>
                  <button
                    type="button"
                    className="mdmx-dash-button mdmx-dash-button-ghost mdmx-dash-danger-hover"
                    onClick={() => void onDelete(file)}
                    aria-label={`Delete ${file.path}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
