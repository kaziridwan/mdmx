import { describe, expect, it } from "vitest";
import type { CollectionSpec } from "@mdmx/core";
import { scaffoldDocument, slugify } from "../src/scaffold.js";

const posts: CollectionSpec = {
  name: "posts",
  dir: "content/posts",
  fields: [
    { name: "title", required: true, control: { type: "text" } },
    {
      name: "status",
      required: true,
      control: { type: "select", options: ["draft", "published"] },
      default: "draft",
    },
    { name: "slug", required: false, control: { type: "text" } },
    { name: "rating", required: true, control: { type: "number" } },
    { name: "summary", required: false, control: { type: "textarea" } },
  ],
};

describe("slugify", () => {
  it("produces file-safe slugs", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  --spaces & symbols--  ")).toBe("spaces-symbols");
    expect(slugify("!!!")).toBe("untitled");
  });
});

describe("scaffoldDocument", () => {
  it("fills title/slug/defaults/required fallbacks in declared order", () => {
    const doc = scaffoldDocument(posts, "My Post", "my-post");
    const [, fm, body] = doc.split("---");
    expect(fm).toContain("title: My Post");
    expect(fm).toContain("status: draft"); // declared default
    expect(fm).toContain("slug: my-post");
    expect(fm).toContain("rating: 0"); // required, no default → fallback
    expect(fm).not.toContain("summary"); // optional, no default → omitted
    // declared field order preserved
    const keys = fm!
      .trim()
      .split("\n")
      .map((l) => l.split(":")[0]);
    expect(keys).toEqual(["title", "status", "slug", "rating"]);
    expect(body).toContain("# My Post");
  });

  it("always includes a title even without a title field", () => {
    const bare: CollectionSpec = { name: "x", dir: "content/x", fields: [] };
    expect(scaffoldDocument(bare, "T", "t")).toContain("title: T");
  });
});
