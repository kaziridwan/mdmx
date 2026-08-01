import { Buffer } from "node:buffer";
import {
  assertSafePath,
  ConflictError,
  isFileDelete,
  type CommitOptions,
  type CommitResult,
  type ContentProvider,
  type FileChange,
  type FileMeta,
  type ReadOptions,
} from "@mdmx/core";

export interface GitHubProviderOptions {
  owner: string;
  repo: string;
  branch: string;
  /** OAuth / installation token with push permission on the repo. */
  token: string;
  /** Override for tests or GitHub Enterprise. */
  apiBase?: string;
  /** Injectable fetch (tests, instrumentation). */
  fetch?: typeof globalThis.fetch;
  committer?: { name: string; email: string };
}

export class GitHubApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`GitHub API ${status}: ${message}`);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string | null;
  size?: number;
}

/**
 * ContentProvider over GitHub's Git Data API.
 *
 * Writes use the low-level blobs → tree → commit → ref flow rather than the
 * Contents API so that multi-file saves (a post + its images) are one atomic
 * commit with a controlled message — part of the git-native promise.
 */
export class GitHubProvider implements ContentProvider {
  private readonly o: Required<Omit<GitHubProviderOptions, "committer">> &
    Pick<GitHubProviderOptions, "committer">;

  constructor(options: GitHubProviderOptions) {
    this.o = {
      apiBase: "https://api.github.com",
      fetch: globalThis.fetch,
      ...options,
    };
  }

  // -- ContentProvider --------------------------------------------------------

  async list(dir: string): Promise<FileMeta[]> {
    const prefix = dir === "" ? "" : assertSafePath(dir) + "/";
    const entries = await this.treeEntries();
    return entries
      .filter((e) => e.type === "blob" && e.path.startsWith(prefix))
      .map((e) => ({ path: e.path, sha: e.sha as string, size: e.size ?? 0 }));
  }

  async read(
    path: string,
    options?: ReadOptions,
  ): Promise<{ content: string | Uint8Array; sha: string }> {
    const safe = assertSafePath(path);
    const data = (await this.api(
      "GET",
      `/repos/${this.o.owner}/${this.o.repo}/contents/${encodePath(safe)}?ref=${this.o.branch}`,
    )) as { content?: string; sha: string; encoding?: string };

    // The Contents API only inlines blobs up to 1MB; above that it answers
    // `encoding: "none"` with empty content. Returning that verbatim would
    // hand callers a silently truncated file — and a later save would commit
    // the truncation. Fall back to the Blob API (up to 100MB).
    const buf =
      data.encoding === "base64" && data.content
        ? Buffer.from(data.content, "base64")
        : await this.readBlob(data.sha);

    return options?.as === "bytes"
      ? { content: new Uint8Array(buf), sha: data.sha }
      : { content: buf.toString("utf8"), sha: data.sha };
  }

  private async readBlob(sha: string): Promise<Buffer> {
    const blob = (await this.api(
      "GET",
      `/repos/${this.o.owner}/${this.o.repo}/git/blobs/${sha}`,
    )) as { content?: string; encoding?: string };
    if (blob.encoding !== "base64" || blob.content === undefined) {
      throw new GitHubApiError(
        500,
        `blob ${sha} is too large to read through the API (over 100MB)`,
      );
    }
    return Buffer.from(blob.content, "base64");
  }

