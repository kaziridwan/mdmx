import { describe, expect, it } from "vitest";
import type { FrontmatterField } from "@mdmx/core";
import {
  draftsToFields,
  emptyDraft,
  fieldsToDrafts,
  type FieldDraft,
} from "../src/views/field-draft.js";

function draft(over: Partial<FieldDraft>): FieldDraft {
  return { ...emptyDraft(), ...over };
}

describe("draftsToFields", () => {
  it("converts flat controls with required/description/default", () => {
    const { fields, problems } = draftsToFields([
      draft({ name: "title", type: "text", required: true }),
      draft({
        name: "status",
        type: "select",
        required: true,
        options: "draft, published",
        defaultValue: "draft",
        description: "Publication state",
      }),
      draft({ name: "count", type: "number", defaultValue: "3" }),
      draft({ name: "pinned", type: "boolean", defaultValue: "true" }),
    ]);
    expect(problems).toEqual([]);
    expect(fields.title).toEqual({ control: { type: "text" }, required: true });
    expect(fields.status).toEqual({
      control: { type: "select", options: ["draft", "published"] },
      required: true,
      default: "draft",
      description: "Publication state",
    });
    expect(fields.count).toEqual({ control: { type: "number" }, default: 3 });
    expect(fields.pinned).toEqual({ control: { type: "boolean" }, default: true });
  });

  it("collects problems instead of silently dropping data", () => {
    const cases: Array<[FieldDraft, string]> = [
      [draft({ name: "" }), "needs a name"],
      [draft({ name: "s", type: "select", options: " , " }), "at least one option"],
      [draft({ name: "n", type: "number", defaultValue: "abc" }), "not a number"],
      [draft({ name: "b", type: "boolean", defaultValue: "yep" }), "true or false"],
      [
        draft({ name: "s", type: "select", options: "a, b", defaultValue: "c" }),
        "not one of the options",
      ],
      [draft({ name: "j", type: "json", defaultValue: "{oops" }), "not valid JSON"],
    ];
    for (const [d, expected] of cases) {
      const { problems } = draftsToFields([d]);
      expect(problems.join("\n")).toContain(expected);
    }
    const dup = draftsToFields([draft({ name: "x" }), draft({ name: "x" })]);
    expect(dup.problems.join("\n")).toContain("duplicate");
  });
});

describe("fieldsToDrafts", () => {
  it("prefills drafts and survives a round trip", () => {
    const fields: FrontmatterField[] = [
      { name: "title", required: true, control: { type: "text" } },
      {
        name: "status",
        required: true,
        control: { type: "select", options: ["draft", "published"] },
        default: "draft",
      },
      {
        name: "tags",
        required: false,
        control: { type: "list", item: { type: "text" } },
      },
    ];
    const drafts = fieldsToDrafts(fields);
    expect(drafts.map((d) => d.type)).toEqual(["text", "select", "advanced"]);
    expect(drafts[1]!.options).toBe("draft, published");
    expect(drafts[1]!.defaultValue).toBe("draft");

    const { fields: back, problems } = draftsToFields(drafts);
    expect(problems).toEqual([]);
    expect(back.title).toEqual({ control: { type: "text" }, required: true });
    // The nested control survives verbatim through the advanced escape hatch.
    expect(back.tags).toEqual({ control: { type: "list", item: { type: "text" } } });
  });

  it("round-trips a multiselect array default as an array, not a JSON string", () => {
    const fields: FrontmatterField[] = [
      {
        name: "tags",
        required: false,
        control: { type: "multiselect", options: ["a", "b", "c"] },
        default: ["a", "b"],
      },
    ];
    const drafts = fieldsToDrafts(fields);
    expect(drafts[0]!.defaultValue).toBe("a, b");

    const { fields: back, problems } = draftsToFields(drafts);
    expect(problems).toEqual([]);
    expect(back.tags!.default).toEqual(["a", "b"]);
  });

  it("rejects a multiselect default outside the options", () => {
    const { problems } = draftsToFields([
      draft({
        name: "tags",
        type: "multiselect",
        options: "a, b",
        defaultValue: "a, z",
      }),
    ]);
    expect(problems.join("\n")).toContain("not one of the options");
  });

  it("round-trips advanced and json string defaults without spurious parse errors", () => {
    const fields: FrontmatterField[] = [
      {
        name: "layout",
        required: false,
        control: { type: "list", item: { type: "text" } },
        default: "wide",
      },
      { name: "meta", required: false, control: { type: "json" }, default: "hello" },
    ];
    const drafts = fieldsToDrafts(fields);
    // JSON-encoded so the advanced/json JSON.parse read-back succeeds.
    expect(drafts[0]!.defaultValue).toBe('"wide"');
    expect(drafts[1]!.defaultValue).toBe('"hello"');

    const { fields: back, problems } = draftsToFields(drafts);
    expect(problems).toEqual([]);
    expect(back.layout!.default).toBe("wide");
    expect(back.meta!.default).toBe("hello");
  });
});
