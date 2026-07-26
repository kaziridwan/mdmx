// Config loading lives in @mdmx/project (ADR-043) — import it from there.
export { generate } from "./generate.js";
export type { GenerateResult } from "./generate.js";
export { check, formatDiagnostics } from "./check.js";
export type { CheckResult, FileDiagnostics } from "./check.js";
export { dev, runGenerate, watchTargets, staticBase, fsWatcher } from "./dev.js";
export type { DevHandle, DevOptions, DevSummary, Watcher } from "./dev.js";
export { extractComponents } from "./extract.js";
export type { ExtractionIssue, ExtractionResult } from "./extract.js";
