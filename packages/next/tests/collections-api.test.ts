import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Registry, type Diagnostic, type RegistrySpec } from "@mdmx/core";
import {
  createMDMXHandlers,
  LocalProvider,
  type MDMXHandlers,
} from "../src/index.js";

const BASE = "https://site.example/api/mdmx";

// Baked registry: one component, plus one baked-in collection ("legacy") to
// exercise the registry-fallback and seed-on-write paths.
const registrySpec: RegistrySpec = {
  mdmxRegistryVersion: 1,
  components: [
    {
      name: "Callout",
      children: { policy: "rich-text" },
      props: [
        {
          name: "variant",
          required: true,
          control: { type: "select", options: ["info", "warn"] },
          default: "info",
        },
      ],
    },
  ],
  collections: [
    {
      name: "legacy",
      dir: "content/legacy",
      fields: [{ name: "title", required: true, control: { type: "text" } }],
    },
  ],
};

let root: string;

function makeHandlers(
  over: Partial<Parameters<typeof createMDMXHandlers>[0]> = {},
): MDMXHandlers {
  return createMDMXHandlers({
    repo: { owner: "local", name: "demo", branch: "main" },
    contentDir: "content",
    mediaDir: "public/media",
    localMode: true,
    createProvider: () => new LocalProvider(root),
    registry: new Registry(registrySpec),
    ...over,
  });
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    ...(body !== undefined
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
}

async function seedConfig(collections: unknown): Promise<void> {
  const provider = new LocalProvider(root);
  await provider.commit(
    [
      {
        path: "mdmx.config.json",
        content:
          JSON.stringify({ components: "components/**/*.tsx", collections }, null, 2) +
          "\n",
      },
    ],
    "seed config",
  );
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "mdmx-collections-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("GET /collections", () => {
  it("falls back to the baked registry when no config file exists", async () => {
    const h = makeHandlers();
    const res = await h.GET(req("GET", "/collections"));
    expect(res.status).toBe(200);
    const { collections } = (await res.json()) as { collections: { name: string }[] };
    expect(collections.map((c) => c.name)).toEqual(["legacy"]);
  });

  it("resolves from mdmx.config.json when present (config wins)", async () => {
    await seedConfig({
      posts: {
        dir: "content/posts",
        fields: { title: { control: { type: "text" }, required: true } },
      },
    });
    const h = makeHandlers();
    const res = await h.GET(req("GET", "/collections"));
    const { collections } = (await res.json()) as {
      collections: { name: string; fields: { name: string }[] }[];
    };
    expect(collections.map((c) => c.name)).toEqual(["posts"]);
    expect(collections[0]!.fields[0]).toMatchObject({ name: "title", required: true });
  });

  it("500s with a clear message when the config file is corrupt", async () => {
    const provider = new LocalProvider(root);
    await provider.commit(
      [{ path: "mdmx.config.json", content: "{ not json" }],
      "seed corrupt",
    );
    const h = makeHandlers();
    const res = await h.GET(req("GET", "/collections"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("not valid JSON");
  });
});

describe("POST /collections", () => {
  it("creates a collection, defaulting dir to <contentDir>/<name>", async () => {
    await seedConfig({});
    const h = makeHandlers();
    const res = await h.POST(
      req("POST", "/collections", {
        name: "notes",
        fields: { title: { control: { type: "text" }, required: true } },
      }),
    );
    expect(res.status).toBe(201);
    const { collection } = (await res.json()) as {
      collection: { name: string; dir: string };
    };
    expect(collection).toMatchObject({ name: "notes", dir: "content/notes" });

    // The config file gained the collection and kept unrelated keys.
    const written = JSON.parse(await readFile(join(root, "mdmx.config.json"), "utf8")) as {
      components: string;
      collections: Record<string, { dir: string }>;
    };
    expect(written.components).toBe("components/**/*.tsx");
    expect(written.collections.notes!.dir).toBe("content/notes");
  });

  it("seeds baked registry collections into a fresh config file", async () => {
    const h = makeHandlers(); // no config file at all
    const res = await h.POST(
      req("POST", "/collections", { name: "notes", fields: {} }),
    );
    expect(res.status).toBe(201);
    const written = JSON.parse(await readFile(join(root, "mdmx.config.json"), "utf8")) as {
      collections: Record<string, unknown>;
    };
    // Both the migrated "legacy" collection and the new one are present.
    expect(Object.keys(written.collections).sort()).toEqual(["legacy", "notes"]);
  });

  it("rejects duplicates with 409", async () => {
    await seedConfig({ posts: { dir: "content/posts", fields: {} } });
    const h = makeHandlers();
    const res = await h.POST(req("POST", "/collections", { name: "posts", fields: {} }));
    expect(res.status).toBe(409);
  });

  it("rejects invalid names, dirs, and controls with 400 + problems", async () => {
    const h = makeHandlers();
    const bad = [
      { name: "My Posts", fields: {} },
      { name: "notes", dir: "outside/notes", fields: {} },
      { name: "notes", dir: "content/../escape", fields: {} },
      {
        name: "notes",
        fields: { x: { control: { type: "select", options: [] } } },
      },
    ];
    for (const body of bad) {
      const res = await h.POST(req("POST", "/collections", body));
      expect(res.status).toBe(400);
      const parsed = (await res.json()) as { problems?: string[] };
      expect(parsed.problems?.length).toBeGreaterThan(0);
    }
  });
});

describe("PUT /collections/:name", () => {
  it("replaces the field schema and keeps the dir", async () => {
    await seedConfig({
      posts: {
        dir: "content/blog",
        fields: { title: { control: { type: "text" }, required: true } },
      },
    });
    const h = makeHandlers();
    const res = await h.PUT(
      req("PUT", "/collections/posts", {
        fields: {
          title: { control: { type: "text" }, required: true },
          tags: { control: { type: "multiselect", options: ["a", "b"] } },
        },
      }),
    );
    expect(res.status).toBe(200);
    const { collection } = (await res.json()) as {
      collection: { dir: string; fields: { name: string }[] };
    };
    expect(collection.dir).toBe("content/blog");
    expect(collection.fields.map((f) => f.name)).toEqual(["title", "tags"]);
  });

  it("migrates a registry-only collection into the config on first edit", async () => {
    const h = makeHandlers(); // "legacy" exists only in the baked registry
    const res = await h.PUT(
      req("PUT", "/collections/legacy", {
        fields: { title: { control: { type: "text" } } },
      }),
    );
    expect(res.status).toBe(200);
    const written = JSON.parse(await readFile(join(root, "mdmx.config.json"), "utf8")) as {
      collections: Record<string, { dir: string }>;
    };
    expect(written.collections.legacy!.dir).toBe("content/legacy");
  });

  it("404s for unknown collections and 400s invalid fields", async () => {
    await seedConfig({ posts: { dir: "content/posts", fields: {} } });
    const h = makeHandlers();
    expect(
      (await h.PUT(req("PUT", "/collections/nope", { fields: {} }))).status,
    ).toBe(404);
    expect(
      (
        await h.PUT(
          req("PUT", "/collections/posts", {
            fields: { x: { control: { type: "wat" } } },
          }),
        )
      ).status,
    ).toBe(400);
  });
});

describe("runtime collections drive frontmatter validation on save", () => {
  it("applies a dashboard-created schema to saves immediately (strict)", async () => {
    await seedConfig({});
    const h = makeHandlers({ validation: "strict" });

    const create = await h.POST(
      req("POST", "/collections", {
        name: "notes",
        fields: { title: { control: { type: "text" }, required: true } },
      }),
    );
    expect(create.status).toBe(201);

    // Missing required `title` → MDMX008, rejected in strict mode.
    const save = await h.PUT(
      req("PUT", "/file", {
        path: "content/notes/first.mdx",
        content: "---\ndraft: true\n---\n\n# Hi\n",
      }),
    );
    expect(save.status).toBe(422);
    const body = (await save.json()) as { diagnostics: Diagnostic[] };
    expect(body.diagnostics.some((d) => d.code === "MDMX008")).toBe(true);

    // With the field present the save lands.
    const ok = await h.PUT(
      req("PUT", "/file", {
        path: "content/notes/first.mdx",
        content: "---\ntitle: First\n---\n\n# Hi\n",
      }),
    );
    expect(ok.status).toBe(200);
  });
});

describe("GET /me", () => {
  it("reports repo, dirs, validation mode, and localMode for the settings page", async () => {
    const h = makeHandlers({ validation: "strict" });
    const res = await h.GET(req("GET", "/me"));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      login: "local",
      contentDir: "content",
      mediaDir: "public/media",
      validation: "strict",
      localMode: true,
    });
  });
});
