import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Registry, type RegistrySpec } from "@mdmx/core";
import {
  createMDMXHandlers,
  LocalProvider,
  parseCookies,
  seal,
  unseal,
  type MDMXHandlers,
  type SessionData,
} from "../src/index.js";

const SECRET = "test-secret-test-secret";
const BASE = "https://site.example/api/mdmx";

// ---------------------------------------------------------------------------
// Fake GitHub OAuth + permission endpoints
// ---------------------------------------------------------------------------

function fakeAuthFetch(permission = "write"): typeof globalThis.fetch {
  return async (input, init) => {
    const url = String(input);
    if (url.endsWith("/login/oauth/access_token")) {
      const body = JSON.parse(String(init?.body)) as { code: string };
      return body.code === "good-code"
        ? respond({ access_token: "gh-token-123" })
        : respond({ error: "bad_verification_code" });
    }
    if (url.endsWith("/user")) return respond({ login: "jane" });
    if (url.includes("/collaborators/jane/permission")) {
      return respond({ permission });
    }
    return respond({ message: "unexpected" }, 404);
  };
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------

const registry = new Registry({
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
} satisfies RegistrySpec);

let root: string;
let now = Date.now();

function makeHandlers(over: Partial<Parameters<typeof createMDMXHandlers>[0]> = {}): MDMXHandlers {
  return createMDMXHandlers({
    repo: { owner: "jane", name: "blog", branch: "main" },
    contentDir: "content",
    mediaDir: "public/media",
    auth: { clientId: "id", clientSecret: "secret", fetch: fakeAuthFetch() },
    sessionSecret: SECRET,
    createProvider: () => new LocalProvider(root),
    registry,
    now: () => now,
    ...over,
  });
}

function sessionCookie(overrides: Partial<SessionData> = {}): string {
  const data: SessionData = {
    login: "jane",
    token: "gh-token-123",
    expiresAt: now + 8 * 60 * 60 * 1000,
    verifiedAt: now,
    ...overrides,
  };
  return `mdmx_session=${seal(data, SECRET)}`;
}

function req(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      cookie: sessionCookie(),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "mdmx-api-"));
  const seedProvider = new LocalProvider(root);
  await seedProvider.commit(
    [
      {
        path: "content/posts/hello.mdx",
        content: '---\ntitle: Hello\n---\n\n<Callout variant="info">\n  Hi.\n</Callout>\n',
      },
    ],
    "seed",
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("sessions", () => {
  it("seal/unseal round-trips and rejects tampering and expiry", () => {
    const data: SessionData = {
      login: "jane",
      token: "t",
      expiresAt: Date.now() + 1000,
      verifiedAt: Date.now(),
    };
    const sealed = seal(data, SECRET);
    expect(unseal(sealed, SECRET)).toEqual(data);
    expect(unseal(sealed.slice(0, -4) + "AAAA", SECRET)).toBeNull();
    expect(unseal(sealed, "wrong-secret-wrong-secret")).toBeNull();
    expect(
      unseal(seal({ ...data, expiresAt: Date.now() - 1 }, SECRET), SECRET),
    ).toBeNull();
  });
});

describe("OAuth flow", () => {
  it("login redirects to GitHub with a state cookie", async () => {
    const h = makeHandlers();
    const res = await h.GET(new Request(`${BASE}/auth/login`));
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("github.com/login/oauth/authorize");
    expect(location).toContain("scope=repo");
    const state = new URL(location).searchParams.get("state")!;
    expect(res.headers.get("set-cookie")).toContain(`mdmx_oauth_state=${state}`);
  });

  it("callback exchanges the code, checks permission, and seals a session", async () => {
    const h = makeHandlers();
    const res = await h.GET(
      new Request(`${BASE}/auth/callback?code=good-code&state=s1`, {
        headers: { cookie: "mdmx_oauth_state=s1" },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/mdmx");
    const setCookies = res.headers.getSetCookie();
    const sessionSet = setCookies.find((c) => c.startsWith("mdmx_session="))!;
    const sealed = parseCookies(sessionSet.split(";")[0]!)["mdmx_session"]!;
    const session = unseal(sealed, SECRET)!;
    expect(session.login).toBe("jane");
    expect(session.token).toBe("gh-token-123");
  });

  it("rejects a state mismatch", async () => {
    const h = makeHandlers();
    const res = await h.GET(
      new Request(`${BASE}/auth/callback?code=good-code&state=evil`, {
        headers: { cookie: "mdmx_oauth_state=s1" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects users without push permission", async () => {
    const h = makeHandlers({
      auth: { clientId: "id", clientSecret: "secret", fetch: fakeAuthFetch("read") },
    });
    const res = await h.GET(
      new Request(`${BASE}/auth/callback?code=good-code&state=s1`, {
        headers: { cookie: "mdmx_oauth_state=s1" },
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("auth guard", () => {
  it("401s without a session and on a garbage cookie", async () => {
    const h = makeHandlers();
    expect((await h.GET(new Request(`${BASE}/me`))).status).toBe(401);
    expect(
      (
        await h.GET(
          new Request(`${BASE}/me`, { headers: { cookie: "mdmx_session=garbage" } }),
        )
      ).status,
    ).toBe(401);
  });

  it("re-verifies repo permission after 5 minutes and refreshes the cookie", async () => {
    const h = makeHandlers();
    const stale = sessionCookie({ verifiedAt: now - 6 * 60 * 1000 });
    const res = await h.GET(new Request(`${BASE}/me`, { headers: { cookie: stale } }));
    expect(res.status).toBe(200);
    const refreshed = res.headers.getSetCookie().find((c) => c.startsWith("mdmx_session="));
    expect(refreshed).toBeDefined();
  });

  it("401s when access was revoked since the session was issued", async () => {
    const h = makeHandlers({
      auth: { clientId: "id", clientSecret: "secret", fetch: fakeAuthFetch("read") },
    });
    const stale = sessionCookie({ verifiedAt: now - 6 * 60 * 1000 });
    const res = await h.GET(new Request(`${BASE}/me`, { headers: { cookie: stale } }));
    expect(res.status).toBe(401);
  });
});

describe("content API", () => {
  it("GET /me returns the session identity", async () => {
    const h = makeHandlers();
    const res = await h.GET(req("GET", "/me"));
    expect(await res.json()).toMatchObject({ login: "jane" });
  });

  it("lists and reads files", async () => {
    const h = makeHandlers();
    const list = (await (await h.GET(req("GET", "/files"))).json()) as {
      files: Array<{ path: string }>;
    };
    expect(list.files.map((f) => f.path)).toContain("content/posts/hello.mdx");

    const file = (await (
      await h.GET(req("GET", "/file?path=content/posts/hello.mdx"))
    ).json()) as { content: string; sha: string };
    expect(file.content).toContain("<Callout");
    expect(file.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("saves with server-side validation diagnostics (report mode)", async () => {
    const h = makeHandlers();
    const res = await h.PUT(
      req("PUT", "/file", {
        path: "content/posts/new.mdx",
        content: "# New\n\n<Mystery />\n",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { diagnostics: Array<{ code: string }> };
    expect(body.diagnostics.map((d) => d.code)).toContain("MDMX001");
  });

  it("rejects invalid saves in strict mode with 422", async () => {
    const h = makeHandlers({ validation: "strict" });
    const res = await h.PUT(
      req("PUT", "/file", {
        path: "content/posts/bad.mdx",
        content: "<Mystery />\n",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 409 on a stale expectedSha", async () => {
    const h = makeHandlers();
    const { sha } = (await (
      await h.GET(req("GET", "/file?path=content/posts/hello.mdx"))
    ).json()) as { sha: string };
    await h.PUT(
      req("PUT", "/file", { path: "content/posts/hello.mdx", content: "# v2\n" }),
    );
    const res = await h.PUT(
      req("PUT", "/file", {
        path: "content/posts/hello.mdx",
        content: "# stale\n",
        expectedSha: sha,
      }),
    );
    expect(res.status).toBe(409);
  });

  it("rejects paths outside contentDir/mediaDir and traversal", async () => {
    const h = makeHandlers();
    const outside = await h.PUT(
      req("PUT", "/file", { path: ".github/workflows/evil.yml", content: "x" }),
    );
    expect(outside.status).toBe(400);
    const traversal = await h.GET(req("GET", "/file?path=content/../secrets.txt"));
    expect(traversal.status).toBe(400);
  });

  it("rejects cross-origin mutations", async () => {
    const h = makeHandlers();
    const res = await h.PUT(
      req(
        "PUT",
        "/file",
        { path: "content/x.mdx", content: "# x\n" },
        { origin: "https://evil.example" },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("uploads media under mediaDir with type/size limits and no-clobber", async () => {
    const h = makeHandlers({ maxMediaBytes: 1024 });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");

    const ok = await h.POST(
      req("POST", "/media", { path: "public/media/a.png", dataBase64: png }),
    );
    expect(ok.status).toBe(201);

    const clobber = await h.POST(
      req("POST", "/media", { path: "public/media/a.png", dataBase64: png }),
    );
    expect(clobber.status).toBe(409);

    const badType = await h.POST(
      req("POST", "/media", { path: "public/media/x.svg", dataBase64: png }),
    );
    expect(badType.status).toBe(400);

    const tooBig = await h.POST(
      req("POST", "/media", {
        path: "public/media/big.png",
        dataBase64: Buffer.alloc(2048).toString("base64"),
      }),
    );
    expect(tooBig.status).toBe(413);

    const wrongDir = await h.POST(
      req("POST", "/media", { path: "content/sneaky.png", dataBase64: png }),
    );
    expect(wrongDir.status).toBe(400);
  });

  it("deletes files", async () => {
    const h = makeHandlers();
    await h.PUT(req("PUT", "/file", { path: "content/tmp.mdx", content: "# t\n" }));
    const res = await h.DELETE(req("DELETE", "/file", { path: "content/tmp.mdx" }));
    expect(res.status).toBe(200);
    const read = await h.GET(req("GET", "/file?path=content/tmp.mdx"));
    expect(read.status).not.toBe(200);
  });
});

describe("localMode (no GitHub OAuth)", () => {
  // No auth / sessionSecret; every request runs as a synthetic "local" session.
  function localHandlers(): MDMXHandlers {
    return createMDMXHandlers({
      repo: { owner: "local", name: "demo", branch: "main" },
      contentDir: "content",
      mediaDir: "public/media",
      localMode: true,
      createProvider: () => new LocalProvider(root),
      registry,
      now: () => now,
    });
  }

  // Same-origin request WITHOUT any session cookie.
  function localReq(method: string, path: string, body?: unknown): Request {
    return new Request(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json", origin: "https://site.example" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  it("reads a file with no session cookie", async () => {
    const h = localHandlers();
    await h.PUT(
      localReq("PUT", "/file", {
        path: "content/posts/seed-local.mdx",
        content: '<Callout variant="info">\n  Hi.\n</Callout>\n',
      }),
    );
    const res = await h.GET(localReq("GET", "/file?path=content/posts/seed-local.mdx"));
    expect(res.status).toBe(200);
    expect((await res.json()).content).toContain("<Callout");
  });

  it("reports the synthetic local identity at /me", async () => {
    const res = await localHandlers().GET(localReq("GET", "/me"));
    expect(res.status).toBe(200);
    expect((await res.json()).login).toBe("local");
  });

  it("writes a file to the working tree without auth", async () => {
    const h = localHandlers();
    const put = await h.PUT(
      localReq("PUT", "/file", { path: "content/posts/local.mdx", content: "# Local\n" }),
    );
    expect(put.status).toBe(200);
    const read = await h.GET(localReq("GET", "/file?path=content/posts/local.mdx"));
    expect((await read.json()).content).toBe("# Local\n");
  });

  it("still rejects cross-origin mutations", async () => {
    const bad = new Request(`${BASE}/file`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ path: "content/posts/x.mdx", content: "# x\n" }),
    });
    expect((await localHandlers().PUT(bad)).status).toBe(403);
  });

  it("still enforces path-safety (prefix) in local mode", async () => {
    const res = await localHandlers().GET(localReq("GET", "/file?path=../../etc/passwd"));
    expect(res.status).toBe(400);
  });

  it("returns 400 (not 500) when the saved .mdx cannot be parsed", async () => {
    const res = await localHandlers().PUT(
      localReq("PUT", "/file", { path: "content/posts/bad.mdx", content: "<Bad foo=1 />" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/parse/i);
  });
});

describe("frontmatter validation on save", () => {
  const withCollection = new Registry({
    mdmxRegistryVersion: 1,
    components: registry.components as never,
    collections: [
      {
        name: "posts",
        dir: "content/posts",
        fields: [
          { name: "title", required: true, control: { type: "text" } },
          {
            name: "status",
            required: true,
            control: { type: "select", options: ["draft", "published"] },
          },
        ],
      },
    ],
  });

  function handlers(validation: "strict" | "report"): MDMXHandlers {
    return createMDMXHandlers({
      repo: { owner: "local", name: "demo", branch: "main" },
      contentDir: "content",
      mediaDir: "public/media",
      localMode: true,
      validation,
      createProvider: () => new LocalProvider(root),
      registry: withCollection,
      now: () => now,
    });
  }

  function put(path: string, content: string): Request {
    return new Request(`${BASE}/file`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "https://site.example" },
      body: JSON.stringify({ path, content }),
    });
  }

  const valid = '---\ntitle: Hi\nstatus: draft\n---\n\n# Hi\n';
  const missingTitle = "---\nstatus: draft\n---\n\n# Hi\n";

  it("report mode: saves but returns frontmatter diagnostics", async () => {
    const res = await handlers("report").PUT(put("content/posts/r.mdx", missingTitle));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.diagnostics.map((d: { code: string }) => d.code)).toContain("MDMX008");
  });

  it("strict mode: rejects invalid frontmatter with 422", async () => {
    const res = await handlers("strict").PUT(put("content/posts/s.mdx", missingTitle));
    expect(res.status).toBe(422);
  });

  it("strict mode: accepts valid frontmatter", async () => {
    const res = await handlers("strict").PUT(put("content/posts/ok.mdx", valid));
    expect(res.status).toBe(200);
  });

  it("ignores frontmatter rules outside the collection dir", async () => {
    const res = await handlers("strict").PUT(put("content/top.mdx", missingTitle));
    expect(res.status).toBe(200);
  });
});
