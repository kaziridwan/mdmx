#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { generate } from "./generate.js";
import { check, formatDiagnostics } from "./check.js";
import { dev } from "./dev.js";

const USAGE = `imdx <command>

Commands:
  generate   Scan components, emit .imdx/registry.json and .imdx/registry.ts
  check      Validate content files against the generated registry
  dev        Watch components/config and regenerate the registry on change

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
  const config = await loadConfig(cwd);

  if (command === "generate") {
    const result = await generate(cwd, config);
    for (const issue of result.issues) {
      const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.error(`${loc} ${issue.severity} ${issue.message}`);
    }
    console.log(
      `imdx: registered ${result.spec.components.length} component(s) → ${result.written.json}`,
    );
    return result.hasErrors ? 1 : 0;
  }

  if (command === "check") {
    const result = await check(cwd, config);
    const output = formatDiagnostics(result);
    if (output) console.log(output);
    console.log(
      `imdx: ${result.errorCount} error(s), ${result.warningCount} warning(s)`,
    );
    return result.errorCount > 0 ? 1 : 0;
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
