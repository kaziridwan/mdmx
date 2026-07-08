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
});
