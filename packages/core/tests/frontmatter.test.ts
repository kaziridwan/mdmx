import { describe, expect, it } from "vitest";
import {
  parseDocument,
  parseFrontmatter,
  validateDocument,
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

  it('compares prefix lengths after normalization — a "./"-prefixed dir gets no head start', () => {
    const r = new Registry({
      mdmxRegistryVersion: 1,
      components: [],
      collections: [
        { name: "pages", dir: "./content/x/", fields: [] },
        { name: "posts", dir: "content/x/y", fields: [] },
      ],
    });
    expect(r.collectionForPath("content/x/y/a.mdx")?.name).toBe("posts");
  });
});

describe("validateDocument (the one validation seam)", () => {
  const registry = new Registry({
    mdmxRegistryVersion: 1,
    components: [{ name: "Callout", children: { policy: "rich-text" }, props: [] }],
    collections: [posts],
  });

  it("checks subset rules and frontmatter in one pass", () => {
    const codes = validateDocument(
      "---\nstatus: draft\n---\n\n<Mystery />\n",
      { registry, path: "content/posts/x.mdx" },
    ).map((d) => d.code);
    expect(codes).toContain("MDMX001"); // unknown component
    expect(codes).toContain("MDMX008"); // required frontmatter field missing
  });

  it("skips frontmatter checks for a document outside any collection", () => {
    const codes = validateDocument("---\nanything: 1\n---\n\n# Hi\n", {
      registry,
      path: "other/loose.mdx",
    }).map((d) => d.code);
    expect(codes).toEqual([]);
  });

  it("reports malformed YAML as MDMX010 instead of throwing", () => {
    // This used to abort an entire `mdmx check` run on one bad file.
    const diagnostics = validateDocument(
      "---\ntitle: [unclosed\n---\n\n# Hi\n",
      { registry, path: "content/posts/broken.mdx" },
    );
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("MDMX010");
    // No schema noise on top: the frontmatter couldn't be read at all.
    expect(codes).not.toContain("MDMX008");
    expect(diagnostics.find((d) => d.code === "MDMX010")!.span).toBeDefined();
  });

  it("reports non-mapping frontmatter", () => {
    const codes = validateDocument("---\n- just\n- a list\n---\n\n# Hi\n", {
      registry,
      path: "content/posts/list.mdx",
    }).map((d) => d.code);
    expect(codes).toContain("MDMX010");
  });

  it("parses the document once — parseDocument surfaces the same diagnostic", () => {
    const { frontmatter, frontmatterDiagnostic } = parseDocument("---\na: [\n---\n\n# Hi\n");
    expect(frontmatter).toEqual({});
    expect(frontmatterDiagnostic?.code).toBe("MDMX010");
  });
});
