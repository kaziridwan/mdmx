# Packages

Per-package reference. Test counts are current as of the last session (see
[Session Log](SessionLog.md)); update them when they change.

---

## @mdmx/core — 61 tests

The format. Zero React/Next dependencies (Invariant #9).

| File | Responsibility |
| --- | --- |
| `types.ts` | All shared types: `JsonValue`, diagnostics + codes, `ControlSpec` taxonomy (`link.placeholder` since v3), `ComponentSpec`/`RegistrySpec` (incl. `RenderSpec` — mode + `interactive` routing, ADR-052 — and `preview`, the insert-time seed, ADR-057), `PropSpec.showIf` + `isPropVisible` (the one panel-visibility rule), `Registry` class, `defineMDMX`, the `MDMX_SPEC_VERSION` / `MDMX_REGISTRY_VERSION` counters. |
| `parse.ts` | `parseMDX`/`parseDocument` — the single shared remark processor (frontmatter + GFM + MDX). |
| `props.ts` | `evaluateAttributes`/`evaluateExpression` — enforces props-are-JSON by walking attribute estrees. |
| `validate.ts` | `validateTree`/`validateSource` — subset whitelist, registry membership, prop schema, children policies, slot constraints → diagnostics. |
| `serialize.ts` | `toMDX` + pinned `CANONICAL_STRINGIFY_OPTIONS`/`CANONICAL_MDX_OPTIONS`. |
| `provider.ts` | `ContentProvider` contract, `ConflictError`, `PathSafetyError`, `assertSafePath`. |
| `frontmatter.ts` | `parseFrontmatter`/`stringifyFrontmatter` (canonical YAML, pinned `CANONICAL_YAML_OPTIONS`) + `validateFrontmatter` (MDMX008/009). Collections: `CollectionSpec`, `Registry.collectionForPath` (also standalone `collectionForPath`). |
| `collections-config.ts` | The authored (record-keyed) collections shape: `collectionsFromConfig`/`collectionToConfig` derivation (canonical, shared by CLI and the runtime API), `validateCollectionConfig` (recursive `ControlSpec` checks). ADR-035. |
| `studio.ts` | Component Studio model (ADR-038): restricted template tree + typed props, tag/attr allowlists, `validateStudioComponent`/`parseStudioComponent`, `studioComponentToSpec` (registry entry), `studioComponentToTSX` (eject codegen), storage path under `<contentDir>/_components/`. |

Key exports: `parseMDX`, `parseDocument`, `validateTree`, `validateSource`,
`validateFrontmatter`, `stringifyFrontmatter`, `toMDX`, `Registry`,
`collectionForPath`, `collectionsFromConfig`, `validateCollectionConfig`,
`defineMDMX`, `assertSafePath`, `ConflictError`.

---

## @mdmx/project — 16 tests

What a project on disk looks like: the layer between the spec and the runtimes
(ADR-043). Node-only, framework-free.

| File | Responsibility |
| --- | --- |
| `config.ts` | `MDMXConfig` schema + `DEFAULT_CONFIG`; `loadConfig` reads `mdmx.config.json` **or** `.mjs` (the CLI and the runtime used to disagree about this); `mergeConfig`, `validateConfig`, and `parseProjectConfig`/`ProjectConfigFile` for the provider-read path (ADR-035). |
| `env.ts` | `resolveMode` — GitHub when the OAuth vars are set, local when they aren't, and a `ModeResolutionError` naming the missing variables in production (ADR-039). `insecureCookiesDefault`. |
| `registry.ts` | `loadRegistrySpec`/`loadRegistry`/`tryLoadRegistrySpec` + `MissingRegistryError` that points at `mdmx generate`. |
| `tailwind.ts` | `detectTailwind(root)` — does the host run Tailwind? Decides the studio CSS handoff in the CLI and the browser runtime in the dashboard (ADR-054). |

---

## @mdmx/studio — 32 tests

The Component Studio, whole (ADR-045): model, semantics, renderer, and UI in
one package. Depends only on core; core never imports it.

| Entry | Responsibility |
| --- | --- |
| `.` | `model.ts` (types, `parseStudioComponent`, paths), `validate.ts` (tag/attr allowlists, `validateStudioComponent`), `spec.ts` (`studioComponentToSpec`), `merge.ts` (`mergeStudioSpecs` — the code-beats-studio rule the CLI and the runtime share), `eject.ts` (TSX codegen), `interpolate.ts` (the one `{props.x}` implementation). |
| `./react` | `studioComponent`/`studioRenderComponents` — the single template→React renderer, used by public pages, the dashboard preview, and the editor canvas. |
| `./ui` | The builder screens (`StudioView`, `StudioEditorView`, `template-html`, `template-edit`, canvas Tailwind runtime) behind an injected `StudioClient` + `StudioHost`, which the dashboard implements in `studio-bridge.ts`. |

---

## @mdmx/cli — 44 tests

Tooling. Binary: `mdmx`. Config loading now lives in `@mdmx/project`; the CLI
owns codegen, linting, scaffolding, and watch mode.

Commands: `init <target>` (scaffold — ADR-041), `generate` (registry +
`registry.ts` server map + `components.ts` client map + bound `server.ts` +
`studio.css`, all byte-stable and hash-gated for committing — ADR-040/042),
`check` (content lint + stale-registry detection + a `transpilePackages`
warning), `dev` (watch components, config, and studio definitions).

| File | Responsibility |
| --- | --- |
| `bin.ts` | CLI entry; `generate`, `check`, and `dev` subcommands; exit codes for CI. |
| `config.ts` | Loads `mdmx.config.json`/`.mjs`; defaults. Collection types re-exported from core (one canonical shape, ADR-035). |
| `extract.ts` | Walks a `ts.Program` for `defineMDMX` calls; pulls props from the component type; merges config (per-prop `control`/`default`/`description`/`required`/`placeholder`/`showIf` overrides, validated against the declared props); extracts and validates the insert-time `preview` (registry v3, ADR-057). |
| `infer.ts` | `ts.Type` → `ControlSpec` (string→text, literal union→select, array→list, …); `isFunctionType`. |
| `static-eval.ts` | Statically evaluates the `defineMDMX` config literal to JSON (never executes user code). |
| `generate.ts` | Orchestrates discovery→extraction→dedup→emit `registry.json` + `registry.ts`. |
| `check.ts` | Loads the registry, runs the core validator over content, formats diagnostics. |
| `dev.ts` | Watch mode: derives watch targets from the component glob + config (never the `outDir`), regenerates on change with a debounced, hash-diffed loop. Injectable watcher/scheduler. |

Commands: `mdmx generate` (→ `.mdmx/registry.{json,ts}`), `mdmx check`
(lint, exit 1 on errors), `mdmx dev` (watch components/config, regenerate the
registry on change; reports `unchanged` when the content hash is identical).

---

## @mdmx/editor — 185 tests

Registry→ProseMirror, converters, commands (main entry, React-free), plus the
flat React editor UI behind the `@mdmx/editor/react` subpath.

| File | Responsibility |
| --- | --- |
| `schema.ts` | `buildSchema(registry)` — static markdown core + one node per component; children policies → content expressions; `MARK_PRIORITY`. |
| `from-mdast.ts` | `fromMdast` — mdast → PM doc; mark accumulation; component nodes; `mdmx_raw` fallback. |
| `to-mdast.ts` | `toMdast` + `printPropValue` — PM doc → mdast; priority-ordered mark grouping; canonical prop printing. |
| `commands.ts`, `component-context.ts` | `slashItems`/`slashItemsFor` (context-aware palette), region-local + `allowedParents`-aware `insertComponent`, `canInsertComponent`, `resolveComponentDrop`, `mdmxInputRules`, mark commands, `initialProps` (`preview` over defaults, declaration order) + `previewChildren` seeding the first paragraph (ADR-028, ADR-057); block actions `deleteBlockAt`/`duplicateBlockAt`/`moveBlockAt` + `blockActionKeymap`, and `componentContext` — the selected component, else the deepest around the caret, with its ancestor chain (ADR-058). |
| `react/react-node-view.tsx`, `link-policy.ts` | Thin React-NodeView adapter (one React root per component node; `contentDOM` placement; ADR-023) with `stopEvent` routing by target / `render.interactive` (`routeEvent`, pure), and the canvas-wide link policy (`linkClickAction`, pure): links never navigate, ⌘-click opens a tab (ADR-052). |
| `react/ComponentBlock.tsx` | Generic component renderer: live author component + `RenderBoundary` → placeholder card, retried when the props identity changes (ADR-058); content hole for rich-text/blocks. |
| `react/Editor.tsx` | `MDMXEditor` — the composition root: wires the hooks below to the chrome, owns save state, the media picker, the sidebar resize, and the canvas click-into-padding behavior. Puts the host's content class (`contentClassName`, default `mdmx-page`) on the ProseMirror root (ADR-050). |
| `react/use-editor-view.ts`, `use-viewport.ts`, `use-snippets.ts` | `useEditorView` owns the `EditorView` (history, baseKeymap, input rules, drop/gap cursor, slash plugin, per-component NodeViews, paste-image and drag-from-rail handlers); `useViewport` the preview mode + pane width → zoom; `useSnippets` the save-as-snippet flow. |
| `react/viewport.ts`, `panels.ts`, `sidebar-resize.ts` | Pure, unit-tested state helpers: `fit` + device modes and `canvasZoom` (ADR-036/051), collapsible rail/sidebar persistence, sidebar width clamping/persistence. |
| `react/EditorToolbar.tsx`, `MobileFabs.tsx` | The sticky toolbar (back link, title, viewport switch, panel toggles, insert image, snippet save, save status) and the mobile floating controls. |
| `styles.css` (→ `@mdmx/editor/styles.css`) | The reference chrome stylesheet: tokens at `:where(:root)`, chrome rooted at `.mdmx-editor`, canvas fallbacks + host-independence pins in `@layer base` (ADR-049/050). Imported by the dashboard and the playground. |
| `react/Rail.tsx`, `SlashMenu.tsx`, `PropPanel.tsx`, `BlockActions.tsx`, `SourcePane.tsx`, `EditorSidebar.tsx` | Chrome: component palette, `/`-menu, props editor for the component context (breadcrumb, effective defaults + reset, `showIf`; one tx per edit; ADR-058), the block-actions toolbar anchored to the contextual block, the **two-way source pane** — a CodeMirror 6 editor with parse-gated live apply, lint gutter, active-block marking and canonicalize-on-blur (ADR-059) — and the unified right sidebar that toggles Source ⇄ Properties (ADR-030). |
| `react/Editor.tsx` (`onSave`/`docTitle`/`collection`) | Optional save toolbar (dirty/saving/saved/error); serializes the doc via `serializeDoc` and hands canonical MDMX to the host. Used by the Next mount page. |
| `react/FrontmatterPanel.tsx`, `controls.tsx` | Document-level panel editing a collection's typed frontmatter; writes canonical YAML to the doc attr in one tx. `Control` is the shared value-typed input (`onChange(JsonValue \| undefined)`) covering all 13 control kinds — `list` rows and `object` fields compose it recursively (ADR-058). |
| `react/media.ts`, `MediaLibrary.tsx`, `media-context.ts` | Media library: `MediaSource` adapter (API-agnostic `list`/`upload`), pure upload helpers (`fileToUpload`/`safeFilename`/`bytesToBase64`), `insertImage` command, the modal browser/uploader, and `MediaPickerContext`/`useMediaPicker` (one modal routed to the toolbar + `image` controls). Wired via the editor's `media` prop (ADR-027, ADR-029). |
| `react/slash-plugin.ts`, `source-map.ts`, `source-sync.ts`, `prop-controls.ts` | Slash trigger plugin; doc→canonical serialization + `blockLineMap` (blocks ↔ lines, duplicates resolved sequentially); `applySourceText` (text → one document transaction through the load path, or a positioned parse error) + `lintSource` (validator diagnostics as pane markers) — pure, no CodeMirror; prop value coercion, `effectiveProps`, `emptyValueFor` (pure, unit-tested). |
| `sanitize-html.ts`, `snippets.ts` | Pure best-effort `sanitizeHtml` (for the demo `<Html>` block; build-time safe) + the localStorage snippet store (`save`/`list`/`delete`) backing "save as snippet" (ADR-032). |

`@mdmx/editor` main export stays React-free (Invariant 9); React imports come
from `@mdmx/editor/react`. CodeMirror 6 is the React entry's dependency alone. The interactive design **spec** remains
`examples/editor-prototype.html`; the runnable harness is
`examples/editor-playground`. Nested editing (TwoColumn) and the media library
have landed; remaining polish is nested drop indicators + per-region slash.

---

## @mdmx/next — 90 tests

Next.js integration. The dashboard mount lives in `@mdmx/dashboard`;
`examples/demo-next` is the runnable reference. Saves are validated against
the file's collection schema (MDMX008/009), resolved at request time.

| File | Responsibility |
| --- | --- |
| `local-provider.ts` | `LocalProvider` — dev-mode FS storage; git-style blob shas (mirrors GitHub conflict semantics). |
| `content.ts` | `getEntries`/`getEntryBySlug` — build-time readers; frontmatter, status filter (incl. `private`, ADR-037), optional registry validation; `getStudioComponentDefs` reads stored studio definitions. |
| `guard.ts` | Viewer-side session guard for private pages (ADR-037): `getSession(cookieHeader, {sessionSecret\|localMode})`, `privateHref`. |
| `render.tsx` | `@mdmx/next/render` subpath (react optional peer): `MDMXContent` mdast→React renderer for public pages; `studioComponent(def)`/`studioRenderComponents` render studio template trees without `dangerouslySetInnerHTML`. |
| `session.ts` | AES-256-GCM sealed cookies; `seal`/`unseal`; cookie helpers. |
| `auth.ts` | GitHub OAuth: `authorizeUrl`, `exchangeCode`, `verifyRepoAccess` (push-permission check). |
| `api.ts` | `createMDMXHandlers` — web-standard Request→Response for auth + content/media CRUD. Supports **`localMode`** (no OAuth; synthetic `local` session; ADR-024) for local authoring; a parse failure on save returns 400, not 500. **Collections routes** (ADR-035): `GET/POST /collections`, `PUT /collections/:name` — read/write `mdmx.config.json` through the provider per request (registry fallback + seed-on-first-write; `configPath` option); `GET /entries?dir=` returns listing + parsed frontmatter for entry tables/search; `/me` reports repo/dirs/validation/localMode. **Studio routes** (ADR-038): `GET/PUT/DELETE /studio/components(/:name)` + `POST …/:name/eject`; stored defs merge into save-time validation. |

Security posture (ADR-016/017/018): server-side validation on every save,
origin checks on mutations, prefix-confined paths, 5-min permission
re-verification, conflict 409s, media type/size limits + no-clobber.


---

## @mdmx/dashboard — 49 tests

The app layer (ADR-034): the drop-in CMS mounted with two ~3-line files
(`app/mdmx/[[...slug]]/page.tsx` + `app/api/mdmx/[...route]/route.ts`).
Depends on core + editor + next — the one allowed composition point above the
library siblings. Ships a complete stylesheet (`--mdmx-*` tokens, light+dark,
`data-mdmx-theme` override) that also themes the embedded editor, scoped
under `.mdmx-dash-editor` so standalone editor mounts stay headless. Its
*host independence* section (`@layer base`) pins everything the chrome used
to take from UA defaults, so it renders the same under Tailwind's preflight,
another reset, or no global CSS (ADR-049). The editor's chrome itself is
`@mdmx/editor/styles.css`, imported alongside (ADR-050); only the mount
wrapper (`.mdmx-dash-editor`) remains here.

| File | Responsibility |
| --- | --- |
| `next/index.ts` | `createDashboardPage()` — optional-catch-all page factory; reads `.mdmx/registry.json` per request, hands spec + resolved config (incl. `contentClassName`) + author-component client references to the client app; imports the editor stylesheet and the dashboard stylesheet (zero-config styling via `transpilePackages`). |
| `DashboardApp.tsx`, `context.ts` | Client root: `AuthGate` → `DashboardContext` (api, me, registry, live collections via `GET /collections`, refresh) → shell + view router. Applies the stored theme pin on load. |
| `routes.ts` | Pure `resolveRoute(slug)` URL scheme + `routeHref`/`editorHref` (editor routes carry the full repo-relative path). |
| `api-client.ts` | Typed same-origin client over the content API; `UnauthorizedError` drops the UI to the login screen. |
| `shell/` | `AuthGate` (login / unreachable-API help / localMode badge), `DashboardShell` (navbar with the left-nav toggle, left nav, main, contextual right slot, `search` slot), pure `nav-state.ts` (collapsed-state persistence + the `Mod-\` shortcut rule that yields to text editors, ADR-056), `QuickOpen` + pure `quick-open.ts` ranking (Cmd/Ctrl+K palette), `link.ts` (next/link NodeNext-CJS interop shim). |
| `views/` | `HomeView` (collections overview), `CollectionView` (entry table via `GET /entries`, filter, conflict-safe delete), `EntryNewView` (title→slug scaffold, `expectedSha: null`), `EditorView` (embedded `MDMXEditor` via `next/dynamic` `ssr:false`, sha-refreshing saves, `MediaSource` adapter), `CollectionFormView` + pure `field-draft.ts` (create/edit field schemas; nested controls via an "advanced" escape hatch), `MediaView` (grid/upload/delete; local `media-upload.ts` helpers keep ProseMirror out of the SSR graph), `SettingsView` (session, dirs, validation, registry stats, theme pin). |
| `scaffold.ts`, `theme.ts` | `slugify`/`scaffoldDocument` (canonical starter frontmatter from a collection's fields); theme preference persistence (`data-mdmx-theme` + localStorage). |

---

## @mdmx/provider-github — 12 tests

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
- `editor-playground/` — Vite harness that mounts `@mdmx/editor/react` against
  the demo registry + components and `welcome.mdx`. The primary interactive
  verification surface for the real editor. (Build core + editor and run
  `mdmx generate` in `demo/` first; see its README.)
- `demo-next/` — a complete, runnable **Next.js** app dogfooding the drop-in
  CMS locally via `@mdmx/next` `localMode` (ADR-024): exactly the two-file
  dashboard mount plus author components and content — the reference consumer
  integration. See its README to run.
