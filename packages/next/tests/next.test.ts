import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError, PathSafetyError, Registry, type RegistrySpec } from "@imdx/core";
import { getDocumentBySlug, getDocuments, LocalProvider } from "../src/index.js";

let root: string;
let provider: LocalProvider;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "imdx-local-"));
  provider = new LocalProvider(root);
  await provider.commit(
    [
      {
        path: "content/posts/hello.mdx",
        content: "---\ntitle: Hello\nstatus: published\n---\n\n# Hello\n",
      },
      {
        path: "content/posts/draft.mdx",
        content: "---\ntitle: WIP\nstatus: draft\nslug: custom-slug\n---\n\n# WIP\n",
      },
      {
        path: "content/posts/nested/deep.mdx",
        content: "---\ntitle: Deep\nstatus: published\n---\n\n<Mystery />\n",
      },
    ],
    "seed",
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("LocalProvider", () => {
  it("lists recursively with git-style blob shas", async () => {
    const files = await provider.list("content/posts");
    expect(files.map((f) => f.path)).toEqual([
      "content/posts/draft.mdx",
      "content/posts/hello.mdx",
      "content/posts/nested/deep.mdx",
    ]);
    expect(files[0]!.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("read returns the same sha list reports", async () => {
    const files = await provider.list("content/posts");
    const hello = files.find((f) => f.path === "content/posts/hello.mdx")!;
    const { sha } = await provider.read("content/posts/hello.mdx");
    expect(sha).toBe(hello.sha);
  });

  it("enforces optimistic concurrency like the GitHub provider", async () => {
    await provider.commit([{ path: "content/cc.mdx", content: "# v1\n" }], "seed cc");
    const { sha: loaded } = await provider.read("content/cc.mdx");
    await provider.commit(
      [{ path: "content/cc.mdx", content: "# Edited elsewhere\n" }],
      "other edit",
    );
    await expect(
      provider.commit([{ path: "content/cc.mdx", content: "# Stale\n" }], "stale", {
        expectedShas: { "content/cc.mdx": loaded },
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("supports expectedShas null for create-if-absent", async () => {
    await expect(
      provider.commit([{ path: "content/cc.mdx", content: "x" }], "clobber", {
        expectedShas: { "content/cc.mdx": null },
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("deletes files", async () => {
    await provider.commit([{ path: "content/tmp.mdx", content: "x" }], "add");
    await provider.delete("content/tmp.mdx", "remove");
    const files = await provider.list("content");
    expect(files.some((f) => f.path === "content/tmp.mdx")).toBe(false);
  });

  it("rejects traversal and absolute paths", async () => {
    await expect(provider.read("../etc/passwd")).rejects.toThrow(PathSafetyError);
    await expect(
      provider.commit([{ path: "/tmp/evil", content: "x" }], "evil"),
    ).rejects.toThrow(PathSafetyError);
  });
});

describe("content readers", () => {
  it("getDocuments parses frontmatter and derives slugs", async () => {
    const docs = await getDocuments(join(root, "content/posts"));
    expect(docs.map((d) => d.slug)).toEqual(["custom-slug", "hello", "nested/deep"]);
    const hello = docs.find((d) => d.slug === "hello")!;
    expect(hello.frontmatter.title).toBe("Hello");
    expect(hello.source).toContain("# Hello");
  });

  it("filters by frontmatter status", async () => {
    const published = await getDocuments(join(root, "content/posts"), {
      status: "published",
    });
    expect(published.map((d) => d.slug)).toEqual(["hello", "nested/deep"]);
  });

  it("getDocumentBySlug honors frontmatter slug overrides", async () => {
    const doc = await getDocumentBySlug(join(root, "content/posts"), "custom-slug");
    expect(doc).not.toBeNull();
    expect(doc!.path).toBe("draft.mdx");
  });

  it("attaches diagnostics when a registry is provided", async () => {
    const registry = new Registry({
      imdxRegistryVersion: 1,
      components: [],
    } satisfies RegistrySpec);
    const doc = await getDocumentBySlug(join(root, "content/posts"), "nested/deep", {
      registry,
    });
    expect(doc!.diagnostics!.map((d) => d.code)).toContain("IMDX001"); // <Mystery />
  });
});
