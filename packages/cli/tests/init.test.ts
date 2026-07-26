import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initNext, isNextApp, nextConfigSnippet } from "../src/init.js";

let app: string;

beforeEach(() => {
  app = mkdtempSync(join(tmpdir(), "mdmx-init-"));
  mkdirSync(join(app, "app"), { recursive: true });
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify({ name: "site", scripts: { dev: "next dev" } }, null, 2) + "\n",
  );
});

afterEach(() => {
  rmSync(app, { recursive: true, force: true });
});

describe("isNextApp", () => {
  it("recognizes app/ and src/app/, and rejects anything else", () => {
    expect(isNextApp(app)).toBe(true);
    const bare = mkdtempSync(join(tmpdir(), "mdmx-bare-"));
    try {
      expect(isNextApp(bare)).toBe(false);
      mkdirSync(join(bare, "src", "app"), { recursive: true });
      expect(isNextApp(bare)).toBe(true);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("mdmx init nextjs", () => {
  it("scaffolds the whole recipe", () => {
    const result = initNext(app);
    expect(result.created).toEqual([
      "mdmx.config.json",
      "app/api/mdmx/[...route]/route.ts",
      "app/mdmx/[[...slug]]/page.tsx",
      "components/mdmx/Callout.tsx",
      "content/posts/hello.mdx",
    ]);
    // The mount files are the zero-config forms.
    expect(readFileSync(join(app, "app/api/mdmx/[...route]/route.ts"), "utf8")).toContain(
      "createMDMXHandlers()",
    );
    expect(readFileSync(join(app, "app/mdmx/[[...slug]]/page.tsx"), "utf8")).toContain(
      '.mdmx/components',
    );
  });

  it("adds the generate scripts but keeps the ones already there", () => {
    const result = initNext(app);
    expect(result.scripts.sort()).toEqual(["generate", "prebuild", "predev"]);
    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.dev).toBe("next dev"); // untouched
    expect(pkg.scripts.predev).toBe("mdmx generate");
  });

  it("never overwrites an existing file", () => {
    writeFileSync(join(app, "mdmx.config.json"), '{ "contentDir": "essays" }\n');
    const result = initNext(app);
    expect(result.skipped).toContain("mdmx.config.json");
    expect(result.created).not.toContain("mdmx.config.json");
    expect(readFileSync(join(app, "mdmx.config.json"), "utf8")).toContain("essays");
  });

  it("prints the next.config snippet instead of editing the file", () => {
    writeFileSync(join(app, "next.config.mjs"), "export default {};\n");
    const result = initNext(app);
    expect(result.nextConfigSnippet).toContain("transpilePackages");
    expect(result.nextConfigSnippet).toContain("@mdmx/studio");
    // The user's config is untouched — we don't rewrite config-as-code.
    expect(readFileSync(join(app, "next.config.mjs"), "utf8")).toBe("export default {};\n");
  });

  it("is idempotent: a second run creates nothing", () => {
    initNext(app);
    const second = initNext(app);
    expect(second.created).toEqual([]);
    expect(second.skipped).toHaveLength(5);
    expect(second.scripts).toEqual([]);
  });

  it("works without a package.json (scripts are simply not added)", () => {
    rmSync(join(app, "package.json"));
    const result = initNext(app);
    expect(result.scripts).toEqual([]);
    expect(existsSync(join(app, "mdmx.config.json"))).toBe(true);
  });
});

describe("nextConfigSnippet", () => {
  it("lists every package Next has to transpile", () => {
    const snippet = nextConfigSnippet();
    for (const pkg of ["core", "project", "studio", "editor", "next", "dashboard"]) {
      expect(snippet).toContain(`@mdmx/${pkg}`);
    }
  });
});
