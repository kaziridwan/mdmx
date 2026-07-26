import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMDMXHandlers } from "../src/index.js";

/**
 * The Layer-1 recipe (ADR-039): `createMDMXHandlers()` with no arguments.
 * Structural values come from `mdmx.config.json`, the registry from `outDir`,
 * the mode from the environment, and the provider from the mode.
 */

const BASE = "https://site.example/api/mdmx";
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "mdmx-convention-"));
  await writeFile(
    join(root, "mdmx.config.json"),
    JSON.stringify({
      contentDir: "essays",
      mediaDir: "public/uploads",
      repo: { owner: "ada", name: "notes", branch: "trunk" },
      validation: "strict",
      collections: {
        essays: { dir: "essays", fields: { title: { control: { type: "text" } } } },
      },
    }),
  );
  await mkdir(join(root, ".mdmx"), { recursive: true });
  await writeFile(
    join(root, ".mdmx", "registry.json"),
    JSON.stringify({
      mdmxRegistryVersion: 1,
      components: [{ name: "Callout", children: { policy: "rich-text" }, props: [] }],
    }),
  );
  await mkdir(join(root, "essays"), { recursive: true });
  await writeFile(join(root, "essays", "hello.mdx"), "---\ntitle: Hello\n---\n\n# Hello\n");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** No options but the test seams: root (instead of cwd) and env. */
const conventional = () => createMDMXHandlers({ root, env: { NODE_ENV: "development" } });

describe("zero-argument handlers", () => {
  it("serves requests with nothing passed but the project root", async () => {
    const res = await conventional().GET(new Request(`${BASE}/me`));
    expect(res.status).toBe(200);
    const me = (await res.json()) as {
      repo: { owner: string; branch: string };
      contentDir: string;
      mediaDir: string;
      validation: string;
      localMode: boolean;
    };
    // Every one of these came from mdmx.config.json or the environment.
    expect(me.repo).toEqual({ owner: "ada", name: "notes", branch: "trunk" });
    expect(me.contentDir).toBe("essays");
    expect(me.mediaDir).toBe("public/uploads");
    expect(me.validation).toBe("strict");
    expect(me.localMode).toBe(true); // no OAuth vars, not production
  });

  it("reads content through the provider the mode implies", async () => {
    const res = await conventional().GET(
      new Request(`${BASE}/entries?dir=essays`),
    );
    expect(res.status).toBe(200);
    const { entries } = (await res.json()) as { entries: { path: string }[] };
    expect(entries.map((e) => e.path)).toEqual(["essays/hello.mdx"]);
  });

  it("loads the generated registry from outDir and validates against it", async () => {
    // strict validation from the config file + the baked registry means an
    // unregistered component is rejected, with nothing wired by hand.
    const res = await conventional().PUT(
      new Request(`${BASE}/file`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "essays/bad.mdx",
          content: "---\ntitle: Bad\n---\n\n<Mystery />\n",
        }),
      }),
    );
    expect(res.status).toBe(422);
    const { diagnostics } = (await res.json()) as { diagnostics: { code: string }[] };
    expect(diagnostics.map((d) => d.code)).toContain("MDMX001");
  });

  it("switches to GitHub mode when the OAuth environment is present", async () => {
    const h = createMDMXHandlers({
      root,
      env: {
        NODE_ENV: "development",
        MDMX_GITHUB_CLIENT_ID: "id",
        MDMX_GITHUB_CLIENT_SECRET: "secret",
        MDMX_SESSION_SECRET: "session-secret-session-secret",
      },
      // The provider would otherwise be GitHubProvider hitting the network.
      createProvider: () => {
        throw new Error("not needed for this assertion");
      },
    });
    const res = await h.GET(new Request(`${BASE}/auth/login`));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("github.com/login/oauth/authorize");
  });

  it("falls back to defaults when there is no config file at all", async () => {
    const bare = await mkdtemp(join(tmpdir(), "mdmx-bare-"));
    try {
      const res = await createMDMXHandlers({
        root: bare,
        env: { NODE_ENV: "development" },
      }).GET(new Request(`${BASE}/me`));
      expect(res.status).toBe(200);
      const me = (await res.json()) as { contentDir: string; mediaDir: string };
      expect(me.contentDir).toBe("content");
      expect(me.mediaDir).toBe("public/media");
    } finally {
      await rm(bare, { recursive: true, force: true });
    }
  });
});
