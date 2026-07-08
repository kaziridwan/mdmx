import type {
  CollectionFieldConfig,
  CollectionSpec,
  Diagnostic,
} from "@mdmx/core";

/**
 * Thin typed client over the MDMX content API (see @mdmx/next). All calls are
 * same-origin fetches; the sealed session cookie rides along automatically.
 * A 401 anywhere surfaces as `UnauthorizedError` so the shell can drop to the
 * login screen.
 */

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "authentication required") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export interface Me {
  login: string;
  repo: { owner: string; name: string; branch: string };
  contentDir: string;
  mediaDir: string;
  validation: "strict" | "report";
  localMode: boolean;
}

export interface FileEntry {
  path: string;
  sha: string;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
}

export interface CommitInfo {
  sha?: string;
  [key: string]: unknown;
}

export interface SaveResult {
  commit: CommitInfo;
  diagnostics: Diagnostic[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new UnauthorizedError(body.error);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function createApiClient(basePath: string) {
  return {
    me: () => request<Me>(`${basePath}/me`),

    listFiles: async (dir: string): Promise<FileEntry[]> => {
      try {
        const { files } = await request<{ files: FileEntry[] }>(
          `${basePath}/files?dir=${encodeURIComponent(dir)}`,
        );
        return files;
      } catch (err) {
        // A directory that doesn't exist yet is an empty listing, not a failure.
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }
    },

    readFile: (path: string) =>
      request<FileContent>(`${basePath}/file?path=${encodeURIComponent(path)}`),

    saveFile: (args: {
      path: string;
      content: string;
      message?: string;
      expectedSha?: string | null;
    }) => request<SaveResult>(`${basePath}/file`, jsonInit("PUT", args)),

    deleteFile: (args: { path: string; message?: string; expectedSha?: string | null }) =>
      request<{ commit: CommitInfo }>(`${basePath}/file`, jsonInit("DELETE", args)),

    uploadMedia: (args: { path: string; dataBase64: string; message?: string }) =>
      request<{ commit: CommitInfo; path: string }>(`${basePath}/media`, jsonInit("POST", args)),

    listCollections: async (): Promise<CollectionSpec[]> => {
      const { collections } = await request<{ collections: CollectionSpec[] }>(
        `${basePath}/collections`,
      );
      return collections;
    },

    createCollection: (args: {
      name: string;
      dir?: string;
      fields: Record<string, CollectionFieldConfig>;
    }) =>
      request<{ collection: CollectionSpec; commit: CommitInfo }>(
        `${basePath}/collections`,
        jsonInit("POST", args),
      ),

    updateCollection: (name: string, fields: Record<string, CollectionFieldConfig>) =>
      request<{ collection: CollectionSpec; commit: CommitInfo }>(
        `${basePath}/collections/${encodeURIComponent(name)}`,
        jsonInit("PUT", { fields }),
      ),

    logout: () => request<{ ok: boolean }>(`${basePath}/auth/logout`, { method: "POST" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
