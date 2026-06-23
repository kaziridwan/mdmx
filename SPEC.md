# MDMX Specification — v1

**Status:** draft, implemented by `@mdmx/core` 0.1.x.
**Spec version:** `MDMX_SPEC_VERSION = 1`.

MDMX ("interactive MDX") is a strict subset of MDX designed to be losslessly
round-trippable through a block editor while remaining a plain, reviewable
text format in a git repository. It is defined as a **validation layer over
the standard MDX AST** (mdast + mdx-jsx nodes): any conforming MDX parser
produces the tree; this spec says which trees are valid and how valid trees
serialize.

## 1. Document structure

An MDMX document is UTF-8 text consisting of optional YAML frontmatter
followed by flow content.

### 1.1 Frontmatter

- Delimited by `---` lines at the very start of the file; body is YAML.
- Reserved keys (tooling may rely on them): `title`, `slug`, `status`,
  `publishedAt`, `description`, `coverImage`. Collections may define more.
- All document metadata lives here; the body never carries exports.
- **Canonical YAML.** Frontmatter is preserved verbatim on round-trips it isn't
  edited through. When the editor *edits* a field, the block is re-emitted in
  canonical form: known collection fields first (in schema order), remaining
  keys in their existing order, pinned options (`CANONICAL_YAML_OPTIONS`,
  currently `lineWidth: 0`). Changing these options is **semver-major**.

### 1.2 Markdown layer

CommonMark plus the following GFM slice. **Allowed mdast node types:**

`root`, `paragraph`, `heading`, `text`, `emphasis`, `strong`, `delete`,
`inlineCode`, `link`, `image`, `list`, `listItem` (incl. task-list `checked`),
`blockquote`, `code`, `thematicBreak`, `break`, `table`, `tableRow`,
`tableCell`, `yaml`, `mdxJsxFlowElement`.

**Excluded** (diagnostic MDMX003): raw HTML (`html`), ESM (`mdxjsEsm` — no
`import`/`export`), expressions (`mdxFlowExpression`, `mdxTextExpression`),
inline JSX (`mdxJsxTextElement`), reference-style links/images
(`definition`, `linkReference`, `imageReference`), footnotes, and anything
else not listed above.

### 1.3 JSX layer

1. Only **block-level** JSX elements (`mdxJsxFlowElement`).
2. The element name must be **PascalCase** (`/^[A-Z][A-Za-z0-9]*$/`) and
   present in the registry (MDMX001). Fragments (`<>…</>`) are invalid.
3. **Props are JSON** (MDMX002). Allowed attribute forms:
   - string attribute: `title="Revenue"`
   - boolean shorthand: `stacked` (value `true`)
   - expression containers limited to: string/number/boolean/null literals,
     unary minus on a number, array literals, object literals with
     identifier or string-literal keys. No identifiers, calls, templates,
     spreads, computed keys, regex, or holes.
4. Children are governed by the component's declared **children policy**:
   - `none` — element must be childless (self-closing in canonical form)
   - `rich-text` — children are paragraphs of phrasing content only
     (`text`, `emphasis`, `strong`, `delete`, `inlineCode`, `link`, `break`);
     no headings, lists, or nested components (MDMX004)
   - `blocks` — any valid MDMX flow content, recursively, including components
5. Slot constraints: a component may declare `allowedChildren` (direct
   children must be those components — MDMX004) and/or `allowedParents`
   (it may only appear inside those components — MDMX005).
6. Required props without a registry default must be present (MDMX006);
   undeclared props are a warning (MDMX007).

## 2. Canonical form

Every MDMX tree has exactly one canonical serialization. Editors and tooling
always emit canonical form; hand-written files are normalized on first save.
Guarantees:

- `serialize(parse(x)) === x` for canonical `x` (fixed point)
- `parse(serialize(t))` is structurally equal to `t` for any valid tree
- Editing one component prop changes exactly one output line

Canonical choices (normative; changing any is a **major** version of this spec):

