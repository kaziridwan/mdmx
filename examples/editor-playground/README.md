# editor-playground

Standalone Vite harness for developing the `@mdmx/editor` React UI in isolation
(no auth, no providers, no Next.js). It loads the **demo** project's generated
registry and renders `content/posts/welcome.mdx` in the editor.

## Run

```sh
# 1. Build the workspace packages the editor depends on
pnpm --filter @mdmx/core build
pnpm --filter @mdmx/editor build

# 2. Generate the demo registry (the playground imports it)
cd examples/demo
node ../../packages/cli/dist/bin.js generate
cd ../..

# 3. Start the playground
pnpm --filter editor-playground dev
```

Then open the printed URL. You should see:

- the **rail** (component palette) on the left — click or drag `Callout` / `Stat`
  to insert;
- the **canvas** in the middle — type, use `/` for the slash menu (core blocks +
  components), edit a `Callout`'s rich-text children inline;
- the **prop panel** — select a component to edit its props (each edit is one
  transaction; the render and source update live);
- the **source pane** on the right — live canonical MDMX, the active block's
  lines marked amber. On load it matches `welcome.mdx` byte-for-byte.

The editor is imported from `@mdmx/editor/react` (built `dist`), so rebuild
`@mdmx/editor` after changing it.
