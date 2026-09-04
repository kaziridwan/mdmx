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
  variant?: "info" | "warn" | "danger";
  children: ReactNode;
}

function Callout({ title, variant = "info", children }: CalloutProps) {
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
  placeholders, a different control than the inferred one, or a `showIf`
  visibility rule.
- **A `default` mirrors the component.** Make it equal to the component's own
  default parameter (`variant = "info"` above): the prop panel shows it as
  the effective value, the validator accepts a missing required prop when a
  default exists, and `<Callout />` then renders the same on the page as in
  the editor.
- **`preview`** is what a freshly inserted block holds: its props over the
  defaults, plus `children` — the text of the first paragraph for a
  `rich-text` or `blocks` component. Keys must be declared props (the CLI
  warns about and drops any other). A default is what the component
  renders when a prop is absent; a preview is what an author should see
  first.

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
| `props` | per-prop overrides | `default`, `placeholder` (text/textarea/link), `control`, `required`, `description`, `showIf` merged over inference |
| `preview` | props object | Insert-time seed: props over the defaults, plus a `children` string for the first paragraph (registry v3) |
| `constraints` | `{ allowedParents?, allowedChildren? }` | Slot constraints (below) |
| `version` | `number` | Bump when a component's contract changes |
| `render` | `{ mode?, interactive? }` | `mode`: `live` (default) / `placeholder` / `static`. `interactive`: editor event routing — unset routes by target (buttons, inputs, tabs… are the component's; everything else selects the block), `true` gives the component every event (Alt-click selects), `false` gives the editor every event |

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
`list` (typed items), `object` (typed fields). The prop panel renders every
one of them: a `string[]` prop is edited as rows you add, remove, and
reorder, a `string[][]` as rows of rows. `text`, `textarea`, and `link`
take a `placeholder`.

TypeScript normalizes a string-literal union, so a `select` inferred from
`"top" | "right" | "bottom" | "left"` may list its options in a different
order; pass `control: { type: "select", options: [...] }` explicitly when the
order matters.

### Conditional props: `showIf`

A prop that only applies in one configuration can hide its control
otherwise:

```ts
props: {
  shape: { default: "text" },
  lines: { default: 3, showIf: { prop: "shape", eq: "text" } },
  primaryHref: { control: { type: "link" }, showIf: { prop: "primaryLabel" } },
}
```

`eq` compares against the governing prop's effective value (its default
counts); without `eq` the prop shows when the governing prop is truthy.
`showIf` is panel-only — a hidden prop keeps its value, is still validated,
and still serializes. The CLI checks that the governing prop exists.

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
