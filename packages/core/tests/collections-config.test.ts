import { describe, expect, it } from "vitest";
import {
  collectionFromConfig,
  collectionsFromConfig,
  collectionToConfig,
  validateCollectionConfig,
  type CollectionConfig,
  type CollectionSpec,
} from "../src/index.js";

const postsConfig: CollectionConfig = {
  dir: "content/posts",
  fields: {
    title: { control: { type: "text" }, required: true },
    status: {
      control: { type: "select", options: ["draft", "published"] },
      required: true,
      default: "draft",
    },
    summary: { control: { type: "textarea" }, description: "Shown in lists" },
  },
};

describe("collectionsFromConfig", () => {
  it("derives the array form, preserving field order and metadata", () => {
    const spec = collectionFromConfig("posts", postsConfig);
    expect(spec.name).toBe("posts");
    expect(spec.dir).toBe("content/posts");
    expect(spec.fields.map((f) => f.name)).toEqual(["title", "status", "summary"]);
    expect(spec.fields[0]).toEqual({
      name: "title",
      required: true,
      control: { type: "text" },
    });
    expect(spec.fields[1]!.default).toBe("draft");
    expect(spec.fields[2]).toEqual({
      name: "summary",
      required: false,
      control: { type: "textarea" },
      description: "Shown in lists",
    });
  });

  it("sorts collections by name and handles the absent block", () => {
    const specs = collectionsFromConfig({
      zebra: { dir: "content/zebra", fields: {} },
      alpha: { dir: "content/alpha", fields: {} },
    });
    expect(specs.map((c) => c.name)).toEqual(["alpha", "zebra"]);
    expect(collectionsFromConfig(undefined)).toEqual([]);
  });
});

describe("collectionToConfig", () => {
  it("round-trips a spec back to the authored record form", () => {
    const spec: CollectionSpec = collectionFromConfig("posts", postsConfig);
    const back = collectionToConfig(spec);
    expect(back).toEqual(postsConfig);
    // and the round trip is a fixed point
    expect(collectionToConfig(collectionFromConfig("posts", back))).toEqual(back);
  });
});

describe("validateCollectionConfig", () => {
  it("accepts a well-formed collection", () => {
    expect(validateCollectionConfig("posts", postsConfig)).toEqual([]);
  });

  it("rejects bad names", () => {
    expect(validateCollectionConfig("My Posts", postsConfig)).not.toEqual([]);
    expect(
      validateCollectionConfig("posts", {
        dir: "content/posts",
        fields: { "Bad Key": { control: { type: "text" } } },
      }),
    ).not.toEqual([]);
  });

  it("rejects missing dir and malformed fields", () => {
    expect(validateCollectionConfig("posts", { dir: "", fields: {} })).not.toEqual([]);
    expect(
      validateCollectionConfig("posts", {
        dir: "content/posts",
        fields: null as unknown as CollectionConfig["fields"],
      }),
    ).not.toEqual([]);
  });

  it("rejects unknown and incomplete controls, recursively", () => {
    expect(
      validateCollectionConfig("posts", {
        dir: "content/posts",
        fields: { x: { control: { type: "wat" } as never } },
      }),
    ).not.toEqual([]);
    expect(
      validateCollectionConfig("posts", {
        dir: "content/posts",
        fields: { x: { control: { type: "select", options: [] } } },
      }),
    ).not.toEqual([]);
    expect(
      validateCollectionConfig("posts", {
        dir: "content/posts",
        fields: {
          x: { control: { type: "list", item: { type: "nope" } as never } },
        },
      }),
    ).not.toEqual([]);
    expect(
      validateCollectionConfig("posts", {
        dir: "content/posts",
        fields: {
          x: {
            control: {
              type: "object",
              fields: { inner: { type: "select", options: ["a"] } },
            },
          },
        },
      }),
    ).toEqual([]);
  });
});
