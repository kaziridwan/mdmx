import type { StudioComponentDef } from "../model.js";

/**
 * What the studio UI needs from its host (ADR-045).
 *
 * The builder screens moved out of `@mdmx/dashboard` into this package, which
 * means they can no longer reach into the dashboard's context and typed API
 * client. That's the point: the dependency becomes an interface the host
 * implements, so the screens can be driven by a fake in tests — the studio UI
 * previously had no tests at all, and this is why.
 */
export interface StudioEntry {
  path: string;
  sha: string;
  def: StudioComponentDef;
}

export interface StudioClient {
  /** Definitions currently stored in the content repo. */
  readonly entries: readonly StudioEntry[];
  /** Re-read them after a mutation. */
  refresh(): Promise<void>;
  save(args: { def: StudioComponentDef; expectedSha?: string | null }): Promise<void>;
  remove(name: string): Promise<void>;
  eject(name: string): Promise<{ path: string; note: string }>;
}

/** Host-provided navigation and chrome, so the screens stay router-agnostic. */
export interface StudioHost {
  /** Where studio definitions live, for the empty-state hint. */
  contentDir: string;
  /** Build an href within the host's mount, e.g. hrefFor("studio", name). */
  hrefFor(...segments: string[]): string;
  /** Programmatic navigation after a save or delete. */
  navigate(href: string): void;
  /** The host's link component (Next's `Link`, an `<a>`, …). */
  Link: (props: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) => React.ReactNode;
  /**
   * Tailwind browser runtime for the *canvas only* — live authoring needs
   * on-the-fly utilities. Public pages get build-time CSS instead (ADR-042).
   */
  tailwindSrc?: string;
}
