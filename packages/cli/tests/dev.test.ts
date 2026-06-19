import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type IMDXConfig } from "../src/config.js";
import {
  dev,
  runGenerate,
  staticBase,
  watchTargets,
  type Watcher,
} from "../src/dev.js";

const FIXTURE = join(__dirname, "fixture-app");

let app: string;
let config: IMDXConfig;

beforeEach(async () => {
  app = mkdtempSync(join(tmpdir(), "imdx-dev-"));
  cpSync(FIXTURE, app, { recursive: true });
  config = await loadConfig(app);
});

afterEach(() => {
  rmSync(app, { recursive: true, force: true });
});

describe("staticBase", () => {
  it("strips the glob portion of a pattern", () => {
    expect(staticBase("components/imdx/**/*.tsx")).toBe("components/imdx");
    expect(staticBase("src/**/{a,b}.ts")).toBe("src");
    expect(staticBase("*.tsx")).toBe(".");
    expect(staticBase("components/imdx")).toBe("components/imdx");
  });
});

describe("watchTargets", () => {
  it("watches the component dir and config file, never the outDir", () => {
    const targets = watchTargets(app, config);
    expect(targets).toContain(join(app, "components/imdx"));
    expect(targets).toContain(join(app, "imdx.config.json"));
    expect(targets.some((t) => t.includes(".imdx"))).toBe(false);
  });
});

describe("runGenerate", () => {
  it("writes the registry and summarizes component count + hash", async () => {
    const { result, line } = await runGenerate(app, config);
    expect(result.spec.components.map((c) => c.name)).toEqual(["Callout", "Chart"]);
    expect(line).toContain("2 component(s)");
    expect(line).toContain(result.spec.hash);
  });
});

/** A fake watcher that exposes its `onEvent` callback so tests can fire it. */
function fakeWatcher(): { watcher: Watcher; fire: () => void; disposed: () => boolean } {
  let onEvent: () => void = () => {};
  let disposed = false;
  return {
    watcher: (_paths, cb) => {
      onEvent = cb;
      return () => {
        disposed = true;
      };
    },
    fire: () => onEvent(),
    disposed: () => disposed,
  };
}

describe("dev watch loop", () => {
  it("does an initial generate and records the hash", async () => {
    const logs: string[] = [];
    const fw = fakeWatcher();
    const handle = await dev(app, config, {
      watcher: fw.watcher,
      log: (m) => logs.push(m),
      error: () => {},
    });
    expect(logs.some((l) => l.startsWith("imdx dev: watching"))).toBe(true);
    expect(logs.some((l) => l.includes("2 component(s)"))).toBe(true);
    expect(handle.lastHash).toMatch(/^[0-9a-f]{16}$/);
    handle.close();
    expect(fw.disposed()).toBe(true);
  });

  it("coalesces rapid events: each new event cancels the prior pending one", async () => {
    const fw = fakeWatcher();
    let scheduleCalls = 0;
    let cancelCalls = 0;
    let pending: (() => void) | null = null;
    const handle = await dev(app, config, {
      watcher: fw.watcher,
      log: () => {},
      error: () => {},
      schedule: (fn) => {
        scheduleCalls += 1;
        pending = fn;
        return () => {
          cancelCalls += 1;
          pending = null;
        };
      },
    });

    // Three rapid events schedule three times but cancel the two earlier ones,
    // leaving a single pending regenerate.
    fw.fire();
    fw.fire();
    fw.fire();
    expect(scheduleCalls).toBe(3);
    expect(cancelCalls).toBe(2);
    expect(pending).not.toBeNull();
    handle.close();
    // close() cancels the last pending callback too.
    expect(cancelCalls).toBe(3);
  });

  it("reports unchanged when a regenerate finds the same components", async () => {
    const logs: string[] = [];
    const fw = fakeWatcher();
    const handle = await dev(app, config, {
      watcher: fw.watcher,
      log: (m) => logs.push(m),
      error: () => {},
    });
    const firstHash = handle.lastHash;
    logs.length = 0;

    await handle.regenerate();

    expect(logs.filter((l) => l.includes("unchanged")).length).toBe(1);
    expect(handle.lastHash).toBe(firstHash);
    handle.close();
  });

  it("regenerates and reports a new hash when a component is added", async () => {
    const logs: string[] = [];
    const fw = fakeWatcher();
    const handle = await dev(app, config, {
      watcher: fw.watcher,
      log: (m) => logs.push(m),
      error: () => {},
    });
    const firstHash = handle.lastHash;
    logs.length = 0;

    writeFileSync(
      join(app, "components/imdx/Note.tsx"),
      [
        `import { defineIMDX } from "@imdx/core";`,
        `function NoteImpl({ text }: { text: string }) {`,
        `  return <aside>{text}</aside>;`,
        `}`,
        `export const Note = defineIMDX(NoteImpl, { name: "Note" });`,
        ``,
      ].join("\n"),
    );
    await handle.regenerate();

    expect(handle.lastHash).not.toBe(firstHash);
    expect(logs.some((l) => l.includes("3 component(s)"))).toBe(true);
    handle.close();
  });
});
