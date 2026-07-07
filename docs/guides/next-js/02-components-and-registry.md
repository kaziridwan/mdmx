# 2 · Components & the registry

MDMX's core promise: **your own React components are the editor's blocks**.
You tag a component with `defineMDMX()`, run `mdmx generate`, and the CLI
extracts its props via the TypeScript compiler API into a typed **registry**.
The registry drives everything downstream — the validator, the editor palette,
the prop panel, and live rendering.

## Tag a component with `defineMDMX()`

```tsx
// components/mdmx/Callout.tsx
import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

interface CalloutProps {
  /** Short label shown in the header */
  title?: string;
  variant: "info" | "warn" | "danger";
  children: ReactNode;
}

function Callout({ title, variant, children }: CalloutProps) {
  return (
    <aside data-variant={variant}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </aside>
  );
}

export default defineMDMX(Callout, {
  name: "Callout",
  category: "Content",
  icon: "alert-circle",
  description: "Highlighted box for notes and warnings",
  children: "rich-text",
  props: {
    variant: { default: "info" },
    title: { placeholder: "Optional title" },
  },
  preview: { variant: "info", title: "Example", children: "Sample text" },
});
```

What the codegen does with this:

- **Props come from your TypeScript types.** `variant: "info" | "warn" |
  "danger"` becomes a `select` control with those options; `title?: string`
  becomes an optional `text` control; the JSDoc comment becomes the prop's
  description in the prop panel. You don't re-declare prop types in the config.
- **The `props` block is per-prop overrides** merged over inference: defaults,
  placeholders, or a different control than the inferred one.
- **`preview`** is the prop set used to render the block when it's inserted
  from the palette.

`defineMDMX(component, config)` returns the component unchanged (it attaches
metadata under a symbol), so the same export renders on your public site.

### `DefineMDMXConfig` reference

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `string` (required) | The JSX tag name in content (`<Callout …>`), unique in the registry |
| `category` | `string` | Palette group (e.g. "Content", "Layout") |
| `icon` | `string` | Palette icon name |
| `description` | `string` | Shown in the palette and slash menu |
| `children` | `"none" \| "rich-text" \| "blocks"` | Children policy (below); default `none` |
| `props` | per-prop overrides | `default`, `placeholder`, `control`, `required`, `description` merged over inference |
| `preview` | props object | Props (plus optional `children` string) used for palette insertion |
| `constraints` | `{ allowedParents?, allowedChildren? }` | Slot constraints (below) |
| `version` | `number` | Bump when a component's contract changes |

### Children policies

| Policy | Content model | Example |
| --- | --- | --- |
| `none` | Leaf block, self-closing tag | `Stat`, `Hero` |
| `rich-text` | Inline formatting only — no headings, lists, or nested components | `Callout` |
| `blocks` | Nested block content, edited in place | `TwoColumn` |

### Container components and slot constraints

`constraints` restricts nesting. A two-column layout that only accepts
`Column` children:

```tsx
// components/mdmx/TwoColumn.tsx
export default defineMDMX(TwoColumn, {
  name: "TwoColumn",
  category: "Layout",
  icon: "columns",
  description: "Two side-by-side columns",
  children: "blocks",
  constraints: { allowedChildren: ["Column"] },
});
```

And `Column` declares `constraints: { allowedParents: ["TwoColumn"] }` so it
can't be dropped at the top level. Violations surface as validator diagnostics
(`MDMX004` / `MDMX005`) and the editor won't offer invalid drops.

### Prop controls

Controls are inferred from types, but you can force one via the `props`
override. Available `ControlSpec` types: `text`, `textarea`, `number`,
`boolean`, `select`, `multiselect`, `color`, `date`, `image`, `link`, `json`,
`list` (typed items), `object` (typed fields).

Remember the MDMX grammar: **prop values are JSON** — literals, arrays, plain
objects. Functions, identifiers, and JSX-valued props can't be expressed in
content, so design block components to take data, not render props.

## `mdmx.config.json`

The config lives at the project root:

```jsonc
{
  // Glob(s) for component definition files (default shown)
  "components": "components/mdmx/**/*.tsx",
  // Directory holding MDMX content files (default "content")
  "contentDir": "content",
  // Where registry artifacts are written (default ".mdmx")
  "outDir": ".mdmx",
  // Optional: typed collections (below)
  "collections": { … }
}
```

`mdmx.config.mjs` with a default export works too. All fields have defaults;
an empty config is valid.

### Collections: typed frontmatter

A **collection** is a content directory with a frontmatter schema. Fields use
the same `ControlSpec` vocabulary as component props, so the editor renders a
typed frontmatter panel and the validator enforces the schema (`MDMX008`
missing required field, `MDMX009` type mismatch):

```jsonc
"collections": {
  "posts": {
    "dir": "content/posts",
    "fields": {
      "title":  { "control": { "type": "text" }, "required": true },
      "status": {
        "control": { "type": "select", "options": ["draft", "published"] },
        "required": true,
        "default": "draft"
      },
      "slug":        { "control": { "type": "text" } },
      "description": { "control": { "type": "textarea" } },
      "coverImage":  { "control": { "type": "image" } }
    }
  }
}
```

A `status` field like this is also what powers draft/publish filtering on the
read side ([guide 5](05-rendering-content.md)).

## Generate the registry

```sh
pnpm exec mdmx generate
```

This scans the components glob, extracts each `defineMDMX` call and its prop
types, and writes two files into `outDir`:

- **`.mdmx/registry.json`** — pure data (`RegistrySpec`): component specs,
  controls, constraints, collections. Loadable anywhere, no React.
- **`.mdmx/registry.ts`** — bindings: imports your actual component modules
  and exports the spec, for code that needs both.

**Commit both files.** They are inputs to `next build`, and CI shouldn't have
to regenerate them to typecheck. Extraction problems (e.g. a prop type that
can't be represented) are printed as `file:line severity message` and a
generation with errors exits non-zero.

## Validate content: `mdmx check`

```sh
pnpm exec mdmx check
```

Validates every file under `contentDir` against the registry — grammar
violations, unregistered components, bad props, constraint and frontmatter
errors — and exits non-zero when errors exist. Wire it into CI next to your
linter so a hand-edited `.mdx` file can't break the site:

```yaml
- run: pnpm exec mdmx generate && pnpm exec mdmx check
```

## Watch mode: `mdmx dev`

```sh
pnpm exec mdmx dev
```

Watches the components glob and `mdmx.config.*`, regenerating on change
(debounced; skips the write when the registry hash is unchanged). Run it
alongside `next dev` when actively developing block components. All three
commands accept `--cwd <dir>`.

Next: [mount the content API →](03-content-api.md)
