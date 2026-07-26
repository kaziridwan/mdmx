import type { TemplateChild, TemplateElement } from "@mdmx/studio";

/**
 * Immutable editing operations for the studio template tree (stage-2 UI:
 * click-to-select + inspector). Elements are addressed by child-index paths
 * from the root ([] = root itself); indexes count all children, but paths
 * only ever point at elements.
 */

export type NodePath = readonly number[];

export function isElement(child: TemplateChild): child is TemplateElement {
  return typeof child === "object" && child !== null && "tag" in child;
}

export function nodeAtPath(root: TemplateElement, path: NodePath): TemplateElement | null {
  let node: TemplateElement = root;
  for (const index of path) {
    const child = node.children?.[index];
    if (child === undefined || !isElement(child)) return null;
    node = child;
  }
  return node;
}

/** Replace the element at `path` with `updater(element)`; returns a new root. */
export function updateAtPath(
  root: TemplateElement,
  path: NodePath,
  updater: (el: TemplateElement) => TemplateElement,
): TemplateElement {
  if (path.length === 0) return updater(root);
  const [index, ...rest] = path;
  const children = [...(root.children ?? [])];
  const child = children[index!];
  if (child === undefined || !isElement(child)) return root;
  children[index!] = updateAtPath(child, rest, updater);
  return { ...root, children };
}

/** Append a child to the element at `path`; returns the new child's path. */
export function appendChild(
  root: TemplateElement,
  path: NodePath,
  child: TemplateChild,
): { root: TemplateElement; childPath: NodePath } {
  const target = nodeAtPath(root, path);
  const childPath = [...path, target?.children?.length ?? 0];
  const next = updateAtPath(root, path, (el) => ({
    ...el,
    children: [...(el.children ?? []), child],
  }));
  return { root: next, childPath };
}

/** Remove the element at `path` (no-op for the root). */
export function removeAtPath(root: TemplateElement, path: NodePath): TemplateElement {
  if (path.length === 0) return root;
  const parent = path.slice(0, -1);
  const index = path[path.length - 1]!;
  return updateAtPath(root, parent, (el) => ({
    ...el,
    children: (el.children ?? []).filter((_, i) => i !== index),
  }));
}

// ---------------------------------------------------------------------------
// Class-group editing (quick controls write classes, never inline styles)
// ---------------------------------------------------------------------------

export interface ClassGroup {
  label: string;
  /** Removes previous members of the group before applying the new one. */
  match: RegExp;
  options: readonly string[];
}

export const CLASS_GROUPS: readonly ClassGroup[] = [
  {
    label: "Padding",
    match: /^p-\d+$/,
    options: ["p-0", "p-2", "p-4", "p-6", "p-8", "p-12"],
  },
  {
    label: "Radius",
    match: /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/,
    options: ["rounded-none", "rounded-lg", "rounded-2xl", "rounded-full"],
  },
  {
    label: "Text size",
    match: /^text-(xs|sm|base|lg|xl|[2-9]xl)$/,
    options: ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-4xl"],
  },
  {
    label: "Weight",
    match: /^font-(thin|light|normal|medium|semibold|bold|black)$/,
    options: ["font-normal", "font-medium", "font-semibold", "font-bold"],
  },
  {
    label: "Text color",
    match: /^text-(inherit|white|black|[a-z]+-\d{2,3})$/,
    options: [
      "text-white",
      "text-slate-900",
      "text-slate-500",
      "text-slate-300",
      "text-indigo-500",
      "text-emerald-500",
      "text-amber-500",
    ],
  },
  {
    label: "Background",
    match: /^bg-(transparent|white|black|[a-z]+-\d{2,3})$/,
    options: [
      "bg-transparent",
      "bg-white",
      "bg-slate-100",
      "bg-slate-900",
      "bg-indigo-500",
      "bg-indigo-50",
      "bg-emerald-500",
    ],
  },
  {
    label: "Display",
    match: /^(block|inline-block|flex|inline-flex|grid)$/,
    options: ["block", "flex", "grid", "inline-block"],
  },
  {
    label: "Direction",
    match: /^flex-(row|col)(-reverse)?$/,
    options: ["flex-row", "flex-col"],
  },
  {
    label: "Gap",
    match: /^gap-\d+$/,
    options: ["gap-1", "gap-2", "gap-3", "gap-4", "gap-6", "gap-8"],
  },
];

/** The group member currently present in a class string, if any. */
export function activeClassIn(classes: string | undefined, group: ClassGroup): string | null {
  for (const cls of (classes ?? "").split(/\s+/)) {
    if (group.match.test(cls)) return cls;
  }
  return null;
}

/** Swap the group's member: previous members removed, `next` appended ("" = just remove). */
export function setClassIn(
  classes: string | undefined,
  group: ClassGroup,
  next: string,
): string {
  const kept = (classes ?? "")
    .split(/\s+/)
    .filter((cls) => cls.length > 0 && !group.match.test(cls));
  if (next) kept.push(next);
  return kept.join(" ");
}

// ---------------------------------------------------------------------------
// Palette snippets
// ---------------------------------------------------------------------------

export const ELEMENT_SNIPPETS: readonly { label: string; make: () => TemplateElement }[] = [
  {
    label: "Section",
    make: () => ({ tag: "section", classes: "p-8 rounded-2xl bg-white flex flex-col gap-3" }),
  },
  {
    label: "Heading",
    make: () => ({
      tag: "h2",
      classes: "text-2xl font-semibold tracking-tight",
      children: [{ text: "Heading" }],
    }),
  },
  {
    label: "Text",
    make: () => ({
      tag: "p",
      classes: "text-slate-500",
      children: [{ text: "Write something…" }],
    }),
  },
  {
    label: "Button",
    make: () => ({
      tag: "a",
      classes: "self-start px-4 py-2 rounded-lg bg-indigo-500 text-white font-medium",
      attrs: { href: "#" },
      children: [{ text: "Click me" }],
    }),
  },
  {
    label: "Image",
    make: () => ({
      tag: "img",
      classes: "rounded-lg",
      attrs: { src: "/media/sample-logo.svg", alt: "" },
    }),
  },
  {
    label: "Row",
    make: () => ({ tag: "div", classes: "flex flex-row gap-4 items-center" }),
  },
];
