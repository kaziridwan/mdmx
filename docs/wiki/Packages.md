# Packages

Per-package reference. Test counts are current as of the last session (see
[Session Log](SessionLog.md)); update them when they change.

---

## @mdmx/core — 54 tests

The format. Zero React/Next dependencies (Invariant #9).

| File | Responsibility |
| --- | --- |
| `types.ts` | All shared types: `JsonValue`, diagnostics + codes, `ControlSpec` taxonomy, `ComponentSpec`/`RegistrySpec`, `Registry` class, `defineMDMX`. |
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

## @mdmx/project — 13 tests

What a project on disk looks like: the layer between the spec and the runtimes
(ADR-043). Node-only, framework-free.

| File | Responsibility |
| --- | --- |
| `config.ts` | `MDMXConfig` schema + `DEFAULT_CONFIG`; `loadConfig` reads `mdmx.config.json` **or** `.mjs` (the CLI and the runtime used to disagree about this); `mergeConfig`, `validateConfig`, and `parseProjectConfig`/`ProjectConfigFile` for the provider-read path (ADR-035). |
| `env.ts` | `resolveMode` — GitHub when the OAuth vars are set, local when they aren't, and a `ModeResolutionError` naming the missing variables in production (ADR-039). `insecureCookiesDefault`. |
| `registry.ts` | `loadRegistrySpec`/`loadRegistry`/`tryLoadRegistrySpec` + `MissingRegistryError` that points at `mdmx generate`. |

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

## @mdmx/cli — 34 tests

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
| `extract.ts` | Walks a `ts.Program` for `defineMDMX` calls; pulls props from the component type; merges config. |
| `infer.ts` | `ts.Type` → `ControlSpec` (string→text, literal union→select, array→list, …); `isFunctionType`. |
| `static-eval.ts` | Statically evaluates the `defineMDMX` config literal to JSON (never executes user code). |
| `generate.ts` | Orchestrates discovery→extraction→dedup→emit `registry.json` + `registry.ts`. |
| `check.ts` | Loads the registry, runs the core validator over content, formats diagnostics. |
| `dev.ts` | Watch mode: derives watch targets from the component glob + config (never the `outDir`), regenerates on change with a debounced, hash-diffed loop. Injectable watcher/scheduler. |

Commands: `mdmx generate` (→ `.mdmx/registry.{json,ts}`), `mdmx check`
(lint, exit 1 on errors), `mdmx dev` (watch components/config, regenerate the
registry on change; reports `unchanged` when the content hash is identical).

---

## @mdmx/editor — 113 tests

Registry→ProseMirror, converters, commands (main entry, React-free), plus the
flat React editor UI behind the `@mdmx/editor/react` subpath.

| File | Responsibility |
| --- | --- |
| `schema.ts` | `buildSchema(registry)` — static markdown core + one node per component; children policies → content expressions; `MARK_PRIORITY`. |
| `from-mdast.ts` | `fromMdast` — mdast → PM doc; mark accumulation; component nodes; `mdmx_raw` fallback. |
| `to-mdast.ts` | `toMdast` + `printPropValue` — PM doc → mdast; priority-ordered mark grouping; canonical prop printing. |
| `commands.ts` | `slashItems`/`slashItemsFor` (context-aware palette), region-local + `allowedParents`-aware `insertComponent`, `canInsertComponent`, `resolveComponentDrop`, `mdmxInputRules`, mark commands, `initialProps` (ADR-028). |
| `react/react-node-view.tsx` | Thin React-NodeView adapter (one React root per component node; `contentDOM` placement). Replaces TipTap (ADR-023). |
| `react/ComponentBlock.tsx` | Generic component renderer: live author component + error boundary → placeholder card; content hole for rich-text/blocks. |
| `react/Editor.tsx` | `MDMXEditor` — owns the `EditorView` (history, baseKeymap, input rules, drop/gap cursor, slash plugin), builds per-component NodeViews, drag-from-rail drop; composes the chrome. |
| `react/Rail.tsx`, `SlashMenu.tsx`, `PropPanel.tsx`, `SourcePane.tsx`, `EditorSidebar.tsx` | Chrome: component palette, `/`-menu, props editor (one tx per edit), live canonical source with active-block marking, and the unified right sidebar that toggles Source ⇄ Properties (ADR-030). |
| `react/Editor.tsx` (`onSave`/`docTitle`/`collection`) | Optional save toolbar (dirty/saving/saved/error); serializes the doc via `serializeDoc` and hands canonical MDMX to the host. Used by the Next mount page. |
| `react/FrontmatterPanel.tsx`, `controls.tsx` | Document-level panel editing a collection's typed frontmatter; writes canonical YAML to the doc attr in one tx. `Control` is the shared typed input (also used by `PropPanel`). |
| `react/media.ts`, `MediaLibrary.tsx`, `media-context.ts` | Media library: `MediaSource` adapter (API-agnostic `list`/`upload`), pure upload helpers (`fileToUpload`/`safeFilename`/`bytesToBase64`), `insertImage` command, the modal browser/uploader, and `MediaPickerContext`/`useMediaPicker` (one modal routed to the toolbar + `image` controls). Wired via the editor's `media` prop (ADR-027, ADR-029). |
| `react/slash-plugin.ts`, `source-map.ts`, `prop-controls.ts` | Slash trigger plugin; doc→canonical serialization + active-block line mapping; prop value coercion (pure, unit-tested). |
| `sanitize-html.ts`, `snippets.ts` | Pure best-effort `sanitizeHtml` (for the demo `<Html>` block; build-time safe) + the localStorage snippet store (`save`/`list`/`delete`) backing "save as snippet" (ADR-032). |

`@mdmx/editor` main export stays React-free (Invariant 9); React imports come
from `@mdmx/editor/react`. The interactive design **spec** remains
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

## @mdmx/dashboard — 41 tests

The app layer (ADR-034): the drop-in CMS mounted with two ~3-line files
(`app/mdmx/[[...slug]]/page.tsx` + `app/api/mdmx/[...route]/route.ts`).
Depends on core + editor + next — the one allowed composition point above the
library siblings. Ships a complete stylesheet (`--mdmx-*` tokens, light+dark,
`data-mdmx-theme` override) that also themes the embedded editor, scoped
under `.mdmx-dash-editor` so standalone editor mounts stay headless.

| File | Responsibility |
| --- | --- |
| `next/index.ts` | `createDashboardPage()` — optional-catch-all page factory; reads `.mdmx/registry.json` per request, hands spec + resolved config + author-component client references to the client app; re-exports the `@mdmx/next` surface; imports the stylesheet (zero-config styling via `transpilePackages`). |
| `DashboardApp.tsx`, `context.ts` | Client root: `AuthGate` → `DashboardContext` (api, me, registry, live collections via `GET /collections`, refresh) → shell + view router. Applies the stored theme pin on load. |
| `routes.ts` | Pure `resolveRoute(slug)` URL scheme + `routeHref`/`editorHref` (editor routes carry the full repo-relative path). |
| `api-client.ts` | Typed same-origin client over the content API; `UnauthorizedError` drops the UI to the login screen. |
| `shell/` | `AuthGate` (login / unreachable-API help / localMode badge), `DashboardShell` (navbar, left nav, main, contextual right slot, `search` slot), `QuickOpen` + pure `quick-open.ts` ranking (Cmd/Ctrl+K palette), `link.ts` (next/link NodeNext-CJS interop shim). |
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
