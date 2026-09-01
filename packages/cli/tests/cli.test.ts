import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { check } from "../src/check.js";
import { loadConfig, type MDMXConfig } from "@mdmx/project";
import { generate, type GenerateResult } from "../src/generate.js";

const APP = join(__dirname, "fixture-app");

let config: MDMXConfig;
let result: GenerateResult;

beforeAll(async () => {
  ({ config } = await loadConfig(APP));
  result = await generate(APP, config);
});

afterAll(() => {
  rmSync(join(APP, ".mdmx"), { recursive: true, force: true });
});

describe("mdmx generate", () => {
  it("loads config from mdmx.config.json", () => {
    expect(config.components).toBe("components/mdmx/**/*.tsx");
    expect(config.outDir).toBe(".mdmx");
  });

  it("finds both components and reports no errors", () => {
    expect(result.hasErrors).toBe(false);
    expect(result.spec.components.map((c) => c.name)).toEqual(["Callout", "Chart", "Poll"]);
  });

  it("infers controls from TypeScript types", () => {
    const chart = result.spec.components.find((c) => c.name === "Chart")!;
    const byName = Object.fromEntries(chart.props.map((p) => [p.name, p]));

    expect(byName.title!.control).toEqual({ type: "text" });
    expect(byName.title!.required).toBe(false);
    expect(byName.height!.control).toEqual({ type: "number" });
    expect(byName.stacked!.control).toEqual({ type: "boolean" });
    expect(byName.series!.control).toEqual({ type: "list", item: { type: "text" } });
    expect(byName.series!.required).toBe(true);
    expect(byName.config!.control).toEqual({ type: "json" });
  });

  it("infers select controls from string-literal unions", () => {
    const callout = result.spec.components.find((c) => c.name === "Callout")!;
    const variant = callout.props.find((p) => p.name === "variant")!;
    expect(variant.control).toEqual({
      type: "select",
      options: ["info", "warn", "danger"],
    });
    expect(variant.required).toBe(true);
  });

  it("merges defineMDMX config over inference", () => {
    const callout = result.spec.components.find((c) => c.name === "Callout")!;
    expect(callout.category).toBe("Content");
    expect(callout.children.policy).toBe("rich-text");
    const variant = callout.props.find((p) => p.name === "variant")!;
    expect(variant.default).toBe("info");
    const title = callout.props.find((p) => p.name === "title")!;
    expect(title.control).toEqual({ type: "text", placeholder: "Optional title" });
    expect(title.description).toBe("Short label shown in the header");
  });

  it("derives children policy and render mode", () => {
    const chart = result.spec.components.find((c) => c.name === "Chart")!;
    expect(chart.children.policy).toBe("none"); // no children prop
    expect(chart.render).toEqual({ mode: "placeholder" });
  });

  it("carries render.interactive and defaults the mode to live (registry v2)", () => {
    const poll = result.spec.components.find((c) => c.name === "Poll")!;
    expect(poll.render).toEqual({ mode: "live", interactive: true });
    // Components that say nothing about routing get no key — the editor's
    // default policy applies and the registry stays minimal.
    const callout = result.spec.components.find((c) => c.name === "Callout")!;
    expect(callout.render).toEqual({ mode: "live" });
    expect(result.spec.mdmxRegistryVersion).toBe(2);
  });

  it("excludes function props with a warning", () => {
    const callout = result.spec.components.find((c) => c.name === "Callout")!;
    expect(callout.props.find((p) => p.name === "onDismiss")).toBeUndefined();
    expect(
      result.issues.some(
        (i) => i.severity === "warning" && i.message.includes("onDismiss"),
      ),
    ).toBe(true);
  });

  it("emits a loadable registry.json with a hash", () => {
    const raw = JSON.parse(
      readFileSync(join(APP, ".mdmx/registry.json"), "utf8"),
    ) as RegistrySpec;
    expect(raw.hash).toMatch(/^[0-9a-f]{16}$/);
    const registry = new Registry(raw);
    expect(registry.has("Callout")).toBe(true);
  });

  it("emits a server-safe binding module with correct imports", () => {
    const ts = readFileSync(join(APP, ".mdmx/registry.ts"), "utf8");
    expect(ts).toContain('import Callout from "../components/mdmx/Callout";');
    expect(ts).toContain('import { Chart } from "../components/mdmx/Chart";');
    expect(ts).toContain("export const registry = new Registry(spec);");
    expect(ts).toContain("export const serverComponents = { Callout, Chart, Poll };");
    // No "use client": public pages must be able to import this on the server.
    expect(ts).not.toContain('"use client"');
  });

  it("emits a client component map behind the RSC boundary", () => {
    const ts = readFileSync(join(APP, ".mdmx/components.ts"), "utf8");
    expect(ts.startsWith('"use client";')).toBe(true);
    expect(ts).toContain('import Callout from "../components/mdmx/Callout";');
    expect(ts).toContain("export const components = { Callout, Chart, Poll };");
  });

  it("emits bound server helpers addressed by collection name", async () => {
    const withCollections: MDMXConfig = {
      ...config,
      collections: { posts: { dir: "content/posts", fields: {} } },
    };
    await generate(APP, withCollections);
    const ts = readFileSync(join(APP, ".mdmx/server.ts"), "utf8");
    expect(ts).toContain('"posts": "content/posts"');
    // Extensionless: these modules are compiled by the app's bundler (Next's
    // webpack/turbopack), which does not map "./registry.js" onto registry.ts.
    expect(ts).toContain('from "./registry"');
    expect(ts).not.toContain('from "./registry.js"');
    expect(ts).toContain("export async function MDMXEntry(");
    expect(ts).toContain("export async function listEntries(");
    expect(ts).toContain('import { serverComponents } from "./registry";');
    await generate(APP, config); // restore
  });

  it("is deterministic: no timestamp, and a no-op regenerate writes nothing", async () => {
    const json = readFileSync(join(APP, ".mdmx/registry.json"), "utf8");
    expect(json).not.toContain("generatedAt");
    const again = await generate(APP, config);
    // Committed artifacts (ADR-040) must not churn on an unchanged run.
    expect(again.changed).toEqual([]);
  });

  it("warns on a non-exported component and excludes it from both artifacts", () => {
    expect(result.spec.components.find((c) => c.name === "Hidden")).toBeUndefined();
    expect(
      result.issues.some(
        (i) =>
          i.severity === "warning" &&
          i.message.includes('"Hidden"') &&
          i.message.includes("not exported"),
      ),
    ).toBe(true);
    const ts = readFileSync(join(APP, ".mdmx/registry.ts"), "utf8");
    expect(ts).not.toContain("Hidden");
  });
});

