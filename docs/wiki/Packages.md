# Packages

Per-package reference. Test counts are current as of the last session (see
[Session Log](SessionLog.md)); update them when they change.

---

## @imdx/core — 38 tests

The format. Zero React/Next dependencies (Invariant #9).

| File | Responsibility |
| --- | --- |
| `types.ts` | All shared types: `JsonValue`, diagnostics + codes, `ControlSpec` taxonomy, `ComponentSpec`/`RegistrySpec`, `Registry` class, `defineIMDX`. |
| `parse.ts` | `parseMDX`/`parseDocument` — the single shared remark processor (frontmatter + GFM + MDX). |
| `props.ts` | `evaluateAttributes`/`evaluateExpression` — enforces props-are-JSON by walking attribute estrees. |
| `validate.ts` | `validateTree`/`validateSource` — subset whitelist, registry membership, prop schema, children policies, slot constraints → diagnostics. |
| `serialize.ts` | `toMDX` + pinned `CANONICAL_STRINGIFY_OPTIONS`/`CANONICAL_MDX_OPTIONS`. |
| `provider.ts` | `ContentProvider` contract, `ConflictError`, `PathSafetyError`, `assertSafePath`. |
| `frontmatter.ts` | `parseFrontmatter`/`stringifyFrontmatter` (canonical YAML, pinned `CANONICAL_YAML_OPTIONS`) + `validateFrontmatter` (IMDX008/009). Collections: `CollectionSpec`, `Registry.collectionForPath`. |

Key exports: `parseMDX`, `parseDocument`, `validateTree`, `validateSource`,
`validateFrontmatter`, `stringifyFrontmatter`, `toMDX`, `Registry`,
`defineIMDX`, `assertSafePath`, `ConflictError`.

---

## @imdx/cli — 19 tests

Tooling. Binary: `imdx`. Reads `collections` from `imdx.config.json`, emits them
into the registry, and validates frontmatter in `check`.

| File | Responsibility |
| --- | --- |
| `bin.ts` | CLI entry; `generate`, `check`, and `dev` subcommands; exit codes for CI. |
| `config.ts` | Loads `imdx.config.json`/`.mjs`; defaults. |
| `extract.ts` | Walks a `ts.Program` for `defineIMDX` calls; pulls props from the component type; merges config. |
| `infer.ts` | `ts.Type` → `ControlSpec` (string→text, literal union→select, array→list, …); `isFunctionType`. |
| `static-eval.ts` | Statically evaluates the `defineIMDX` config literal to JSON (never executes user code). |
| `generate.ts` | Orchestrates discovery→extraction→dedup→emit `registry.json` + `registry.ts`. |
| `check.ts` | Loads the registry, runs the core validator over content, formats diagnostics. |
| `dev.ts` | Watch mode: derives watch targets from the component glob + config (never the `outDir`), regenerates on change with a debounced, hash-diffed loop. Injectable watcher/scheduler. |

Commands: `imdx generate` (→ `.imdx/registry.{json,ts}`), `imdx check`
(lint, exit 1 on errors), `imdx dev` (watch components/config, regenerate the
registry on change; reports `unchanged` when the content hash is identical).

---

## @imdx/editor — 51 tests

Registry→ProseMirror, converters, commands (main entry, React-free), plus the
flat React editor UI behind the `@imdx/editor/react` subpath.

| File | Responsibility |
| --- | --- |
| `schema.ts` | `buildSchema(registry)` — static markdown core + one node per component; children policies → content expressions; `MARK_PRIORITY`. |
| `from-mdast.ts` | `fromMdast` — mdast → PM doc; mark accumulation; component nodes; `imdx_raw` fallback. |
| `to-mdast.ts` | `toMdast` + `printPropValue` — PM doc → mdast; priority-ordered mark grouping; canonical prop printing. |
| `commands.ts` | `slashItems`, `insertComponent`, `imdxInputRules`, mark commands, `initialProps`. |
| `react/react-node-view.tsx` | Thin React-NodeView adapter (one React root per component node; `contentDOM` placement). Replaces TipTap (ADR-023). |
| `react/ComponentBlock.tsx` | Generic component renderer: live author component + error boundary → placeholder card; content hole for rich-text/blocks. |
| `react/Editor.tsx` | `IMDXEditor` — owns the `EditorView` (history, baseKeymap, input rules, drop/gap cursor, slash plugin), builds per-component NodeViews, drag-from-rail drop; composes the chrome. |
| `react/Rail.tsx`, `SlashMenu.tsx`, `PropPanel.tsx`, `SourcePane.tsx` | Chrome: component palette, `/`-menu, props editor (one tx per edit), live canonical source with active-block marking. |
| `react/Editor.tsx` (`onSave`/`docTitle`/`collection`) | Optional save toolbar (dirty/saving/saved/error); serializes the doc via `serializeDoc` and hands canonical iMDX to the host. Used by the Next mount page. |
| `react/FrontmatterPanel.tsx`, `controls.tsx` | Document-level panel editing a collection's typed frontmatter; writes canonical YAML to the doc attr in one tx. `Control` is the shared typed input (also used by `PropPanel`). |
| `react/media.ts`, `MediaLibrary.tsx` | Media library: `MediaSource` adapter (API-agnostic `list`/`upload`), pure upload helpers (`fileToUpload`/`safeFilename`/`bytesToBase64`), `insertImage` command, and the modal browser/uploader. Wired via the editor's `media` prop (ADR-027). |
| `react/slash-plugin.ts`, `source-map.ts`, `prop-controls.ts` | Slash trigger plugin; doc→canonical serialization + active-block line mapping; prop value coercion (pure, unit-tested). |

`@imdx/editor` main export stays React-free (Invariant 9); React imports come
from `@imdx/editor/react`. The interactive design **spec** remains
`examples/editor-prototype.html`; the runnable harness is
`examples/editor-playground`. Nested editing (TwoColumn) and the media library
have landed; remaining polish is nested drop indicators + per-region slash.

---

## @imdx/next — 37 tests

Next.js integration. The editor mount page lives in `examples/demo-next`.
Saves are validated against the file's collection schema (IMDX008/009).

| File | Responsibility |
| --- | --- |
| `local-provider.ts` | `LocalProvider` — dev-mode FS storage; git-style blob shas (mirrors GitHub conflict semantics). |
| `content.ts` | `getDocuments`/`getDocumentBySlug` — build-time readers; frontmatter, status filter, optional registry validation. |
| `session.ts` | AES-256-GCM sealed cookies; `seal`/`unseal`; cookie helpers. |
| `auth.ts` | GitHub OAuth: `authorizeUrl`, `exchangeCode`, `verifyRepoAccess` (push-permission check). |
| `api.ts` | `createIMDXHandlers` — web-standard Request→Response for auth + content/media CRUD. Supports **`localMode`** (no OAuth; synthetic `local` session; ADR-024) for local authoring; a parse failure on save returns 400, not 500. |

Security posture (ADR-016/017/018): server-side validation on every save,
origin checks on mutations, prefix-confined paths, 5-min permission
re-verification, conflict 409s, media type/size limits + no-clobber.

---

## @imdx/provider-github — 7 tests

| File | Responsibility |
| --- | --- |
| `github-provider.ts` | `GitHubProvider` over the Git Data API: blobs→tree→commit→ref, fast-forward-only, `expectedShas` conflict detection, injectable fetch. |
| `tests/fake-github.ts` | In-memory GitHub implementing the exact endpoints used, with real git blob shas. |

---

## examples/

- `demo/` — minimal consumer (two components + content + config); run the CLI
  pipeline against it.
- `editor-prototype.html` — the interactive editor UI spec (self-contained
  React artifact). See [TwoColumn](TwoColumn.md) for what it deliberately
  doesn't do yet.
- `editor-playground/` — Vite harness that mounts `@imdx/editor/react` against
  the demo registry + components and `welcome.mdx`. The primary interactive
  verification surface for the real editor. (Build core + editor and run
  `imdx generate` in `demo/` first; see its README.)
- `demo-next/` — a complete, runnable **Next.js** app dogfooding the full loop
  locally (list → edit → save canonical iMDX to disk, conflict-safe) via
  `@imdx/next` `localMode` (ADR-024). The reference editor mount page. See its
  README to run.
