/**
 * @imdx/core — shared types for the iMDX spec, diagnostics, and registry.
 *
 * This module is intentionally free of React and Node dependencies so it can
 * be consumed by the CLI, the editor, the Next.js renderer, and CI alike.
 */

/** Version of the iMDX grammar implemented by this package. */
export const IMDX_SPEC_VERSION = 1;

// ---------------------------------------------------------------------------
// JSON values (the "props are JSON" rule)
// ---------------------------------------------------------------------------

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type PropsObject = Record<string, JsonValue>;

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type DiagnosticCode =
  /** JSX element whose name is not in the registry. */
  | "IMDX001"
  /** Prop value is not statically serializable (not a JSON literal). */
  | "IMDX002"
  /** Node type outside the iMDX subset (raw HTML, expressions, ESM, …). */
  | "IMDX003"
  /** Child not allowed by the component's children policy / constraints. */
  | "IMDX004"
  /** Component placed under a parent that its spec does not allow. */
  | "IMDX005"
  /** Required prop missing. */
  | "IMDX006"
  /** Prop provided that the component spec does not declare. */
  | "IMDX007"
  /** Required frontmatter field (per the collection schema) is missing. */
  | "IMDX008"
  /** Frontmatter field value does not match its declared control/type. */
  | "IMDX009";

export interface SourcePosition {
  line: number; // 1-indexed
  column: number; // 1-indexed
}

export interface SourceSpan {
  start: SourcePosition;
  end: SourcePosition;
}

export interface Diagnostic {
  code: DiagnosticCode;
  severity: "error" | "warning";
  message: string;
  /** Best-effort source span; absent for synthesized nodes. */
  span?: SourceSpan;
}

// ---------------------------------------------------------------------------
// Controls (shared by component props and collection frontmatter fields)
// ---------------------------------------------------------------------------

export type ControlSpec =
  | { type: "text"; placeholder?: string }
  | { type: "textarea"; placeholder?: string }
  | { type: "number"; min?: number; max?: number; step?: number }
  | { type: "boolean" }
  | { type: "select"; options: readonly string[] }
  | { type: "multiselect"; options: readonly string[] }
  | { type: "color" }
  | { type: "date" }
  | { type: "image" }
  | { type: "link" }
  | { type: "json" }
  | { type: "list"; item: ControlSpec }
  | { type: "object"; fields: Record<string, ControlSpec> };

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type ChildrenPolicy = "none" | "rich-text" | "blocks";

export interface PropSpec {
  name: string;
  required: boolean;
  control: ControlSpec;
  default?: JsonValue;
  description?: string;
}

export interface ComponentConstraints {
  /** Component names this may appear under; null = anywhere. */
  allowedParents: readonly string[] | null;
  /** Component names allowed as direct children; null = any valid iMDX. */
  allowedChildren: readonly string[] | null;
}

export type RenderMode = "live" | "placeholder" | "static";

export interface ComponentSpec {
  name: string;
  category?: string;
  icon?: string;
  description?: string;
  /** Source file, relative to the project root (filled in by codegen). */
  source?: string;
  version?: number;
  children: { policy: ChildrenPolicy };
  props: PropSpec[];
  constraints?: ComponentConstraints;
  render?: { mode: RenderMode };
}

// ---------------------------------------------------------------------------
// Collections (typed frontmatter for content groupings)
// ---------------------------------------------------------------------------

/** A frontmatter field of a collection. Reuses the shared `ControlSpec`. */
export interface FrontmatterField {
  name: string;
  required: boolean;
  control: ControlSpec;
  default?: JsonValue;
  description?: string;
}

/** A content grouping (e.g. `posts`) with a typed frontmatter schema. */
export interface CollectionSpec {
  name: string;
  /** Content directory for this collection, relative to the project root. */
  dir: string;
  fields: FrontmatterField[];
}

export interface RegistrySpec {
  imdxRegistryVersion: number;
  generatedAt?: string;
  hash?: string;
  components: ComponentSpec[];
  collections?: CollectionSpec[];
}

/** Runtime registry helper with O(1) lookup. */
export class Registry {
  readonly spec: RegistrySpec;
  private readonly byName: Map<string, ComponentSpec>;
  private readonly collectionsByName: Map<string, CollectionSpec>;

  constructor(spec: RegistrySpec) {
    this.spec = spec;
    this.byName = new Map(spec.components.map((c) => [c.name, c]));
    this.collectionsByName = new Map((spec.collections ?? []).map((c) => [c.name, c]));
  }

  get(name: string): ComponentSpec | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  get components(): readonly ComponentSpec[] {
    return this.spec.components;
  }

  get collections(): readonly CollectionSpec[] {
    return this.spec.collections ?? [];
  }

  getCollection(name: string): CollectionSpec | undefined {
    return this.collectionsByName.get(name);
  }

  /**
   * The collection a content path belongs to, matched by the longest `dir`
   * prefix. Paths are normalized so `content/posts/x.mdx` matches dir
   * `content/posts`.
   */
  collectionForPath(path: string): CollectionSpec | undefined {
    const norm = path.replace(/^\.?\//, "");
    let best: CollectionSpec | undefined;
    for (const c of this.collections) {
      const dir = c.dir.replace(/^\.?\//, "").replace(/\/$/, "");
      if (norm === dir || norm.startsWith(dir + "/")) {
        if (!best || dir.length > best.dir.length) best = c;
      }
    }
    return best;
  }
}

// ---------------------------------------------------------------------------
// defineIMDX (runtime side; codegen reads the same call statically)
// ---------------------------------------------------------------------------

export const IMDX_META: unique symbol = Symbol.for("imdx.meta");

export interface DefineIMDXConfig {
  name: string;
  category?: string;
  icon?: string;
  description?: string;
  version?: number;
  children?: ChildrenPolicy;
  /** Per-prop overrides merged over type inference by the codegen. */
  props?: Record<
    string,
    Partial<Omit<PropSpec, "name">> & { placeholder?: string }
  >;
  /** Props used to render the component when inserted from the palette. */
  preview?: PropsObject & { children?: string };
  constraints?: Partial<ComponentConstraints>;
  render?: { mode: RenderMode };
}

export interface IMDXTagged {
  [IMDX_META]: DefineIMDXConfig;
}

/**
 * Tag a component with iMDX metadata. Framework-agnostic: `component` is
 * opaque to core. The CLI extracts this config statically; the editor reads
 * it at runtime via the IMDX_META symbol.
 */
export function defineIMDX<C>(component: C, config: DefineIMDXConfig): C & IMDXTagged {
  const tagged = component as C & IMDXTagged;
  tagged[IMDX_META] = config;
  return tagged;
}
