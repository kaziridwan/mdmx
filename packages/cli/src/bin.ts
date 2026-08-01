#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig } from "@mdmx/project";
import { generate } from "./generate.js";
import { check, formatDiagnostics } from "./check.js";
import { dev } from "./dev.js";
import { formatInitResult, INIT_TARGETS, initNext, isNextApp } from "./init.js";

const USAGE = `mdmx <command>

Commands:
  init <target>  Scaffold MDMX into an existing app (targets: ${INIT_TARGETS.join(", ")})
  generate       Scan components, emit the .mdmx/ artifacts (commit them)
  check          Validate content against the registry; flags a stale registry
  dev            Watch components/config and regenerate on change

Options:
  --cwd <dir>   Project root (default: process.cwd())
`;

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { cwd: { type: "string" } },
  });
  const cwd = values.cwd ?? process.cwd();
  const command = positionals[0];
  const { config } = await loadConfig(cwd);

  if (command === "init") {
    const target = positionals[1];
    if (!target) {
      console.error(`mdmx init <target>\n\nTargets:\n  ${INIT_TARGETS.join("\n  ")}`);
      return 1;
    }
    if (!(INIT_TARGETS as readonly string[]).includes(target)) {
      console.error(`mdmx: unknown target "${target}". Targets: ${INIT_TARGETS.join(", ")}`);
      return 1;
    }
    if (!isNextApp(cwd)) {
      console.error(
        "mdmx: no app/ directory here — run this inside a Next.js App Router project.",
      );
      return 1;
    }
    const result = initNext(cwd);
    console.log(formatInitResult(result));
    // Generate immediately so `next dev` works without a second step.
    const { config: fresh } = await loadConfig(cwd);
    await generate(cwd, fresh);
    return 0;
  }

  if (command === "generate") {
    const result = await generate(cwd, config);
    for (const issue of result.issues) {
      const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.error(`${loc} ${issue.severity} ${issue.message}`);
    }
    console.log(
      `mdmx: registered ${result.spec.components.length} component(s) → ${result.written.json}`,
    );
    return result.hasErrors ? 1 : 0;
  }

  if (command === "check") {
    const result = await check(cwd, config);
    const output = formatDiagnostics(result);
    if (output) console.log(output);
    if (result.staleRegistry) console.error(`mdmx: ${result.staleRegistry}`);
    if (result.setupWarning) console.error(`mdmx: warning — ${result.setupWarning}`);
    console.log(
      `mdmx: ${result.errorCount} error(s), ${result.warningCount} warning(s)`,
    );
    // A stale committed registry fails CI: the palette and the validation
    // rules would otherwise disagree with the components in the same commit.
    return result.errorCount > 0 || result.staleRegistry ? 1 : 0;
  }

  if (command === "dev") {
    const handle = await dev(cwd, config);
    // Keep the process alive until interrupted; the watcher drives regenerates.
    await new Promise<void>((resolve) => {
      const stop = () => {
        handle.close();
        resolve();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    return 0;
  }

  console.log(USAGE);
  return command ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
