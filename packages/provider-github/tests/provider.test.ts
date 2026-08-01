import { describe, expect, it } from "vitest";
import { ConflictError, PathSafetyError, readBytes, readText } from "@mdmx/core";
import { GitHubProvider } from "../src/index.js";
import { FakeGitHub } from "./fake-github.js";

function setup(files: Record<string, string> = {}) {
  const fake = new FakeGitHub("jane", "blog", "main", {
    "content/posts/hello.mdx": "---\ntitle: Hello\n---\n\n# Hello\n",
    "content/posts/old.mdx": "# Old\n",
    "README.md": "readme\n",
    ...files,
  });
  const provider = new GitHubProvider({
    owner: "jane",
    repo: "blog",
    branch: "main",
    token: "test-token",
    fetch: fake.fetch,
  });
  return { fake, provider };
}

describe("GitHubProvider", () => {
  it("lists blobs under a directory only", async () => {
    const { provider } = setup();
    const files = await provider.list("content/posts");
    expect(files.map((f) => f.path).sort()).toEqual([
      "content/posts/hello.mdx",
      "content/posts/old.mdx",
    ]);
    expect(files[0]!.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("reads file content and blob sha", async () => {
    const { provider } = setup();
    const { content, sha } = await provider.read("content/posts/hello.mdx");
    expect(content).toContain("# Hello");
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("commits multiple files atomically (one commit, parent-linked)", async () => {
    const { fake, provider } = setup();
    const before = fake.headSha("main");

    const result = await provider.commit(
      [
        { path: "content/posts/new.mdx", content: "# New post\n" },
        { path: "public/media/img.png", content: new Uint8Array([137, 80, 78, 71]) },
      ],
      "mdmx: create posts/new",
    );

    // Exactly one new commit, fast-forwarded from the previous head.
    expect(fake.commitChain("main")).toEqual([result.sha, before]);

    const post = await provider.read("content/posts/new.mdx");
    expect(post.content).toBe("# New post\n");
    const media = await provider.list("public/media");
    expect(media).toHaveLength(1);
  });

  it("detects concurrent modification via expectedShas", async () => {
    const { provider } = setup();
    const { sha: loadedSha } = await provider.read("content/posts/hello.mdx");

    // Someone else edits the file after we loaded it.
    await provider.commit(
      [{ path: "content/posts/hello.mdx", content: "# Edited elsewhere\n" }],
      "other edit",
    );

    await expect(
      provider.commit(
        [{ path: "content/posts/hello.mdx", content: "# My stale edit\n" }],
        "stale edit",
        { expectedShas: { "content/posts/hello.mdx": loadedSha } },
      ),
    ).rejects.toThrow(ConflictError);

    // With the fresh sha it succeeds.
    const { sha: freshSha } = await provider.read("content/posts/hello.mdx");
    await expect(
      provider.commit(
        [{ path: "content/posts/hello.mdx", content: "# Rebased edit\n" }],
        "rebased edit",
        { expectedShas: { "content/posts/hello.mdx": freshSha } },
      ),
    ).resolves.toMatchObject({ message: "rebased edit" });
  });

  it("supports expectedShas null for create-if-absent", async () => {
    const { provider } = setup();
    await expect(
      provider.commit(
        [{ path: "content/posts/hello.mdx", content: "x" }],
        "create over existing",
        { expectedShas: { "content/posts/hello.mdx": null } },
      ),
    ).rejects.toThrow(ConflictError);

    await expect(
      provider.commit([{ path: "content/posts/brand-new.mdx", content: "x" }], "create", {
        expectedShas: { "content/posts/brand-new.mdx": null },
      }),
    ).resolves.toBeDefined();
  });

  it("deletes files via a tree entry with sha null", async () => {
    const { provider } = setup();
    await provider.commit(
      [{ path: "content/posts/old.mdx", delete: true }],
      "mdmx: delete posts/old",
    );
    const files = await provider.list("content/posts");
    expect(files.map((f) => f.path)).toEqual(["content/posts/hello.mdx"]);
  });

  it("renames atomically: one commit writes the new path and drops the old", async () => {
    const { fake, provider } = setup();
    const before = fake.headSha("main");
    const result = await provider.commit(
      [
        { path: "content/posts/renamed.mdx", content: "# Old\n" },
        { path: "content/posts/old.mdx", delete: true },
      ],
      "mdmx: rename old → renamed",
    );
    // Exactly one commit for both halves of the move.
    expect(fake.commitChain("main")).toEqual([result.sha, before]);
    const paths = (await provider.list("content/posts")).map((f) => f.path);
    expect(paths).toContain("content/posts/renamed.mdx");
    expect(paths).not.toContain("content/posts/old.mdx");
  });

  it("reads binary content as bytes", async () => {
    const { provider } = setup();
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await provider.commit([{ path: "public/media/logo.png", content: png }], "add logo");
    const { content } = await readBytes(provider, "public/media/logo.png");
    expect(Array.from(content)).toEqual(Array.from(png));
  });

  it("falls back to the Blob API when the Contents API declines to inline (1-100MB)", async () => {
    const { fake } = setup();
    // Simulate GitHub's over-1MB response: encoding "none", empty content.
    const decliningFetch: typeof globalThis.fetch = async (input, init) => {
      const res = await fake.fetch(input, init);
      if (String(input).includes("/contents/") && init?.method === "GET") {
        const body = (await res.json()) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...body, content: "", encoding: "none" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return res;
    };
    const provider = new GitHubProvider({
      owner: "jane",
      repo: "blog",
      branch: "main",
      token: "test-token",
      fetch: decliningFetch,
    });
    const { content } = await readText(provider, "content/posts/hello.mdx");
    // Previously this silently returned "" — and a save would commit the truncation.
    expect(content).toContain("# Hello");
  });

  it("rejects path traversal everywhere", async () => {
    const { provider } = setup();
    await expect(provider.read("../secrets.txt")).rejects.toThrow(PathSafetyError);
    await expect(
      provider.commit([{ path: "content/../.github/workflows/evil.yml", content: "x" }], "evil"),
    ).rejects.toThrow(PathSafetyError);
    await expect(
      provider.commit([{ path: "/etc/passwd", delete: true }], "evil"),
    ).rejects.toThrow(PathSafetyError);
  });

  it("maps a lost ref-update race (non-fast-forward 422) to ConflictError", async () => {
    const { fake } = setup();
    const competitor = new GitHubProvider({
      owner: "jane",
      repo: "blog",
      branch: "main",
      token: "test-token",
      fetch: fake.fetch,
    });
    // Advance the branch behind the writer's back, right before its ref update.
    let raced = false;
    const racingFetch: typeof globalThis.fetch = async (input, init) => {
      if (!raced && init?.method === "PATCH" && String(input).includes("/git/refs/heads/")) {
        raced = true;
        await competitor.commit(
          [{ path: "content/posts/racer.mdx", content: "# Racer\n" }],
          "competing commit",
        );
      }
      return fake.fetch(input, init);
    };
    const writer = new GitHubProvider({
      owner: "jane",
      repo: "blog",
      branch: "main",
      token: "test-token",
      fetch: racingFetch,
    });
    await expect(
      writer.commit([{ path: "content/posts/mine.mdx", content: "# Mine\n" }], "my commit"),
    ).rejects.toThrow(ConflictError);
  });

  it("surfaces a truncated tree listing as a deliberate 500, not an accidental crash", async () => {
    const { fake } = setup();
    const truncatingFetch: typeof globalThis.fetch = async (input, init) => {
      const res = await fake.fetch(input, init);
      if (String(input).includes("/git/trees/") && init?.method === "GET") {
        const body = (await res.json()) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...body, truncated: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return res;
    };
    const provider = new GitHubProvider({
      owner: "jane",
      repo: "blog",
      branch: "main",
      token: "test-token",
      fetch: truncatingFetch,
    });
    await expect(provider.list("content/posts")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 500,
    });
  });
});
