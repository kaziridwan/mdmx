import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  ENV_CLIENT_ID,
  ENV_SESSION_SECRET,
  loadConfig,
  loadRegistry,
  loadRegistrySpec,
  MissingRegistryError,
  ModeResolutionError,
  resolveMode,
  validateConfig,
  type MDMXConfig,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "mdmx-project-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns the defaults when no config file exists", async () => {
    const { config, path } = await loadConfig(root);
    expect(path).toBeNull();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("merges mdmx.config.json over the defaults", async () => {
    await writeFile(
      join(root, "mdmx.config.json"),
      JSON.stringify({ contentDir: "docs", repo: { owner: "o", name: "r", branch: "main" } }),
    );
    const { config, path } = await loadConfig(root);
    expect(path).toContain("mdmx.config.json");
    expect(config.contentDir).toBe("docs");
    expect(config.repo).toEqual({ owner: "o", name: "r", branch: "main" });
    // Untouched keys keep their defaults.
    expect(config.outDir).toBe(".mdmx");
    expect(config.mediaDir).toBe("public/media");
  });

  it("loads mdmx.config.mjs — the format the runtime used to ignore", async () => {
    await writeFile(
      join(root, "mdmx.config.mjs"),
      'export default { contentDir: "essays", collections: { notes: { dir: "essays/notes", fields: {} } } };\n',
    );
    const { config } = await loadConfig(root);
    expect(config.contentDir).toBe("essays");
    expect(config.collections?.notes?.dir).toBe("essays/notes");
  });

  it("prefers JSON when both files exist", async () => {
    await writeFile(join(root, "mdmx.config.json"), JSON.stringify({ contentDir: "from-json" }));
    await writeFile(join(root, "mdmx.config.mjs"), 'export default { contentDir: "from-mjs" };\n');
    const { config } = await loadConfig(root);
    expect(config.contentDir).toBe("from-json");
  });
});

describe("validateConfig", () => {
  it("accepts the defaults", () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual([]);
  });

  it("reports empty dirs, bad paths, and incomplete repos", () => {
    const bad: MDMXConfig = {
      ...DEFAULT_CONFIG,
      contentDir: "",
      basePath: "api/mdmx",
      mountPath: "/mdmx/",
      repo: { owner: "o", name: "", branch: "main" },
    };
    const problems = validateConfig(bad).join("\n");
    expect(problems).toContain("contentDir");
    expect(problems).toContain('basePath must start with "/"');
    expect(problems).toContain('mountPath must not end with "/"');
    expect(problems).toContain("repo.name");
  });
});

describe("resolveMode", () => {
  const full = {
    [ENV_CLIENT_ID]: "id",
    MDMX_GITHUB_CLIENT_SECRET: "secret",
    [ENV_SESSION_SECRET]: "session-secret-session-secret",
  };

  it("detects GitHub mode from the environment", () => {
    const resolved = resolveMode({ env: full });
    expect(resolved.mode).toBe("github");
    if (resolved.mode === "github") {
      expect(resolved.credentials.clientId).toBe("id");
    }
  });

  it("falls back to local mode outside production", () => {
    expect(resolveMode({ env: { NODE_ENV: "development" } }).mode).toBe("local");
    expect(resolveMode({ env: {} }).mode).toBe("local");
  });

  it("fails closed in production with no auth configured, naming the missing vars", () => {
    expect(() => resolveMode({ env: { NODE_ENV: "production" } })).toThrow(ModeResolutionError);
    try {
      resolveMode({ env: { NODE_ENV: "production", [ENV_CLIENT_ID]: "id" } });
      throw new Error("expected a throw");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("MDMX_GITHUB_CLIENT_SECRET");
      expect(message).toContain(ENV_SESSION_SECRET);
      expect(message).not.toContain(`${ENV_CLIENT_ID} is missing`);
    }
  });

  it("requires an explicit opt-in for local mode in production", () => {
    expect(() => resolveMode({ env: { NODE_ENV: "production" }, mode: "local" })).toThrow(
      /allowLocalModeInProduction/,
    );
    expect(
      resolveMode({
        env: { NODE_ENV: "production" },
        mode: "local",
        allowLocalModeInProduction: true,
      }).mode,
    ).toBe("local");
  });

  it("explicit github mode without credentials names what is missing", () => {
    expect(() => resolveMode({ env: {}, mode: "github" })).toThrow(/MDMX_GITHUB_CLIENT_ID/);
  });
});

describe("registry loading", () => {
  it("loads the generated spec and builds a Registry", async () => {
    await mkdir(join(root, ".mdmx"), { recursive: true });
    await writeFile(
      join(root, ".mdmx", "registry.json"),
      JSON.stringify({
        mdmxRegistryVersion: 1,
        components: [{ name: "Callout", children: { policy: "rich-text" }, props: [] }],
      }),
    );
    const spec = loadRegistrySpec(root, DEFAULT_CONFIG);
    expect(spec.components).toHaveLength(1);
    expect(loadRegistry(root, DEFAULT_CONFIG).has("Callout")).toBe(true);
  });

  it("points at `mdmx generate` when the registry is missing", () => {
    expect(() => loadRegistrySpec(root, DEFAULT_CONFIG)).toThrow(MissingRegistryError);
    expect(() => loadRegistrySpec(root, DEFAULT_CONFIG)).toThrow(/mdmx generate/);
  });
});