  async commit(
    changes: FileChange[],
    message: string,
    options?: CommitOptions,
  ): Promise<CommitResult> {
    if (changes.length === 0) throw new Error("commit requires at least one change");
    const safeChanges = changes.map((c) => ({ ...c, path: assertSafePath(c.path) }));
    return this.write(message, options, async () => {
      const entries: TreeEntry[] = [];
      for (const change of safeChanges) {
        if (isFileDelete(change)) {
          // A null sha in the tree removes the path.
          entries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
          continue;
        }
        const isBinary = typeof change.content !== "string";
        const body = isBinary
          ? {
              content: Buffer.from(change.content as Uint8Array).toString("base64"),
              encoding: "base64",
            }
          : { content: change.content, encoding: "utf-8" };
        const blob = (await this.api(
          "POST",
          `/repos/${this.o.owner}/${this.o.repo}/git/blobs`,
          body,
        )) as { sha: string };
        entries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      return entries;
    });
  }

  // -- Git Data flow -----------------------------------------------------------

  private async write(
    message: string,
    options: CommitOptions | undefined,
    buildEntries: () => Promise<TreeEntry[]>,
  ): Promise<CommitResult> {
    const repo = `/repos/${this.o.owner}/${this.o.repo}`;

    // 1. Resolve the branch head and its tree.
    const ref = (await this.api("GET", `${repo}/git/ref/heads/${this.o.branch}`)) as {
      object: { sha: string };
    };
    const headSha = ref.object.sha;
    const headCommit = (await this.api("GET", `${repo}/git/commits/${headSha}`)) as {
      tree: { sha: string };
    };

    // 2. Optimistic concurrency: verify expected blob shas against the head tree.
    if (options?.expectedShas) {
      const current = new Map(
        (await this.treeEntries(headCommit.tree.sha)).map((e) => [e.path, e.sha]),
      );
      for (const [path, expected] of Object.entries(options.expectedShas)) {
        const actual = current.get(assertSafePath(path)) ?? null;
        if (actual !== expected) {
          throw new ConflictError(path, `expected ${expected ?? "absent"}, found ${actual ?? "absent"}`);
        }
      }
    }

    // 3. Blobs → tree → commit → ref.
    const entries = await buildEntries();
    const newTree = (await this.api("POST", `${repo}/git/trees`, {
      base_tree: headCommit.tree.sha,
      tree: entries,
    })) as { sha: string };

    const newCommit = (await this.api("POST", `${repo}/git/commits`, {
      message,
      tree: newTree.sha,
      parents: [headSha],
      ...(this.o.committer ? { committer: this.o.committer } : {}),
    })) as { sha: string };

    try {
      await this.api("PATCH", `${repo}/git/refs/heads/${this.o.branch}`, {
        sha: newCommit.sha,
        force: false,
      });
    } catch (err) {
      // The branch advanced between the head read and the ref update: GitHub
      // rejects the non-fast-forward with a 422. Surface it as the same
      // conflict the expectedShas check raises, not a generic API error.
      if (err instanceof GitHubApiError && err.status === 422) {
        throw new ConflictError(
          entries[0]?.path ?? this.o.branch,
          "the branch advanced during the commit (non-fast-forward ref update)",
        );
      }
      throw err;
    }

    return { sha: newCommit.sha, message };
  }

  private async treeEntries(treeSha?: string): Promise<TreeEntry[]> {
    const repo = `/repos/${this.o.owner}/${this.o.repo}`;
    let sha = treeSha;
    if (!sha) {
      const ref = (await this.api("GET", `${repo}/git/ref/heads/${this.o.branch}`)) as {
        object: { sha: string };
      };
      const commit = (await this.api("GET", `${repo}/git/commits/${ref.object.sha}`)) as {
        tree: { sha: string };
      };
      sha = commit.tree.sha;
    }
    const tree = (await this.api("GET", `${repo}/git/trees/${sha}?recursive=1`)) as {
      tree: TreeEntry[];
      truncated: boolean;
    };
    if (tree.truncated) {
      // Status 500 so the route layer maps it to a JSON error deliberately —
      // a 2xx status here would fall through as an unhandled exception.
      throw new GitHubApiError(
        500,
        "tree listing truncated; repository too large for recursive listing",
      );
    }
    return tree.tree;
  }

  private async api(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await this.o.fetch(`${this.o.apiBase}${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.o.token}`,
        "x-github-api-version": "2022-11-28",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const parsed = (await res.json()) as { message?: string };
        if (parsed.message) detail = parsed.message;
      } catch {
        /* keep statusText */
      }
      throw new GitHubApiError(res.status, detail);
    }
    return res.json();
  }
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
