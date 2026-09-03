# 7 · Troubleshooting

## Build & startup

**`ENOENT: .mdmx/registry.json` (or the palette is empty)**
The registry hasn't been generated. Run `mdmx generate`, and make sure
`predev`/`prebuild` scripts exist ([guide 1](01-installation.md)) so it can't
be skipped. If a component is missing from the palette, check it matches the
`components` glob in `mdmx.config.json` and that its `defineMDMX` call
compiled without extraction errors (`mdmx generate` prints them).

**`document is not defined` / `window is not defined` when opening the editor**
`MDMXEditor` was imported at module top level in a server-rendered file.
ProseMirror touches browser globals at import time — always load it via
`next/dynamic` with `ssr: false` ([guide 4](04-editor.md)).

**Bundler errors resolving `@mdmx/*` imports**
Add `"@mdmx/core", "@mdmx/editor", "@mdmx/next", "@mdmx/dashboard"` to
`transpilePackages` in `next.config.mjs`. In the monorepo, also make sure the
packages are built (`pnpm build`) — the apps consume `dist/`.

**The dashboard renders unstyled**
Two stylesheets flow through `transpilePackages`: the dashboard's own
(inside `@mdmx/dashboard`) and the editor chrome (`@mdmx/editor/styles.css`,
imported by the dashboard). If either package is missing from that list, its
CSS import is not processed — an unstyled editor with a styled dashboard
means `@mdmx/editor` is the one missing.

**"Could not reach the MDMX API" on the dashboard gate**
The dashboard's `basePath` (default `/api/mdmx`) doesn't line up with where
the handlers are mounted, or the API route file is missing. The two mount
files must agree on `basePath`.

**Stale content or stale registry on CMS pages**
CMS pages (list, edit) must opt out of static optimization:
`export const dynamic = "force-dynamic"` — the filesystem changes between
requests. The same export is required on the API route.

## API responses

| Status | Likely cause | Fix |
| --- | --- | --- |
| 400 | Path outside `contentDir`/`mediaDir`, traversal, unparseable MDX, unsupported media extension | Check the `path` you send is repo-relative and confined; look at `error` in the body |
| 401 | No session / expired session / access revoked at the 5-min re-verify | Redirect the user to `<basePath>/auth/login` |
| 403 | Cross-origin mutation (CSRF check), or the GitHub user lacks push permission | Call the API same-origin; grant the collaborator `write` or above |
| 404 | File doesn't exist, or the route path doesn't match `basePath` | Verify the catch-all segment matches the `basePath` option |
| 409 | Write conflict — `expectedSha` stale | Refetch `GET /file`, take the new `sha`, merge/retry. The sha-refresh loop in [guide 4](04-editor.md) prevents self-conflicts |
| 413 | Media above `maxMediaBytes` (default 10 MiB) | Resize the asset or raise the option |
| 422 | `validation: "strict"` rejected the save | Read `diagnostics` in the body; codes below |

**OAuth callback returns `invalid OAuth state`**
The `state` cookie was missing or mismatched. Usual causes: the callback URL
registered on the OAuth app doesn't exactly match
`<origin><basePath>/auth/callback`, cookies blocked, or the login flow was
started on a different origin (http vs https, `www.` vs bare). In local HTTP
development you need `insecureCookies: true`.

**Session drops after exactly ~8 hours / logins invalidated all at once**
Sessions have an 8-hour TTL, and rotating `sessionSecret` (or it differing
across serverless instances) invalidates every cookie. Pin the secret in your
environment — never generate it at boot.

## Validation diagnostics

Returned by saves (`PUT /file`), attached by `getEntries(..., { registry })`,
and printed by `mdmx check`:

| Code | Severity | Meaning |
| --- | --- | --- |
| MDMX001 | error | JSX element not in the registry |
| MDMX002 | error | Prop value not statically serializable (props must be JSON) / spread attribute |
| MDMX003 | error | Node type outside the MDMX subset (raw HTML, ESM, expressions, …) |
| MDMX004 | error | Child violates the children policy or `allowedChildren` |
| MDMX005 | error | Component used outside its `allowedParents` |
| MDMX006 | error | Required prop missing (and no registry default) |
| MDMX007 | warning | Prop not declared by the component spec |
| MDMX008 | error | Required frontmatter field missing (collection schema) |
| MDMX009 | error | Frontmatter field value doesn't match its declared control/type |
| MDMX010 | error | Frontmatter isn't valid YAML, or isn't a mapping |

Common sources: hand-edited `.mdx` files (run `mdmx check` in CI to catch
them), components renamed without regenerating the registry, and content
created before a component grew a new required prop (give it a `default` in
`defineMDMX` to stay backward-compatible).

## Editor behavior

**A block renders as a gray placeholder instead of the real component**
The registry knows the component but the `components` map passed to
`MDMXEditor` doesn't include it (or the key doesn't match the registry
`name`). Re-run `mdmx generate` so the generated maps pick it up.

**"could not parse MDMX" on save, or a component won't accept a child**
The document violates the grammar — remember MDMX is a whitelist: no raw
HTML, no `{expressions}`, no inline JSX, JSON-only props, and `rich-text`
children can't contain headings/lists/components. `constraints` on the
container decide what nests where.

**Saves succeed but git shows a huge diff**
It shouldn't — the serializer emits one canonical form, and editing one prop
changes exactly one line. A large first-save diff usually means the file
wasn't in canonical form yet (hand-written content): the initial save
canonicalizes it once, and diffs are minimal from then on.

**Media upload fails with `media must live under public/media/`**
The upload `path` must sit under the handler's `mediaDir`. Keep the editor's
`mediaDir` prop and the handler option in sync (share the constant, as in
[guide 1](01-installation.md)).

## Still stuck?

- [`examples/demo-next`](../../../examples/demo-next/) is the runnable
  reference for every guide in this series — diff your integration against it.
- [`SPEC.md`](../../../SPEC.md) is normative for the grammar, canonical form,
  registry schema, and provider contract.
- [`docs/wiki/Architecture.md`](../../wiki/Architecture.md) explains the
  request lifecycle end to end.

## The source pane says "Syntax error, line N"

The text in the pane does not parse as MDX (an unclosed tag, a stray `<`),
so nothing was applied: the canvas shows the last version that did parse,
and the line number points at the problem. Fix the text and the canvas
follows; ⌘/Ctrl-⏎ applies right away. A parse error is different from a
validation marker (MDMX001–010, shown in the gutter) — those describe a
document that parses and applies but would fail `mdmx check`.
