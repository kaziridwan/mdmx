import { existsSync, watch } from "node:fs";
import { join, relative } from "node:path";
import { generate, type GenerateResult } from "./generate.js";
import type { MDMXConfig } from "./config.js";

export interface DevSummary {
  result: GenerateResult;
  /** One-line human status, e.g. "mdmx: 4 component(s), no issues [a1b2c3d4e5f6a7b8]". */
  line: string;
}

/**
 * Run one `generate` pass and format a status line. The only side effect is
 * writing the registry artifacts (same as `generate`); everything else is pure,
 * which is what makes the watch loop testable.
 */
export async function runGenerate(cwd: string, config: MDMXConfig): Promise<DevSummary> {
  const result = await generate(cwd, config);
  const n = result.spec.components.length;
  const errors = result.issues.filter((i) => i.severity === "error").length;
  const warnings = result.issues.filter((i) => i.severity === "warning").length;
  const issues =
    errors || warnings ? `${errors} error(s), ${warnings} warning(s)` : "no issues";
  const line = `mdmx: ${n} component(s), ${issues} [${result.spec.hash}]`;
  return { result, line };
}

/** The non-glob prefix of a glob pattern (`components/mdmx/**` → `components/mdmx`). */
export function staticBase(pattern: string): string {
  const out: string[] = [];
  for (const part of pattern.split("/")) {
    if (/[*?{}[\]!()]/.test(part)) break;
    out.push(part);
  }
  return out.join("/") || ".";
}

/**
 * Filesystem locations to watch: the static base directory of each component
 * glob, plus the config file itself. The `outDir` is deliberately never
 * watched — `generate` writes the registry there, so watching it would loop.
 */
export function watchTargets(cwd: string, config: MDMXConfig): string[] {
  const patterns = Array.isArray(config.components)
    ? config.components
    : [config.components];
  const targets = new Set<string>();
  for (const p of patterns) targets.add(join(cwd, staticBase(p)));
  for (const name of ["mdmx.config.json", "mdmx.config.mjs"]) {
    const file = join(cwd, name);
    if (existsSync(file)) targets.add(file);
  }
  return [...targets].filter((t) => existsSync(t));
}

/** Watch a set of paths, invoking `onEvent` on any change. Returns a disposer. */
export type Watcher = (paths: string[], onEvent: () => void) => () => void;

/** Default watcher over `node:fs.watch` (recursive; harmless on plain files). */
export const fsWatcher: Watcher = (paths, onEvent) => {
  const handles = paths.map((p) => watch(p, { recursive: true }, () => onEvent()));
  return () => {
    for (const h of handles) h.close();
  };
};

export interface DevOptions {
  /** Override the watcher (tests inject a fake). */
  watcher?: Watcher;
  /** Status sink (default: console.log). */
  log?: (msg: string) => void;
  /** Diagnostics sink (default: console.error). */
  error?: (msg: string) => void;
  /** Debounce scheduler; returns a cancel fn (default: setTimeout). */
  schedule?: (fn: () => void, ms: number) => () => void;
  /** Coalescing window for rapid file events (default: 150ms). */
  debounceMs?: number;
}

export interface DevHandle {
  /** Force a regenerate immediately (also called internally after debounce). */
  regenerate(): Promise<void>;
  /** Stop watching and cancel any pending regenerate. */
  close(): void;
  /** Hash of the last generated registry, or null before the first run. */
  readonly lastHash: string | null;
}

/**
 * Start watch mode: regenerate the registry whenever a component file or the
 * config changes. Rapid events are debounced; an unchanged registry (same
 * content hash) is reported as `unchanged` rather than re-announced.
 */
export async function dev(
  cwd: string,
  config: MDMXConfig,
  options: DevOptions = {},
): Promise<DevHandle> {
  const log = options.log ?? ((m) => console.log(m));
  const error = options.error ?? ((m) => console.error(m));
  const watcher = options.watcher ?? fsWatcher;
  const schedule =
    options.schedule ??
    ((fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    });
  const debounceMs = options.debounceMs ?? 150;

  let lastHash: string | null = null;
  let running = false;
  let rerun = false;

  async function regenerate(): Promise<void> {
    // Coalesce a regenerate requested while one is already in flight.
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      const { result, line } = await runGenerate(cwd, config);
      const hash = result.spec.hash ?? "";
      if (hash === lastHash) {
        log(`mdmx: unchanged [${hash}]`);
      } else {
        lastHash = hash;
        log(line);
      }
      for (const issue of result.issues) {
        const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
        error(`  ${issue.severity} ${loc} ${issue.message}`);
      }
    } catch (err) {
      error(`mdmx: generate failed — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = false;
      if (rerun) {
        rerun = false;
        void regenerate();
      }
    }
  }

  const targets = watchTargets(cwd, config);
  const shown = targets.map((t) => relative(cwd, t) || ".").join(", ");
  log(`mdmx dev: watching ${shown || "(nothing)"}`);
  await regenerate();

  let cancelDebounce: (() => void) | null = null;
  const dispose = watcher(targets, () => {
    if (cancelDebounce) cancelDebounce();
    cancelDebounce = schedule(() => {
      cancelDebounce = null;
      void regenerate();
    }, debounceMs);
  });

  return {
    regenerate,
    close() {
      if (cancelDebounce) cancelDebounce();
      dispose();
    },
    get lastHash() {
      return lastHash;
    },
  };
}