describe("mdmx check", () => {
  it("passes the valid file and flags the invalid one", async () => {
    expect(existsSync(join(APP, ".mdmx/registry.json"))).toBe(true);
    const res = await check(APP, config);
    expect(res.files.map((f) => f.file)).toEqual(["content/invalid.mdx"]);

    const codes = res.files[0]!.diagnostics.map((d) => d.code).sort();
    expect(codes).toContain("MDMX001"); // <Mystery />
    expect(codes).toContain("MDMX002"); // series={getSeries()}
    expect(codes).toContain("MDMX004"); // heading inside rich-text
    expect(res.errorCount).toBeGreaterThan(0);
  });
});

describe("collections", () => {
  it("normalizes config collections into the emitted registry spec", async () => {
    const withCollections: MDMXConfig = {
      ...config,
      collections: {
        posts: {
          dir: "content/posts",
          fields: {
            title: { control: { type: "text" }, required: true },
            status: {
              control: { type: "select", options: ["draft", "published"] },
              required: true,
              default: "draft",
            },
          },
        },
      },
    };
    const res = await generate(APP, withCollections);
    expect(res.spec.collections).toHaveLength(1);
    const posts = res.spec.collections![0]!;
    expect(posts.name).toBe("posts");
    expect(posts.dir).toBe("content/posts");
    expect(posts.fields.map((f) => f.name)).toEqual(["title", "status"]);
    expect(posts.fields[1]!.default).toBe("draft");

    // The collection is loadable and resolves by path.
    const registry = new Registry(res.spec);
    expect(registry.collectionForPath("content/posts/x.mdx")?.name).toBe("posts");
  });

  it("omits the collections key when none are configured", async () => {
    const res = await generate(APP, config);
    expect(res.spec.collections).toBeUndefined();
  });
});

describe("stale registry detection", () => {
  it("reports nothing when the committed registry matches the components", async () => {
    const res = await check(APP, config);
    expect(res.staleRegistry).toBeNull();
  });

  it("catches a committed registry that fell behind its components", async () => {
    const registryPath = join(APP, ".mdmx/registry.json");
    const original = readFileSync(registryPath, "utf8");
    try {
      const spec = JSON.parse(original) as RegistrySpec;
      // Simulate "edited a component, forgot to regenerate": the committed
      // artifact records the hash of the *old* component set.
      spec.hash = "0000000000000000";
      writeFileSync(registryPath, JSON.stringify(spec, null, 2) + "\n");
      const res = await check(APP, config);
      expect(res.staleRegistry).toContain("stale");
      expect(res.staleRegistry).toContain("mdmx generate");
    } finally {
      writeFileSync(registryPath, original);
    }
  });
});
