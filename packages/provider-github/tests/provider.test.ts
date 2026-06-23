import { describe, expect, it } from "vitest";
import { ConflictError, PathSafetyError } from "@mdmx/core";
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
    await provider.delete("content/posts/old.mdx", "mdmx: delete posts/old");
    const files = await provider.list("content/posts");
    expect(files.map((f) => f.path)).toEqual(["content/posts/hello.mdx"]);
  });

  it("rejects path traversal everywhere", async () => {
    const { provider } = setup();
    await expect(provider.read("../secrets.txt")).rejects.toThrow(PathSafetyError);
    await expect(
      provider.commit([{ path: "content/../.github/workflows/evil.yml", content: "x" }], "evil"),
    ).rejects.toThrow(PathSafetyError);
    await expect(provider.delete("/etc/passwd", "evil")).rejects.toThrow(PathSafetyError);
  });
});
