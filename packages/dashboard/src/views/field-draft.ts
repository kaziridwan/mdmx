import type {
  CollectionFieldConfig,
  ControlSpec,
  FrontmatterField,
  JsonValue,
} from "@mdmx/core";

/**
 * The field builder edits a flat draft row per field; this module converts
 * drafts ⇄ the authored `CollectionFieldConfig` record. Kept pure so the
 * form logic is unit-testable without React.
 *
 * The builder covers the flat control types; `list`/`object` controls can be
 * authored in `mdmx.config.json` directly and survive round trips through
 * the JSON escape hatch.
 */
export const BUILDER_CONTROL_TYPES = [
  "text",
  "textarea",
  "number",
  "boolean",
  "select",
  "multiselect",
  "date",
  "color",
  "image",
  "link",
  "json",
] as const;

export type BuilderControlType = (typeof BUILDER_CONTROL_TYPES)[number];

export interface FieldDraft {
  /** Stable client-side key (not persisted). */
  id: number;
  name: string;
  type: BuilderControlType | "advanced";
  required: boolean;
  /** Comma-separated options for select/multiselect. */
  options: string;
  /** Raw default value; parsed per control type. */
  defaultValue: string;
  description: string;
  /** Verbatim control JSON for types the builder doesn't edit (list/object). */
  advancedControl?: ControlSpec;
}

let nextId = 1;
export function emptyDraft(): FieldDraft {
  return {
    id: nextId++,
    name: "",
    type: "text",
    required: false,
    options: "",
    defaultValue: "",
    description: "",
  };
}

/** Prefill drafts from an existing collection's fields (for the edit form). */
export function fieldsToDrafts(fields: readonly FrontmatterField[]): FieldDraft[] {
  return fields.map((f) => {
    const base = emptyDraft();
    const flat = (BUILDER_CONTROL_TYPES as readonly string[]).includes(f.control.type);
    return {
      ...base,
      name: f.name,
      type: flat ? (f.control.type as BuilderControlType) : "advanced",
      required: f.required,
      options:
        f.control.type === "select" || f.control.type === "multiselect"
          ? f.control.options.join(", ")
          : "",
      defaultValue: f.default !== undefined ? defaultToText(f.default) : "",
      description: f.description ?? "",
      ...(flat ? {} : { advancedControl: f.control }),
    };
  });
}

function defaultToText(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export interface DraftConversion {
  fields: Record<string, CollectionFieldConfig>;
  problems: string[];
}

/** Convert builder rows to the authored record form, collecting problems. */
export function draftsToFields(drafts: readonly FieldDraft[]): DraftConversion {
  const fields: Record<string, CollectionFieldConfig> = {};
  const problems: string[] = [];

  for (const draft of drafts) {
    const name = draft.name.trim();
    if (name === "") {
      problems.push("every field needs a name");
      continue;
    }
    if (fields[name]) {
      problems.push(`duplicate field name "${name}"`);
      continue;
    }

    const control = draftControl(draft, problems);
    if (!control) continue;

    const field: CollectionFieldConfig = { control };
    if (draft.required) field.required = true;
    if (draft.description.trim()) field.description = draft.description.trim();

    const def = draftDefault(draft, problems);
    if (def !== undefined) field.default = def;

    fields[name] = field;
  }

  return { fields, problems };
}

function draftControl(draft: FieldDraft, problems: string[]): ControlSpec | null {
  if (draft.type === "advanced") {
    if (!draft.advancedControl) {
      problems.push(`field "${draft.name}": missing advanced control definition`);
      return null;
    }
    return draft.advancedControl;
  }
  if (draft.type === "select" || draft.type === "multiselect") {
    const options = draft.options
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (options.length === 0) {
      problems.push(`field "${draft.name}": ${draft.type} needs at least one option`);
      return null;
    }
    return { type: draft.type, options };
  }
  return { type: draft.type };
}

function draftDefault(draft: FieldDraft, problems: string[]): JsonValue | undefined {
  const raw = draft.defaultValue.trim();
  if (raw === "") return undefined;
  switch (draft.type) {
    case "number": {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        problems.push(`field "${draft.name}": default "${raw}" is not a number`);
        return undefined;
      }
      return n;
    }
    case "boolean":
      if (raw !== "true" && raw !== "false") {
        problems.push(`field "${draft.name}": boolean default must be true or false`);
        return undefined;
      }
      return raw === "true";
    case "select": {
      const options = draft.options.split(",").map((o) => o.trim());
      if (!options.includes(raw)) {
        problems.push(`field "${draft.name}": default "${raw}" is not one of the options`);
        return undefined;
      }
      return raw;
    }
    case "json":
    case "advanced":
      try {
        return JSON.parse(raw) as JsonValue;
      } catch {
        problems.push(`field "${draft.name}": default is not valid JSON`);
        return undefined;
      }
    default:
      return raw;
  }
}
