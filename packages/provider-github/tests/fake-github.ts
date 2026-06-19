import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * A miniature in-memory GitHub implementing exactly the endpoints
 * GitHubProvider uses: refs, commits, trees (recursive, base_tree merge),
 * blobs, and the contents read endpoint. Blob shas are real git blob shas
 * so conflict semantics match production.
 */
export class FakeGitHub {
  readonly owner: string;
  readonly repo: string;
  private refs = new Map<string, string>(); // branch -> commit sha
  private commits = new Map<string, { tree: string; parents: string[]; message: string }>();
  private trees = new Map<string, Map<string, { sha: string; size: number }>>(); // tree sha -> path -> blob
  private blobs = new Map<string, Buffer>();
  /** Every request the provider made, for assertions. */
  readonly requests: Array<{ method: string; path: string }> = [];

  constructor(owner: string, repo: string, branch: string, files: Record<string, string>) {
    this.owner = owner;
    this.repo = repo;
    const entries = new Map<string, { sha: string; size: number }>();
    for (const [path, content] of Object.entries(files)) {
      const buf = Buffer.from(content, "utf8");
      const sha = gitBlobSha(buf);
      this.blobs.set(sha, buf);
      entries.set(path, { sha, size: buf.length });
    }
    const treeSha = randomSha(`tree:${branch}:0`);
    this.trees.set(treeSha, entries);
    const commitSha = randomSha(`commit:${branch}:0`);
    this.commits.set(commitSha, { tree: treeSha, parents: [], message: "init" });
    this.refs.set(branch, commitSha);
  }

  headSha(branch: string): string {
    return this.refs.get(branch)!;
  }

  commitChain(branch: string): string[] {
    const chain: string[] = [];
    let sha: string | undefined = this.refs.get(branch);
    while (sha) {
      chain.push(sha);
      sha = this.commits.get(sha)?.parents[0];
    }
    return chain;
  }

  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const path = url.pathname;
    this.requests.push({ method, path });
    const body = init?.body ? (JSON.parse(String(init.body)) as any) : undefined;
    const repoPrefix = `/repos/${this.owner}/${this.repo}`;
    if (!path.startsWith(repoPrefix)) return json(404, { message: "repo not found" });
    const rest = path.slice(repoPrefix.length);

    // GET /git/ref/heads/:branch
    let m = rest.match(/^\/git\/ref\/heads\/(.+)$/);
    if (m && method === "GET") {
      const sha = this.refs.get(m[1]!);
      return sha
        ? json(200, { object: { sha } })
        : json(404, { message: "ref not found" });
    }

    // PATCH /git/refs/heads/:branch
    m = rest.match(/^\/git\/refs\/heads\/(.+)$/);
    if (m && method === "PATCH") {
      const branch = m[1]!;
      const newSha = body.sha as string;
      const commit = this.commits.get(newSha);
      if (!commit) return json(422, { message: "unknown commit" });
      // fast-forward check (force: false)
      if (commit.parents[0] !== this.refs.get(branch)) {
        return json(422, { message: "Update is not a fast forward" });
      }
      this.refs.set(branch, newSha);
      return json(200, { object: { sha: newSha } });
    }

    // GET /git/commits/:sha
    m = rest.match(/^\/git\/commits\/([0-9a-f]+)$/);
    if (m && method === "GET") {
      const c = this.commits.get(m[1]!);
      return c
        ? json(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((p) => ({ sha: p })) })
        : json(404, { message: "commit not found" });
    }

    // POST /git/commits
    if (rest === "/git/commits" && method === "POST") {
      const sha = randomSha(`commit:${this.commits.size}:${body.message}`);
      this.commits.set(sha, {
        tree: body.tree,
        parents: body.parents ?? [],
        message: body.message,
      });
      return json(201, { sha });
    }

    // POST /git/blobs
    if (rest === "/git/blobs" && method === "POST") {
      const buf =
        body.encoding === "base64"
          ? Buffer.from(body.content, "base64")
          : Buffer.from(body.content, "utf8");
      const sha = gitBlobSha(buf);
      this.blobs.set(sha, buf);
      return json(201, { sha });
    }

    // GET /git/trees/:sha (?recursive=1)
    m = rest.match(/^\/git\/trees\/([0-9a-f]+)$/);
    if (m && method === "GET") {
      const tree = this.trees.get(m[1]!);
      if (!tree) return json(404, { message: "tree not found" });
      return json(200, {
        sha: m[1],
        truncated: false,
        tree: [...tree.entries()].map(([p, e]) => ({
          path: p,
          mode: "100644",
          type: "blob",
          sha: e.sha,
          size: e.size,
        })),
      });
    }

    // POST /git/trees  (base_tree merge; sha:null deletes)
    if (rest === "/git/trees" && method === "POST") {
      const base = body.base_tree
        ? new Map(this.trees.get(body.base_tree) ?? [])
        : new Map<string, { sha: string; size: number }>();
      for (const entry of body.tree as Array<{ path: string; sha: string | null }>) {
        if (entry.sha === null) base.delete(entry.path);
        else {
          const blob = this.blobs.get(entry.sha);
          if (!blob) return json(422, { message: `unknown blob ${entry.sha}` });
          base.set(entry.path, { sha: entry.sha, size: blob.length });
        }
      }
      const sha = randomSha(`tree:${this.trees.size}:${JSON.stringify([...base.keys()])}`);
      this.trees.set(sha, base);
      return json(201, { sha });
    }

    // GET /contents/:path?ref=branch
    m = rest.match(/^\/contents\/(.+)$/);
    if (m && method === "GET") {
      const filePath = decodeURIComponent(m[1]!);
      const branch = url.searchParams.get("ref")!;
      const head = this.commits.get(this.refs.get(branch)!)!;
      const entry = this.trees.get(head.tree)!.get(filePath);
      if (!entry) return json(404, { message: "Not Found" });
      return json(200, {
        sha: entry.sha,
        encoding: "base64",
        content: this.blobs.get(entry.sha)!.toString("base64"),
      });
    }

    return json(404, { message: `unhandled ${method} ${rest}` });
  };
}

export function gitBlobSha(buf: Buffer): string {
  return createHash("sha1")
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest("hex");
}

function randomSha(seed: string): string {
  return createHash("sha1").update(seed).digest("hex");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status >= 400 ? "Error" : "OK",
    headers: { "content-type": "application/json" },
  });
}
