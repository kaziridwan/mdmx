/**
 * The content storage contract. Implementations: GitHubProvider
 * (@mdmx/provider-github), LocalProvider (@mdmx/next, development mode),
 * and in the future GitLab / generic git.
 *
 * Design notes:
 * - `commit` takes an ARRAY of changes: a post plus its pasted images must
 *   land as one atomic commit.
 * - Optimistic concurrency via `expectedShas`: callers pass the blob sha
 *   they loaded; a mismatch raises ConflictError instead of silently
 *   overwriting a concurrent edit.
 */

export interface FileMeta {
  path: string;
  sha: string;
  size: number;
}

export interface FileChange {
  path: string;
  content: string | Uint8Array;
}

export interface CommitResult {
  /** Commit sha (or equivalent identifier). */
  sha: string;
  message: string;
}

export interface CommitOptions {
  /**
   * Map of path → blob sha the caller believes is current. Providers must
   * verify these before writing and throw ConflictError on mismatch.
   * A path mapped to null asserts "this file should not exist yet".
   */
  expectedShas?: Record<string, string | null>;
}

export interface ContentProvider {
  /** List blob files under a directory (recursive). `""` lists the root. */
  list(dir: string): Promise<FileMeta[]>;
  read(path: string): Promise<{ content: string; sha: string }>;
  commit(
    changes: FileChange[],
    message: string,
    options?: CommitOptions,
  ): Promise<CommitResult>;
  delete(path: string, message: string, options?: CommitOptions): Promise<CommitResult>;
}

export class ConflictError extends Error {
  readonly path: string;
  constructor(path: string, detail?: string) {
    super(
      `Conflict on "${path}": the file changed since it was loaded${detail ? ` (${detail})` : ""}.`,
    );
    this.name = "ConflictError";
    this.path = path;
  }
}

export class PathSafetyError extends Error {
  constructor(path: string, reason: string) {
    super(`Unsafe path "${path}": ${reason}.`);
    this.name = "PathSafetyError";
  }
}

/**
 * Reject paths that could escape the content root or smuggle writes into
 * sensitive locations. A git-backed CMS is one "../.github/workflows/x.yml"
 * away from owning someone's CI — treat this like auth.
 *
 * Returns the normalized (forward-slash, no leading "./") path.
 */
export function assertSafePath(path: string): string {
  if (path.length === 0) throw new PathSafetyError(path, "empty path");
  if (path.includes("\\")) throw new PathSafetyError(path, "backslashes are not allowed");
  if (path.startsWith("/")) throw new PathSafetyError(path, "absolute paths are not allowed");
  if (/^[A-Za-z]:/.test(path)) {
    throw new PathSafetyError(path, "drive-letter paths are not allowed");
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) {
    throw new PathSafetyError(path, "control characters are not allowed");
  }
  const segments = path.split("/");
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") throw new PathSafetyError(path, "path traversal is not allowed");
    normalized.push(segment);
  }
  if (normalized.length === 0) throw new PathSafetyError(path, "empty path");
  return normalized.join("/");
}
