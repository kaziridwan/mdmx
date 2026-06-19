# TwoColumn / Nested Editing — implementation plan

The first nested component, and the feature that exercises every layer. This
page is the working plan; update it as steps land.

## What already works (don't rebuild)

The headless layers handle nesting today, and it's tested:

- **Schema** (`editor/schema.ts`): `allowedChildren:["Column"]` →
  content expression `imdx_Column*`; `Column`'s `blocks` policy → `block*`.
  Illegal nesting is rejected by ProseMirror construction. Proven by the
  "schema physics" test in `convert.test.ts` (creating a TwoColumn with a bare
  paragraph throws).
- **Converters** (`from-mdast.ts`/`to-mdast.ts`): recurse through `blocks`
  children, so `<TwoColumn><Column>…</Column></TwoColumn>` round-trips
  canonically.
- **Validator** (`core/validate.ts`): emits IMDX004/IMDX005 for slot
  violations.

So TwoColumn already *parses, validates, and serializes*. The gap is purely
the interactive editing surface.

## Decision (ADR-021)

Build this in the **real `@imdx/editor` with ProseMirror NodeViews**, not in
the flat-list prototype. Adding recursive nesting to the prototype means
reimplementing what ProseMirror already does, then discarding it.

## Steps

1. **Register `Column` and seed the subtree.** Ensure `Column` is in the
   registry (`children:"blocks"`, `allowedParents:["TwoColumn"]`). Inserting a
   TwoColumn must auto-create two Columns — an empty TwoColumn is invalid under
   `imdx_Column+`. Insertion creates a subtree, not a single node. (Extend
   `insertComponent` or add `insertComponentTree`.)

2. **NodeViews with `contentDOM`.** Implement a React NodeView (TipTap's
   `ReactNodeViewRenderer`) for TwoColumn and Column. The crux: the component
   renders `{children}` somewhere, and the NodeView must place ProseMirror's
   editable `contentDOM` exactly there so PM manages nested selection/typing.
   For components where that placement is impossible, fall back to
   `render.mode:"placeholder"`. Wrap live renders in an error boundary that
   degrades to placeholder on throw.

3. **Nested drop targets.** ✅ (S9) Rail drops resolve into the deepest valid
   container via `resolveComponentDrop` (lands inside a Column; rejects a drop
   whose `allowedParents` isn't satisfied, rather than forcing an invalid doc).
   Internal block moves already recurse into Columns via ProseMirror's built-in
   DnD + `dropcursor`. *Remaining:* a visual drop indicator for rail (new
   component) drags — `dropcursor` only renders for PM-managed drags.

4. **Per-region slash menu / palette insert.** ✅ (S9) `insertComponent` is
   region-local — it replaces the empty seeded paragraph in the current Column
   (or inserts at the nearest valid point) instead of lifting to the top level,
   and enforces `allowedParents` (ADR-028). `slashItemsFor` filters the palette
   to components insertable at the selection, so a `Column` is never offered
   outside a `TwoColumn`.

5. **Selection & deletion semantics.** Click selects the innermost block.
   Deleting a Column vs. the whole TwoColumn are distinct. Deleting to zero
   Columns is prevented (schema rejects it anyway; the UI should stop it
   cleanly before the transaction).

## Acceptance criteria

- Insert TwoColumn from the palette → two editable empty Columns appear.
- Type and insert blocks independently in each Column.
- Drag a block from one Column into the other, and from the document body into
  a Column, with correct drop indicators.
- The live source pane shows canonical nested iMDX, and it round-trips
  byte-for-byte (extend `convert.test.ts` fixtures with a populated TwoColumn).
- Attempting an illegal nest (Column into Column) is impossible via DnD and
  flagged by `check` if hand-written.

## Risks / notes

- `contentDOM` placement is the highest-risk piece; ship placeholder mode
  first, make live nested rendering a fast-follow.
- Re-validate the populated round-trip in tests before wiring UI polish.
- Generalize: once TwoColumn works, other `blocks`-policy containers are the
  same machinery.
