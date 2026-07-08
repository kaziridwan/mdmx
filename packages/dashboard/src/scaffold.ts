import {
  stringifyFrontmatter,
  type CollectionSpec,
  type FrontmatterField,
  type JsonValue,
} from "@mdmx/core";

/** Turn a title into a URL/file-friendly slug. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

/** A sensible starting value for a required field that has no declared default. */
function fallbackValue(field: FrontmatterField): JsonValue {
  switch (field.control.type) {
    case "select":
      return field.control.options[0] ?? "";
    case "multiselect":
    case "list":
      return [];
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return "";
  }
}

/**
 * A valid starter document for a new entry in `collection`: canonical
 * frontmatter (title + slug + each field's default/required value, in the
 * collection's declared order) followed by a heading and an empty paragraph.
 * The first save through the editor re-canonicalizes the body.
 */
export function scaffoldDocument(
  collection: CollectionSpec,
  title: string,
  slug: string,
): string {
  const data: Record<string, JsonValue> = {};
  for (const field of collection.fields) {
    if (field.name === "title") data.title = title;
    else if (field.name === "slug") data.slug = slug;
    else if (field.default !== undefined) data[field.name] = field.default;
    else if (field.required) data[field.name] = fallbackValue(field);
  }
  if (!("title" in data)) data.title = title;

  const order = collection.fields.map((f) => f.name);
  const frontmatter = stringifyFrontmatter(data, order);
  return `---\n${frontmatter}\n---\n\n# ${title}\n\nStart writing…\n`;
}