- Bullets `-`; emphasis `*`; strong `**`; fenced code with ` ``` `; ATX
  headings; rule `---`; list-item indent of one space; tight lists.
- JSX attributes use double quotes. Elements whose serialized open tag
  exceeds 80 columns wrap one attribute per line. `true` props use boolean
  shorthand. Childless elements are self-closing.
- Prop expression printing: `, ` separators; object keys unquoted when they
  match `/^[A-Za-z_$][A-Za-z0-9_$]*$/`, otherwise double-quoted; strings
  double-quoted (JSON escaping); e.g. `{legend: "top", max: -5}`.
- Inline mark nesting order, outermost→innermost: link, strong, emphasis,
  strikethrough, inline code. (Links never split; `inlineCode` is a leaf.)
- File ends with exactly one newline.

## 3. Escape hatch (raw regions)

Validators reject out-of-subset content; **editors must not destroy it**.
A conforming editor wraps each invalid region in an opaque read-only raw
block holding the exact source slice and re-emits it byte-for-byte. `mdmx
check` still reports such regions, so CI stays strict while the editor stays
forgiving.

## 4. Diagnostics

Structured as `{ code, severity, message, span? }` with 1-indexed
line/column spans. Codes are stable API:

| Code | Severity | Meaning |
| --- | --- | --- |
| MDMX001 | error | JSX element not in the registry |
| MDMX002 | error | Prop value not statically serializable / spread attribute |
| MDMX003 | error | Node type outside the MDMX subset |
| MDMX004 | error | Child violates children policy or allowedChildren |
| MDMX005 | error | Component outside its allowedParents |
| MDMX006 | error | Required prop missing (and no registry default) |
| MDMX007 | warning | Prop not declared by the component spec |
| MDMX008 | error | Required frontmatter field missing (per the collection schema) |
| MDMX009 | error | Frontmatter field value does not match its declared control/type |

## 5. Registry

The registry is generated by `mdmx generate` from `defineMDMX` calls; prop
metadata is inferred from TypeScript types and overlaid with explicit config
(explicit wins). Two artifacts:

- `.mdmx/registry.json` — pure data (shape below)
- `.mdmx/registry.ts` — imports the actual components and binds them

```jsonc
{
  "mdmxRegistryVersion": 1,
  "generatedAt": "ISO-8601",
  "hash": "16-hex content hash of the component specs",
  "components": [{
    "name": "Callout",                  // PascalCase, unique
    "category": "Content",              // optional palette grouping
    "icon": "alert-circle",             // optional
    "description": "…",                 // optional
    "source": "components/mdmx/Callout.tsx",
    "version": 1,                        // optional, for future migrations
    "children": { "policy": "none" | "rich-text" | "blocks" },
    "props": [{
      "name": "variant",
      "required": true,
      "control": { /* see control taxonomy */ },
      "default": "info",                // JSON value, optional
      "description": "…"                // optional (JSDoc-derived)
    }],
    "constraints": { "allowedParents": null | ["…"], "allowedChildren": null | ["…"] },
    "render": { "mode": "live" | "placeholder" | "static" }
  }],
  "collections": [{                       // optional; omitted when none configured
    "name": "posts",                      // unique
    "dir": "content/posts",               // matched by longest prefix to a path
    "fields": [{
      "name": "status",
      "required": true,
      "control": { "type": "select", "options": ["draft", "published"] },
      "default": "draft",                 // optional JSON value
      "description": "…"                  // optional
    }]
  }]
}
```

**Collections** group content under a `dir` and give it a typed frontmatter
schema (`fields`, reusing the control taxonomy). They are authored in
`mdmx.config.json` and emitted into the registry by `mdmx generate`. The `hash`
covers components **and** collections. Frontmatter is validated against the
matching collection (longest `dir` prefix) by `mdmx check` and on save:
required fields → MDMX008, value/type mismatches → MDMX009; undeclared keys are
allowed. Draft/publish is modeled with a `status` field (e.g.
`select` over `["draft", "published"]`); readers filter by it.

**Control taxonomy** (discriminated union on `type`): `text` / `textarea`
(`placeholder?`), `number` (`min?`, `max?`, `step?`), `boolean`, `select` /
`multiselect` (`options`), `color`, `date`, `image`, `link`, `json`,
`list` (`item: Control`), `object` (`fields: Record<string, Control>`).
Inference: `string`→text, `number`→number, `boolean`→boolean, string-literal
union→select, `T[]`→list of inferred `T`, other objects/unions→json.
Function-typed props are excluded (warning); a *required* function prop is an
error — the component could never appear in content.

## 6. Provider contract

Content storage implements `ContentProvider` (`@mdmx/core`):

- `list(dir)` → recursive blob listing `{path, sha, size}`
- `read(path)` → `{content, sha}` where `sha` is the **git blob sha**
- `commit(changes[], message, {expectedShas?})` — atomic multi-file write;
  `expectedShas` maps path→sha the caller loaded (`null` = must not exist);
  mismatch throws `ConflictError`
- `delete(path, message, {expectedShas?})`

All paths pass `assertSafePath` (no `..`, no absolute paths, no backslashes,
no drive letters, no control characters) **and** implementations re-verify
resolved-root containment. Implementations: `GitHubProvider` (Git Data API,
fast-forward-only ref updates), `LocalProvider` (development; identical
semantics, doubles as the reference implementation).

## 7. Versioning

- Documents may declare the spec they target (`mdmx: 1` in frontmatter or a
  repo-level config); absent means "current".
- The registry carries `mdmxRegistryVersion` and a content `hash`; editors
  must detect hash drift between a loaded document's session and the current
  registry. Per-component `version` fields reserve room for `mdmx migrate`
  codemods.

## Appendix: deliberate exclusions in v1

Inline (text-level) components; arbitrary expressions of any kind; raw HTML;
footnotes; reference links; loose lists in canonical output. Each exclusion
protects either the round-trip guarantee or the security model; revisiting
any of them is a spec-level decision, not an implementation detail.
