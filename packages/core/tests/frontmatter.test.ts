import { describe, expect, it } from "vitest";
import {
  parseFrontmatter,
  stringifyFrontmatter,
  validateFrontmatter,
  Registry,
  type CollectionSpec,
} from "../src/index.js";

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
    { name: "views", required: false, control: { type: "number" } },
  ],
};

describe("stringifyFrontmatter / parseFrontmatter", () => {
  it("emits known fields first in field order, minimal scalar YAML", () => {
    const fm = { slug: "welcome", status: "published", title: "Welcome" };
    const yaml = stringifyFrontmatter(fm, ["title", "status", "slug"]);
    expect(yaml).toBe("title: Welcome\nstatus: published\nslug: welcome");
  });

  it("round-trips through parse", () => {
    const fm = { title: "Hi", status: "draft", views: 3 };
    expect(parseFrontmatter(stringifyFrontmatter(fm, ["title", "status"]))).toEqual(fm);
  });

  it("is idempotent (canonical is a fixed point)", () => {
    const once = stringifyFrontmatter({ title: "A", status: "draft" }, ["title", "status"]);
    const twice = stringifyFrontmatter(parseFrontmatter(once), ["title", "status"]);
    expect(twice).toBe(once);
  });

  it("appends unknown keys after known ones, dropping undefined", () => {
    const yaml = stringifyFrontmatter(
      { extra: "x", title: "T", status: undefined as never },
      ["title", "status"],
    );
    expect(yaml).toBe("title: T\nextra: x");
  });

  it("empty frontmatter serializes to an empty string", () => {
    expect(stringifyFrontmatter({}, ["title"])).toBe("");
    expect(parseFrontmatter("")).toEqual({});
  });
});

describe("validateFrontmatter", () => {
  it("passes a valid document", () => {
    expect(
      validateFrontmatter({ title: "Hi", status: "published" }, posts),
    ).toEqual([]);
  });

  it("flags a missing required field as MDMX008", () => {
    const diags = validateFrontmatter({ status: "draft" }, posts);
    expect(diags.map((d) => d.code)).toEqual(["MDMX008"]);
    expect(diags[0]!.message).toContain("title");
  });

  it("flags a bad select value and wrong type as MDMX009", () => {
    const diags = validateFrontmatter(
      { title: "Hi", status: "live", views: "lots" },
      posts,
    );
    expect(diags.map((d) => d.code)).toEqual(["MDMX009", "MDMX009"]);
  });

  it("allows undeclared frontmatter keys", () => {
    expect(
      validateFrontmatter({ title: "Hi", status: "draft", custom: 1 }, posts),
    ).toEqual([]);
  });
});

describe("Registry.collectionForPath", () => {
  const registry = new Registry({
    mdmxRegistryVersion: 1,
    components: [],
    collections: [
      posts,
      { name: "pages", dir: "content", fields: [] },
    ],
  });

  it("matches by the longest dir prefix", () => {
    expect(registry.collectionForPath("content/posts/x.mdx")?.name).toBe("posts");
    expect(registry.collectionForPath("content/about.mdx")?.name).toBe("pages");
  });

  it("returns undefined outside any collection dir", () => {
    expect(registry.collectionForPath("other/x.mdx")).toBeUndefined();
  });
});
