import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Registry, type RegistrySpec } from "@mdmx/core";
import type { StudioComponentDef } from "@mdmx/studio";
import { createMDMXHandlers, LocalProvider, type MDMXHandlers } from "../src/index.js";

/**
 * Studio route coverage (review §3.4: the one untested route family, and it
 * holds the riskiest writes — a save that skipped validation would put
 * unrenderable JSON in the content repo, and eject writes real source).
 */

const BASE = "https://site.example/api/mdmx";
let root: string;

const registrySpec: RegistrySpec = {
  mdmxRegistryVersion: 1,
  components: [{ name: "Callout", children: { policy: "rich-text" }, props: [] }],
};

const promo: StudioComponentDef = {
  mdmxStudioVersion: 1,
  name: "PromoCard",
  props: [{ name: "title", type: "string", default: "Hi" }],
  template: {
    tag: "div",
    classes: "rounded p-4",
    children: [{ tag: "h3", children: [{ text: "{props.title}" }] }],
  },
};

function makeHandlers(): MDMXHandlers {
  return createMDMXHandlers({
    root,
    env: { NODE_ENV: "development" },
    contentDir: "content",
    componentsDir: "components/mdmx",
    createProvider: () => new LocalProvider(root),
    registry: new Registry(registrySpec),
  });
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    ...(body !== undefined
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
}

async function seedDef(def: StudioComponentDef): Promise<void> {
  await mkdir(join(root, "content", "_components"), { recursive: true });
  await writeFile(
    join(root, "content", "_components", `${def.name}.json`),
    JSON.stringify(def, null, 2) + "\n",
  );
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "mdmx-studio-routes-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("GET /studio/components", () => {
  it("returns an empty list before any definitions exist", async () => {
    const res = await makeHandlers().GET(req("GET", "/studio/components"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { components: unknown[]; invalid: unknown[] };
    expect(body.components).toEqual([]);
    expect(body.invalid).toEqual([]);
  });

  it("lists valid definitions and reports broken ones instead of hiding them", async () => {
    await seedDef(promo);
    await mkdir(join(root, "content", "_components"), { recursive: true });
    await writeFile(join(root, "content", "_components", "Broken.json"), "{ not json");

    const res = await makeHandlers().GET(req("GET", "/studio/components"));
    const body = (await res.json()) as {
      components: { def: StudioComponentDef; sha: string }[];
      invalid: { path: string; problems: string[] }[];
    };
    expect(body.components.map((c) => c.def.name)).toEqual(["PromoCard"]);
    expect(body.components[0]!.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(body.invalid).toHaveLength(1);
    expect(body.invalid[0]!.problems.join(" ")).toContain("invalid JSON");
  });
});

describe("PUT /studio/components/:name", () => {
  it("saves a valid definition and returns its registry spec", async () => {
    const res = await makeHandlers().PUT(
      req("PUT", "/studio/components/PromoCard", { def: promo }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { path: string; spec: { name: string } };
    expect(body.path).toBe("content/_components/PromoCard.json");
    expect(body.spec.name).toBe("PromoCard");
    const written = await readFile(join(root, body.path), "utf8");
    expect(JSON.parse(written)).toEqual(promo);
  });

  it("rejects a definition whose name doesn't match the route", async () => {
    const res = await makeHandlers().PUT(
      req("PUT", "/studio/components/Other", { def: promo }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("must match the route");
  });

  it("rejects invalid templates with problems, and writes nothing", async () => {
    const res = await makeHandlers().PUT(
      req("PUT", "/studio/components/Evil", {
        def: {
          mdmxStudioVersion: 1,
          name: "Evil",
          props: [],
          template: { tag: "script", children: [{ text: "alert(1)" }] },
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { problems: string[] };
    expect(body.problems.join(" ")).toMatch(/script/i);
    await expect(
      readFile(join(root, "content/_components/Evil.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("refuses a name already used by a code component", async () => {
    const res = await makeHandlers().PUT(
      req("PUT", "/studio/components/Callout", { def: { ...promo, name: "Callout" } }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { problems: string[] }).problems.join(" ")).toMatch(
      /already|taken|use/i,
    );
  });

  it("allows re-saving the same component (its own name isn't a collision)", async () => {
    await seedDef(promo);
    const res = await makeHandlers().PUT(
      req("PUT", "/studio/components/PromoCard", {
        def: { ...promo, props: [{ name: "title", type: "string", default: "Updated" }] },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("honors expectedSha, so a stale editor gets a 409 instead of clobbering", async () => {
    await seedDef(promo);
    const res = await makeHandlers().PUT(
      req("PUT", "/studio/components/PromoCard", {
        def: promo,
        expectedSha: "0".repeat(40),
      }),
    );
    expect(res.status).toBe(409);
  });
});

describe("DELETE /studio/components/:name", () => {
  it("removes the stored definition", async () => {
    await seedDef(promo);
    const res = await makeHandlers().DELETE(req("DELETE", "/studio/components/PromoCard"));
    expect(res.status).toBe(200);
    await expect(
      readFile(join(root, "content/_components/PromoCard.json"), "utf8"),
    ).rejects.toThrow();
  });
});

describe("POST /studio/components/:name/eject", () => {
  it("writes a defineMDMX TSX file and keeps the JSON definition", async () => {
    await seedDef(promo);
    const res = await makeHandlers().POST(
      req("POST", "/studio/components/PromoCard/eject"),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { path: string; note: string };
    expect(body.path).toBe("components/mdmx/PromoCard.tsx");
    const tsx = await readFile(join(root, body.path), "utf8");
    expect(tsx).toContain("defineMDMX");
    expect(tsx).toContain("PromoCard");
    expect(body.note).toContain("mdmx generate");
    // The definition survives so the component keeps working until rebuild.
    await expect(
      readFile(join(root, "content/_components/PromoCard.json"), "utf8"),
    ).resolves.toContain("PromoCard");
  });

  it("404s for a component that doesn't exist", async () => {
    const res = await makeHandlers().POST(req("POST", "/studio/components/Ghost/eject"));
    expect(res.status).toBe(404);
  });

  it("never overwrites an existing source file", async () => {
    await seedDef(promo);
    await mkdir(join(root, "components", "mdmx"), { recursive: true });
    await writeFile(join(root, "components/mdmx/PromoCard.tsx"), "// hand-written\n");
    const res = await makeHandlers().POST(
      req("POST", "/studio/components/PromoCard/eject"),
    );
    expect(res.status).toBe(409);
    expect(await readFile(join(root, "components/mdmx/PromoCard.tsx"), "utf8")).toBe(
      "// hand-written\n",
    );
  });
});
