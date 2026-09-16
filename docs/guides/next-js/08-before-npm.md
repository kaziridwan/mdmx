# 8 · Using mdmx before (or between) npm releases

The packages publish to npm as `@mdmx/*`. Between releases — or when you're
working from a checkout — your own apps can consume the packages as
**tarballs**, exactly as npm would deliver them, without linking source
directories into the app.

## Why tarballs, not `pnpm link`

`pnpm pack` produces the same artifact `pnpm publish` uploads: only `dist/`,
with every `workspace:*` dependency rewritten to the real version. An app
that installs those tarballs exercises the published surface — the `exports`
maps, the shipped stylesheet, the CLI bin — so what works in your app works
from npm. Linking source directories skips all of that and drags the
monorepo's `node_modules` into the app's module graph.

## 1. Pack

From the mdmx checkout:

```sh
pnpm pack:all
```

This builds everything and packs the eight packages into `tarballs/`
(`--out DIR` to put them elsewhere), then prints the snippet for step 2 with
absolute paths.

## 2. Point your app at them

Keep the normal dependencies in the consuming app's `package.json`:

```jsonc
{
  "dependencies": {
    "@mdmx/core": "^0.7.0",
    "@mdmx/project": "^0.7.0",
    "@mdmx/studio": "^0.7.0",
    "@mdmx/next": "^0.7.0",
    "@mdmx/editor": "^0.7.0",
    "@mdmx/dashboard": "^0.7.0"
  },
  "devDependencies": {
    "@mdmx/cli": "^0.7.0"
  }
}
```

and add the overrides the script printed to the app's `pnpm-workspace.yaml`
(create the file if the app has none — a single-package app is a workspace
of one):

```yaml
overrides:
  "@mdmx/core": "file:/path/to/mdmx/tarballs/mdmx-core-0.7.0.tgz"
  "@mdmx/project": "file:/path/to/mdmx/tarballs/mdmx-project-0.7.0.tgz"
  "@mdmx/studio": "file:/path/to/mdmx/tarballs/mdmx-studio-0.7.0.tgz"
  "@mdmx/next": "file:/path/to/mdmx/tarballs/mdmx-next-0.7.0.tgz"
  "@mdmx/editor": "file:/path/to/mdmx/tarballs/mdmx-editor-0.7.0.tgz"
  "@mdmx/dashboard": "file:/path/to/mdmx/tarballs/mdmx-dashboard-0.7.0.tgz"
  "@mdmx/cli": "file:/path/to/mdmx/tarballs/mdmx-cli-0.7.0.tgz"
  "@mdmx/provider-github": "file:/path/to/mdmx/tarballs/mdmx-provider-github-0.7.0.tgz"
```

pnpm 11 no longer reads the `pnpm` field in `package.json` — settings live
in `pnpm-workspace.yaml`. (pnpm ≤ 10 also accepts the same block as
`"pnpm": { "overrides": { … } }` in `package.json`.)

Overrides apply to the whole graph, which is the point: `@mdmx/dashboard`'s
own `@mdmx/editor` dependency resolves to your tarball too, so there is one
copy of each package. Then:

```sh
pnpm install
```

Everything from [guide 1](01-installation.md) onward works unchanged
(`mdmx init nextjs`, `transpilePackages`, `mdmx generate`).

## 3. Iterate

After changing mdmx: `pnpm pack:all` again, then `pnpm install` in the app.
pnpm keys `file:` tarballs by path, so re-packing to the same filename is
enough — no version bump needed while you iterate.

## When the packages are on npm

Delete the `overrides` block from `pnpm-workspace.yaml` and `pnpm install`;
the version ranges in `dependencies` take over. Nothing else changes.

## Notes

- Commit neither the `tarballs/` directory (it's gitignored here) nor the
  overrides — they're a local workstation arrangement.
- `npm`/`yarn` users: the same tarballs work with `"@mdmx/core":
  "file:../mdmx/tarballs/mdmx-core-0.7.0.tgz"` directly in `dependencies`
  (there is no overrides mechanism to apply them transitively, so list all
  eight).
