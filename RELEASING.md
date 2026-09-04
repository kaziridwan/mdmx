# Releasing mdmx

Packages version in lockstep and publish together from a `release/x.y.z`
branch. The release session prepares everything below the line; the
maintainer runs the publish steps.

## Prepared by the release session (verify before publishing)

- [ ] `pnpm verify` green (typecheck incl. tests, every suite).
- [ ] `examples/demo-next`: `pnpm build` clean (0 warnings), every surface
      driven live, `mdmx check` clean.
- [ ] Versions bumped in lockstep: root `package.json` and all eight
      `packages/*/package.json` carry the release version; internal deps stay
      `workspace:*` (pnpm rewrites them on pack/publish).
- [ ] `LICENSE` at the root and `"license": "MIT"` in every package.
- [ ] `npm pack --dry-run` in each package lists only `dist/` (plus the
      editor's `dist/styles.css`) — no source, tests, or fixtures.
- [ ] Docs wave done: README, guides, SPEC, llms.txt, wiki (Home, Packages,
      Roadmap, Testing, SessionLog), ADRs.
- [ ] Wiki-upkeep checklist in `AGENTS.md` satisfied for the session.

## Publish (maintainer, once)

1. **npm org** — the packages live under the `@mdmx` scope. Create the
   `mdmx` organization at https://www.npmjs.com/org/create (free; public
   packages), then `npm login` on this machine (`npm whoami` to confirm).
2. **Publish all packages** from the release branch, from the repo root:

   ```sh
   pnpm install && pnpm verify
   pnpm -r publish --access public
   ```

   `pnpm -r publish` walks the workspace in dependency order, rewrites
   `workspace:*` to the real versions, and skips the private example
   packages. `--access public` is required once for a new scoped package
   (the scope defaults to restricted). Add `--dry-run` first to see the
   file lists.
3. **Tag and push**:

   ```sh
   git tag v0.7.0 && git push origin release/0.7.0 --tags
   ```

4. **Merge** `release/0.7.0` into `main` (PR, as with 0.5.0).
5. **GitHub Release** for the tag, with the tarballs attached so the
   before-npm workflow (guide 08) has a download that matches the published
   bits:

   ```sh
   pnpm pack:all            # tarballs/*.tgz
   gh release create v0.7.0 tarballs/*.tgz --title "mdmx 0.7.0" --notes-file docs/releases/0.7.0.md
   ```

## After publishing

- `examples/demo-next` keeps `workspace:*` deps — it is the monorepo's own
  consumer, not a published-package test. For a from-npm check, run `mdmx
  init nextjs` in a fresh `create-next-app` and follow guide 1.
- Next release: branch `release/x.y.z` from `main`, bump versions in
  lockstep, repeat.
