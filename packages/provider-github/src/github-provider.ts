import { Buffer } from "node:buffer";
import {
  assertSafePath,
  ConflictError,
  type CommitOptions,
  type CommitResult,
  type ContentProvider,
  type FileChange,
  type FileMeta,
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

  async read(path: string): Promise<{ content: string; sha: string }> {
    const safe = assertSafePath(path);
    const data = (await this.api(
      "GET",
      `/repos/${this.o.owner}/${this.o.repo}/contents/${encodePath(safe)}?ref=${this.o.branch}`,
    )) as { content: string; sha: string; encoding: string };
    const content = Buffer.from(data.content, "base64").toString("utf8");
    return { content, sha: data.sha };
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

  async delete(
    path: string,
    message: string,
    options?: CommitOptions,
  ): Promise<CommitResult> {
    const safe = assertSafePath(path);
    return this.write(message, options, async () => [
      { path: safe, mode: "100644", type: "blob", sha: null },
    ]);
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

    await this.api("PATCH", `${repo}/git/refs/heads/${this.o.branch}`, {
      sha: newCommit.sha,
      force: false,
    });

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
      throw new GitHubApiError(200, "tree listing truncated; repository too large for recursive listing");
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
